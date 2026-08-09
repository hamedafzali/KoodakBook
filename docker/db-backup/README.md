# db-backup — encrypted offsite Postgres backups (Phase 1B)

> ## ⚠️ Backup sidecar is currently DISABLED
>
> `db-backup` and `db-drill` are gated behind the Compose profile `backup`,
> which is **not** in the default profile set — a plain `docker compose up`
> (what the ACM pipeline runs) starts neither service. **The database has no
> restore point of any kind right now** — not offsite, not local-only. A bad
> migration, an accidental `DELETE`, a disk failure: none of them are
> recoverable while this is off.
>
> **Re-enable:** set `COMPOSE_PROFILES=backup` in ACM, plus the five variables
> both services need (`AGE_RECIPIENT`, `BACKUP_DB_PASSWORD`,
> `DRILL_PGPASSWORD`, `HEARTBEAT_BACKUP_URL`, `HEARTBEAT_DRILL_URL`), then
> redeploy. Leaving `COMPOSE_PROFILES` unset with those variables set does
> **nothing** — the profile gate, not the variables, controls whether the
> services exist at all.
>
> **The soft `${VAR:-}` defaults on `AGE_RECIPIENT`/`BACKUP_DB_PASSWORD`/
> `DRILL_PGPASSWORD` in `docker-compose.yml` exist only so `docker compose
> config` resolves cleanly while the profile is inactive.** They are not a
> runtime exemption: the moment the profile *is* active, `lib.sh:
> require_backup_config()` still hard-fails (`FATAL: missing required config`
> + a dead-man's-switch FAIL ping) if any of them is actually blank — verified
> directly, this doesn't silently no-op into a fake backup.
>
> **[Piper removal (PR #1) stays blocked while this is off](../../project.md)**
> — it drops four columns irreversibly, and there is nothing to restore from
> if that goes wrong with backups disabled.
>
> Everything below describes the sidecar's *behavior once enabled* (including
> the separate, narrower local-only mode) — it does not apply while it's off.

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
