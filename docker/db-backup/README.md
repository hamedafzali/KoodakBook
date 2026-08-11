# db-backup — encrypted offsite Postgres backups (Phase 1B)

> ## ⚠️ Enabled, but LOCAL-ONLY (`BACKUP_OFFSITE=0`) — no offsite target yet
>
> `db-backup` and `db-drill` are live (`COMPOSE_PROFILES=backup`, enabled
> 2026-08-10) and running twice-daily encrypted dumps with a healthchecks.io
> dead-man's-switch. But no offsite destination is provisioned, so every
> encrypted copy lives on `backup_staging` — **the same disk as
> `postgres_data`.** This is a rollback safety net (bad migration, accidental
> `DELETE`), **not disaster recovery** — see "Local-only mode" below for what
> it does and doesn't protect against.
>
> The quarterly `restore-drill.sh` (needs an offsite target) cannot run in
> this mode. The only proof of genuine restorability while local-only is the
> **manual decrypt-and-restore test** documented below — run it, don't assume
> it. As of 2026-08-11 it has been run once successfully (see git history for
> the confirming session).
>
> **The soft `${VAR:-}` defaults on `AGE_RECIPIENT`/`BACKUP_DB_PASSWORD`/
> `DRILL_PGPASSWORD` in `docker-compose.yml` exist only so `docker compose
> config` resolves cleanly if the profile is ever inactive.** They are not a
> runtime exemption: `lib.sh: require_backup_config()` still hard-fails
> (`FATAL: missing required config` + a dead-man's-switch FAIL ping) if any of
> them is actually blank.
>
> Everything below describes the sidecar's full behavior, including the
> offsite path this deployment does not yet use.

A single sidecar image that gives KoodakBook a **tested, encrypted, offsite**
restore point. One image, several roles (approved plan §3):

| Command                         | Role                                                            |
| ------------------------------- | -------------------------------------------------------------- |
| _(default)_ / `scheduler`       | `supercronic` on `crontab` — the long-running service          |
| `backup`                        | one scheduled full dump                                         |
| `backup --label <label>`        | one on-demand labelled dump (e.g. `pre-migrate`); prints `VERIFIED_OFFSITE <key>` on success **— only when offsite (see "Local-only mode")** |
| `verify-offsite`                | **weekly, keyless** — prove the offsite copy is intact WITHOUT the private key. Auto-routes to `verify-local.sh` when `BACKUP_OFFSITE=0` |
| `verify-local`                  | the local-only weekly check directly (also what the crontab and the `verify-offsite` auto-route call) |
| `restore-drill`                 | **quarterly, manual** — the full decrypt→restore proof, using the off-server key. **Needs an offsite target; not usable in local-only mode.** |
| `sh` / `bash` / _anything else_ | exec-through, for debugging                                     |

## Design rules (baked into every script)

- **Fail-closed.** Every job runs under `set -Eeuo pipefail`. Any failure exits
  non-zero, fires a `fail` heartbeat, and — critically — **never** sends the
  success ping. The absence of a success ping is what the healthchecks.io
  **dead-man's switch** alerts on, so a half-done job must never look healthy.
- **Encrypt-everywhere.** The plaintext `pg_dump` exists only transiently on the
  `/staging` volume and is `shred`ed the instant it is age-encrypted. Nothing
  unencrypted is ever uploaded or retained — including the local rotation.
- **Least privilege.**
  - DB: connects as the `backup` role (`pg_read_all_data`, no write) —
    see [`backup-role.sql`](backup-role.sql).
  - Object store: a **write+list-only** credential for backups and a **separate
    read-only** credential for the restore-drill. A leaked backup key cannot read
    history or delete objects; a leaked restore key cannot write.
- **Anomaly guard (belt & suspenders).** Even on a verified upload, if the dump
  is >`ANOMALY_DROP_PCT`% below the trailing-7 median size, or the row-count
  regressed, the job fires a `fail` ping — this is the "ran but captured a
  truncated DB" signature.

## Local-only mode (offsite destination deferred) ⚠️

> **The sharp edge, first:** `backup_staging` — where the local-only encrypted
> copies live — is a Docker volume on the **same host disk** as `postgres_data`.
> If that disk fails, is stolen, is hit by ransomware, or the volume is deleted,
> **you lose the database and every "backup" in the same event.** Local-only is a
> **rollback safety net** (bad migration, accidental `DELETE`), **not disaster
> recovery.** Do not report this as "backups are working" without that caveat.

No offsite destination (R2, MinIO, or otherwise) is provisioned yet. Rather than
let the sidecar quietly skip the parts it can't do, this is an **explicit,
config-driven mode**:

- **`BACKUP_OFFSITE`** — defaults to `1` (offsite required, the historical
  behaviour). Set to `0` on purpose to run local-only. **This is the only knob
  that changes behaviour.** Leaving the S3 vars blank with `BACKUP_OFFSITE`
  unset or `1` is still a hard error (`require_backup_config` in `lib.sh`) — a
  missing destination can never silently degrade into local-only.
- **What still runs:** dump → integrity precheck → age-encrypt → shred plaintext
  → **local encrypted retention** (`LOCAL_KEEP` copies on `backup_staging`) →
  backup heartbeat. The manifest is still written, just kept locally instead of
  uploaded.
- **What's disabled:** the upload + remote-size-verify step, the manifest
  upload, and the quarterly `restore-drill` (nothing offsite to restore from —
  don't schedule it while local-only).
- **Every local-only run says so, loudly, in three places** — you should never
  have to infer the mode from absence of an error: the backup log prints a
  boxed `LOCAL-ONLY MODE (BACKUP_OFFSITE=0) — NOT SHIPPED OFFSITE` banner; the
  success **heartbeat payload itself** carries `[LOCAL-ONLY — NOT shipped
  offsite]` (so it's visible in the healthchecks.io history, not just the
  container log); and the weekly drill runs as `verify-local.sh` — its own
  heartbeat payload is tagged `[LOCAL-ONLY — NOT verified offsite]` too.
- **`VERIFIED_OFFSITE <key>` is never emitted in this mode.** That marker is
  what Item 2's future pre-migration hook will treat as "a real restore point
  exists, safe to run a destructive migration." A local-only copy on the same
  disk as the live DB is not that — see the comment at the emission site in
  `backup.sh` for why re-enabling it here would be actively dangerous.

**What local-only protects against:**
- ✅ a bad migration or an accidental `DELETE`/`DROP` (roll back to the last
  local encrypted copy)
- ✅ human/application-layer mistakes short of touching the disk itself

**What it does NOT protect against** (all of these take `backup_staging` down
with `postgres_data`, because they're the same disk):
- ❌ disk failure
- ❌ theft of the server
- ❌ ransomware / host compromise that touches the volume
- ❌ accidental Docker volume deletion

### Weekly check in local-only mode: `verify-local.sh`

The weekly slot can't run `verify-offsite.sh` (nothing offsite to check), so it
runs a reduced **local** verification instead — same cadence, same
`HEARTBEAT_DRILL_URL`, no separate healthchecks.io check to create. It checks
the newest local `.dump.age` + its manifest: existence, size trend, a
well-formed age header, the recipient fingerprint, checksum/size, and manifest
row/size sanity — everything `verify-offsite.sh` does **except** object-lock
retention and "is this actually retrievable from somewhere other than this
host," which are meaningless without an offsite target. See the header comment
in `verify-local.sh` for the exact list.

### Getting back to offsite when a destination is picked

The scripts have **no provider branches** — `rclone_remote_flags()` in `lib.sh`
emits generic `--s3-*` flags, so **any S3-compatible target is a config change
only**: set `BACKUP_OFFSITE=1` and point `BACKUP_S3_ENDPOINT` /
`BACKUP_S3_PROVIDER` / bucket / keys at it. This covers Cloudflare R2 (prod
target), MinIO run in front of a NAS or an external disk, or any other S3-
compatible gateway — verified by the local harness, which already does exactly
this against MinIO.

A **raw rclone `local:` or `sftp:` remote** (no S3 gateway in front of the
NAS/disk) is a different story: `:s3:` is hardcoded as the remote scheme in
four places, and supporting a non-S3 backend means abstracting the remote
scheme + path prefix at each:

1. `lib.sh` — `store_path()` (builds `:s3:bucket/prefix/key`)
2. `lib.sh` — `rclone_remote_flags()` (emits `--s3-*` flags only)
3. `verify-offsite.sh` — the offsite listing line (`rclone_do read lsf … ":s3:${BACKUP_BUCKET}/${BACKUP_PREFIX}/"`)
4. `restore-drill.sh` — the listing line **and** the copy-down line (both build a `:s3:${BACKUP_BUCKET}/${BACKUP_PREFIX}/…` path directly)

**Recommendation:** when a LAN target is picked, run an S3 gateway (MinIO is
the obvious choice, already proven by the harness) in front of the NAS/disk
rather than doing the sftp/local abstraction work — it stays a pure
provisioning change and reuses the entire tested path. Reserve the four-site
refactor for if keyless sftp/local with no gateway is specifically wanted.

## Manual quarterly restore test (local-only mode)

While `BACKUP_OFFSITE=0`, `restore-drill.sh` cannot run (it fetches from
offsite by design) and `verify-local.sh` never decrypts — it checks the
ciphertext is well-formed, not that it restores into a working database. This
procedure is the only thing that actually proves restorability in local-only
mode. It requires the off-server private key, so it is deliberately **manual,
run by a human on their own machine, quarterly** — the same cadence and
off-server-key model as the offsite `restore-drill.sh`, just done by hand
instead of by the sidecar.

**Prerequisites:** `age` and `docker` installed locally (`brew install age`),
and the private key file generated when `AGE_RECIPIENT` was created — kept
outside any git working tree, per the off-server-key model above.

### 1. Copy the latest encrypted backup off the server

```bash
# Find the newest file on the staging volume
LATEST=$(ssh hamed@192.168.178.34 \
  'docker exec koodakbook-db-backup-1 sh -c "ls -1 /staging/*.dump.age | sort | tail -1"')
echo "$LATEST"

# Copy it down (container → stdout → local file; no intermediate host write)
ssh hamed@192.168.178.34 "docker exec koodakbook-db-backup-1 cat ${LATEST}" \
  > "$(basename "$LATEST")"
```

### 2. Decrypt with the off-server private key

```bash
age -d -i /path/to/your/age-private-key.txt \
  -o restore-test.dump \
  "$(basename "$LATEST")"
```

If this fails, that itself is the finding: it means the key you have doesn't
match `AGE_RECIPIENT`, or the key is unreadable/corrupted — exactly the "a key
you've never tested reading" failure mode this drill exists to catch.

### 3. Restore into a disposable local Postgres

```bash
docker run -d --name koodakbook-restore-test \
  -e POSTGRES_PASSWORD=restoretest -e POSTGRES_DB=restore_test \
  -p 55432:5432 postgres:16-alpine

# wait for it to accept connections
until docker exec koodakbook-restore-test pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

docker cp restore-test.dump koodakbook-restore-test:/tmp/restore.dump
docker exec koodakbook-restore-test pg_restore --clean --if-exists \
  --no-owner --no-privileges -U postgres -d restore_test /tmp/restore.dump
```

(`pg_restore` may print benign "does not exist, skipping" notices from
`--clean --if-exists` against an empty database — not a failure by itself;
the checks below are what determine pass/fail.)

### 4. Confirm a genuine, complete restore — not just "it didn't error"

Pull live counts from prod for comparison (uses the local-socket trust auth,
no app password needed):

```bash
livecount() { ssh hamed@192.168.178.34 \
  "docker exec -u postgres koodakbook-db-1 psql -U koodakbook -d koodakbook -tAc \"$1\""; }
restoredcount() { docker exec koodakbook-restore-test \
  psql -U postgres -d restore_test -tAc "$1"; }
```

Then check, mirroring exactly what `restore-drill.sh` asserts against a real
offsite copy (same tables, same logic — see that script's §5a–5d):

- **Schema currency** — restored `_migrations` max filename equals live's
  (proves this isn't a stale dump silently missing a later migration):
  ```bash
  diff <(restoredcount "select max(filename) from _migrations") \
       <(livecount     "select max(filename) from _migrations")
  ```
- **Row counts, per table** — restored count should be close to (within
  ~25%, since the dump can be up to ~12h old) or equal to live, and above a
  sane floor:
  ```bash
  for t in users children words stories child_word_progress; do
    echo "$t: restored=$(restoredcount "select count(*) from $t") live=$(livecount "select count(*) from $t")"
  done
  ```
- **No orphaned rows** (referential integrity survived the round trip):
  ```bash
  restoredcount "select count(*) from child_word_progress p left join children c on c.id=p.child_id where c.id is null"
  restoredcount "select count(*) from story_pages sp left join stories s on s.id=sp.story_id where s.id is null"
  # both must be 0
  ```
- **Sentinel row** — a known row survives intact, not just present:
  ```bash
  restoredcount "select count(*) from users where email = 'admin@koodakbook.com'"
  # must be ≥ 1
  ```

A genuine pass is: schema matches, every table's restored count is within
tolerance of live, both orphan checks are `0`, and the sentinel row exists.
An empty-but-connected database, or a restore that silently dropped a table,
will show up as a `0`/missing count here — a bare "exit code 0" from
`pg_restore` would not have caught either.

### 5. Clean up — the decrypted plaintext is now sitting unencrypted locally

```bash
docker rm -f koodakbook-restore-test
shred -u restore-test.dump "$(basename "$LATEST")" 2>/dev/null || rm -P restore-test.dump "$(basename "$LATEST")"
```

(macOS has no `shred`; `rm -P` overwrites before unlinking. Belt-and-braces:
don't leave either file sitting in a Trash/backup-synced folder afterward.)

## Restore isolation — why db-drill, not a socket-spawned container

The plan's §7.1 wording says "spin up an ephemeral `postgres:16-alpine`
container." Doing that from **inside** this sidecar would require mounting the
Docker socket — i.e. root on a host shared with ~10 projects — which would undo
this image's non-root / `read_only` hardening. Instead the drill restores into a
freshly-created, uniquely-named **database** on a dedicated, **dataless**
`db-drill` Postgres service (a client connection, no socket). The database is
created and dropped every run, so it is ephemeral; the server is a small
always-on container holding no real data. This keeps true process isolation from
prod (a runaway restore can never touch prod's server) without granting the
sidecar host-level power.

## Heartbeat behaviour note

Heartbeat delivery is **best-effort with a short timeout**: a healthchecks.io
network blip must NOT abort an otherwise-good job (a missed ping is itself the
alert). With `HEARTBEAT_*_URL` blank the pings are **logged, not sent**
(DRY-RUN), so the image is safe to run before the hosted monitor exists.

## age identity & drills (off-server-key model)

Backups are encrypted to a single age recipient. **The private key never lives on
the server** — not even an operational copy. This is the whole point of encrypting
the backups: a server compromise then yields the live DB but *not* the means to
decrypt the offsite history. Because the key is off-server, the two cadences split:

- **Weekly automated drill** (`0 4 * * 0`, `verify-offsite.sh`) is **keyless**. It
  proves everything about the offsite copy that is checkable *without* decrypting,
  using the read-only credential + the recipient **public** key:
  1. **Exists** — a fresh, non-labelled `.age` is present offsite.
  2. **Size trend** — its size is in-band vs the trailing-7 median (not truncated).
  3. **age header** — well-formed age v1, exactly the expected recipient stanza
     type/count, **no scrypt (passphrase) stanza**.
  4. **Recipient** — the manifest's recipient fingerprint matches *our* public key
     (catches "encrypted to a wrong/rotated recipient"). Note: with X25519 the
     recipient pubkey is not recoverable from the header by design, so recipient
     *identity* is verified via the manifest (pipeline-attested) while stanza
     *type/count* is verified cryptographically from the header.
  5. **Checksum + size** — the stored bytes are downloaded and hashed; the sha256
     and byte size must match the manifest and the remote size (proves it is fully
     retrievable and unaltered).
  6. **Object-lock retention** — best-effort check that retention is in force
     (see the note in the check; authoritative proof is provisioning + quarterly).
  7. **Row/size sanity** — manifest row counts clear per-table floors, don't
     regress vs the previous manifest, and (if a live DB is reachable) sit within
     tolerance of live.
- **Quarterly manual drill** (human-run, not cron, `restore-drill.sh`) is the
  **only** decrypt→restore. The operator supplies the **off-server** key via
  `AGE_IDENTITY_FILE`; it fetches the latest offsite copy, decrypts, restores into
  the isolated `db-drill` scratch DB, and runs the full assertion set. This both
  closes the gap the keyless weekly drill leaves (does it *actually* decrypt and
  restore?) **and** rehearses reading the cold key from custody.

`AGE_IDENTITY` (private-key contents in an env var) is **not** a production input.
`lib.sh:age_identity_file()` still accepts it so the local staging harness can run
the full drill with an ephemeral key — but in prod the key arrives only as a file
(`AGE_IDENTITY_FILE`) the operator mounts for the quarterly run.

### The manifest sidecar

So the keyless weekly drill can check more than "an object exists", every backup
writes a **plaintext metadata sidecar** next to its `.age`, at
`<object-key>.manifest.json`. It carries **metadata only — never row values**:
schema version, name/key/timestamp, the age-recipient fingerprint, plaintext dump
size, ciphertext size + sha256, pg object count, per-table row counts
(`MANIFEST_TABLES`) + total, and the full table-name list. It is uploaded and
size-verified **before** the backup's success ping, so a missing/failed manifest
fails the backup fail-closed.

**Trust boundary — read this before relying on it.** The manifest is a
*pipeline-attested operational aid, not a security control.* A host that can forge
a backup can forge its manifest, so the weekly drill catches **operational**
failure (job stopped, 0-byte/truncated upload, wrong recipient, checksum drift,
row regression), not a motivated attacker who already owns the box. The
authoritative proof that the ciphertext decrypts to a restorable database is the
**quarterly** drill with the off-server key.

### Key-loss failure mode (the cost of this model) ⚠️

With the key off-server, **losing the private key means losing the ability to
decrypt every backup** — the backups become permanently opaque, including to you.
The key is now the single most important thing to protect, and a key you have
never tested *reading* is the same class of problem as a backup you have never
*restored*. Mitigation, mandatory:

- Keep the private key in a **password manager AND one offline copy** (printed or
  on a hardware token) in a separate physical location.
- **Verify the custody copy is readable at every quarterly drill** — the quarterly
  `restore-drill` is deliberately fed the key *from custody* (not a working copy),
  so a successful quarterly run doubles as proof the cold copy is intact and
  legible. A quarterly failure that turns out to be "couldn't read the key" is a
  custody incident, not a backup incident — treat it as such.

## Configuration

All real values live in **ACM project variables**; `.env.example` carries
placeholders only. See the `db-backup` service in `docker-compose.prod.yml` for
the full wiring. Key vars:

- `BACKUP_OFFSITE` — `1` (default) requires an offsite destination; `0` is the
  explicit local-only opt-out (see "Local-only mode" above). Never implicit.
- `BACKUP_S3_*`, `BACKUP_BUCKET`, `BACKUP_PREFIX` — S3-compatible endpoint
  (Cloudflare R2 in prod, MinIO in the local harness). Required only when
  `BACKUP_OFFSITE=1`.
- `BACKUP_KEY_ID/SECRET` (write+list) · `RESTORE_KEY_ID/SECRET` (read-only).
  Same — required only when offsite is enabled.
- `AGE_RECIPIENT` — **public** key; the only age key on the server. `AGE_IDENTITY`
  is **not set in prod**; the quarterly **manual** drill mounts the off-server key
  via `AGE_IDENTITY_FILE` for that run only.
- `MANIFEST_TABLES` — tables whose row counts go in the manifest (default covers
  the core tables + `_migrations`).
- `HEARTBEAT_BACKUP_URL` / `HEARTBEAT_DRILL_URL` (the weekly `verify-offsite` and
  the quarterly `restore-drill` share the drill heartbeat).
- `DRILL_PGPASSWORD` — the throwaway db-drill server's password (quarterly drill).

## Provisioning checklist — LOCAL-ONLY (current state, `BACKUP_OFFSITE=0`)

Deferring the offsite destination on purpose (see "Local-only mode" above).
Reduced provisioning to go live in this mode:

1. Generate the age keypair (`age-keygen`). Put **only the public key** in
   `AGE_RECIPIENT`. Store the private key in a password manager **and** a
   physical off-site copy — **never on the server**. Encryption stays valuable
   regardless of where the ciphertext ends up.
2. Apply [`backup-role.sql`](backup-role.sql) to prod, set `BACKUP_DB_PASSWORD`.
3. Create **one** healthchecks.io check (the backup/drill heartbeat is shared);
   set `HEARTBEAT_BACKUP_URL` and `HEARTBEAT_DRILL_URL`. Blank fails closed —
   see the entrypoint's heartbeat preflight.
4. Set `BACKUP_OFFSITE=0` explicitly and `DRILL_PGPASSWORD` (the `db-drill`
   service stays deployed so the switch back to offsite needs no compose
   change).
5. Deploy; watch the first `02:00`/`14:00` backups log the `LOCAL-ONLY MODE`
   banner and a heartbeat payload tagged `[LOCAL-ONLY — NOT shipped offsite]`,
   and the Sunday `04:00` slot run `verify-local.sh` (payload tagged
   `[LOCAL-ONLY — NOT verified offsite]`).
6. **Do not** schedule the quarterly `restore-drill` while local-only — there is
   nothing offsite for it to fetch.

## Provisioning checklist — OFFSITE (do this when a destination is picked)

**Not required today.** MinIO-on-LAN or any other S3-compatible target is a
config-only change (see "Getting back to offsite" above) — no code, no PR.

1. Provision the destination with **object-lock ON** if it supports it (R2:
   in an account **separate** from the age-key store). Mint two scoped tokens
   (write+list, read-only).
2. Set `BACKUP_OFFSITE=1` and the six `BACKUP_S3_*`/`BACKUP_BUCKET`/
   `BACKUP_KEY_*`/`RESTORE_KEY_*` vars.
3. Deploy; watch the first backups upload a `.age` **and** its
   `.manifest.json`, and the Sunday `04:00` slot switch back to the real
   **keyless** `verify-offsite.sh`. Soak 48h under observation (§12.6).
4. Schedule the first **quarterly** `restore-drill` (manual, off-server key) —
   the full decrypt→restore proof and the custody-copy read test.

## R2 rehearsal watch (provider-specific, verify don't assume)

The scripts have **no provider branches** — MinIO→R2 is config only. But MinIO
can't reproduce two R2-specific behaviours, so watch for them during the Phase 0
rehearsal and apply the matching flag (staged, commented, in `lib.sh`) only if
seen:

- **Post-upload `rclone size` verify returns stale/empty** on a just-written
  object → add `--s3-no-head`.
- **Large dumps stall/error on multipart upload** → add `--s3-upload-cutoff=200M`.

Both are one-line edits into `rclone_remote_flags()`. Left unapplied on purpose:
enabling them speculatively could mask a genuine fault.

## Local verification (no real secrets)

`staging/run-tests.sh` runs the approved §10 table against a local **MinIO**
stand-in for R2 and an ephemeral age keypair. Rows that genuinely need hosted R2
or hosted healthchecks.io are reported **CANNOT-LOCAL / PARTIAL** (with the
reason) rather than skipped:

```
bash docker/db-backup/staging/run-tests.sh
```

`staging/run-tests-local.sh` is the local-only companion — it brings up only
`db`+`db-drill` (no MinIO; local-only mode never touches S3) and runs a
separate 7-row table proving the local-only path end to end:

```
bash docker/db-backup/staging/run-tests-local.sh
```

| # | Row | Result (last run) |
|---|-----|--------|
| L1 | Missing S3 creds WITHOUT `BACKUP_OFFSITE=0` still hard-fails (no silent local-only fallback) | PASS |
| L2 | Local-only backup: LOCAL-ONLY banner in the **log** | PASS |
| L3 | Local-only backup: LOCAL-ONLY tag in the **heartbeat payload** | PASS |
| L4 | Encrypted `.dump.age` + its `.manifest.json` both land on `backup_staging` | PASS |
| L5 | `VERIFIED_OFFSITE` withheld for a `--label pre-migrate` local-only backup | PASS |
| L6 | Weekly `verify-offsite` slot auto-routes to `verify-local.sh` | PASS |
| L7 | `verify-local.sh`'s own heartbeat payload is tagged LOCAL-ONLY | PASS |

The rest of the approved §10 table (below) doesn't apply in local-only mode —
there's no offsite object to upload/verify/lock, so those rows are **N/A by
design**, not silently skipped: object-lock retention, upload-size
cross-check, R2 rehearsal, and the quarterly `restore-drill` (which needs an
offsite target and is not scheduled while `BACKUP_OFFSITE=0` — see
"Local-only mode" above). Everything else in the §10 table below —
image build, encryption round-trip, manifest content, local retention
pruning, dead-man's-switch wiring — is mode-independent and unaffected.

Fixing L4/L6/L7 above surfaced one real bug during this pass: the local-only
manifest filename was `NAME.manifest.json`, but retention pruning and
`verify-local.sh` both derive the manifest path from the `.dump.age` file's
own name (`NAME.dump.age.manifest.json`). Harmless before local-only mode
existed (the local file was transient, deleted right after upload under a
different, offsite-only key name) — now load-bearing, since the file
persists. Fixed at the source in `backup.sh` so the name matches everywhere
it's read.

The harness now also covers the **manifest** (backup emits it; contents sane) and
the **keyless weekly `verify-offsite`** (existence, header, recipient fingerprint,
checksum/size, row sanity) against MinIO with an ephemeral keypair; the full
decrypt→restore path is exercised by driving `restore-drill` with that ephemeral
key (standing in for the quarterly off-server key).

- **PARTIAL — Off-server-key recovery:** the crypto half is proven locally
  (restores with only the isolated private key); the human off-server-custody
  rehearsal is the manual quarterly drill (prod §11.6).
- **PARTIAL — Scheduler:** supercronic validates the crontab locally; the 48h
  drift soak is a prod-under-observation item (§12.6).
- **CANNOT-LOCAL — Dead-man's switch:** observing a *missed-ping* alert needs the
  hosted healthchecks.io monitor; locally only the ping call is exercisable
  (DRY-RUN). Covered by the Phase 0 hosted rehearsal + prod §11.6.
- **CANNOT-LOCAL — Object-lock retention:** MinIO's lock semantics don't match
  R2's; the `verify-offsite` retention check is best-effort and is authoritatively
  proven at provisioning + the quarterly drill.

> The manifest + `verify-offsite` code is new in this revision. Re-run
> `staging/run-tests.sh` on the target arch before declaring the numbers above;
> they supersede the previous "7 PASS · 2 PARTIAL · 1 CANNOT-LOCAL" line.
