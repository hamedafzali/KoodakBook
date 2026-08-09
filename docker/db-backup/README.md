# db-backup — encrypted offsite Postgres backups (Phase 1B)

A single sidecar image that gives KoodakBook a **tested, encrypted, offsite**
restore point. One image, several roles (approved plan §3):

| Command                         | Role                                                            |
| ------------------------------- | -------------------------------------------------------------- |
| _(default)_ / `scheduler`       | `supercronic` on `crontab` — the long-running service          |
| `backup`                        | one scheduled full dump                                         |
| `backup --label <label>`        | one on-demand labelled dump (e.g. `pre-migrate`); prints `VERIFIED_OFFSITE <key>` on success |
| `verify-offsite`                | **weekly, keyless** — prove the offsite copy is intact WITHOUT the private key (the scheduled drill) |
| `restore-drill`                 | **quarterly, manual** — the full decrypt→restore proof, using the off-server key |
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

- `BACKUP_S3_*`, `BACKUP_BUCKET`, `BACKUP_PREFIX` — S3-compatible endpoint
  (Cloudflare R2 in prod, MinIO in the local harness).
- `BACKUP_KEY_ID/SECRET` (write+list) · `RESTORE_KEY_ID/SECRET` (read-only).
- `AGE_RECIPIENT` — **public** key; the only age key on the server. `AGE_IDENTITY`
  is **not set in prod**; the quarterly **manual** drill mounts the off-server key
  via `AGE_IDENTITY_FILE` for that run only.
- `MANIFEST_TABLES` — tables whose row counts go in the manifest (default covers
  the core tables + `_migrations`).
- `HEARTBEAT_BACKUP_URL` / `HEARTBEAT_DRILL_URL` (the weekly `verify-offsite` and
  the quarterly `restore-drill` share the drill heartbeat).
- `DRILL_PGPASSWORD` — the throwaway db-drill server's password (quarterly drill).

## Provisioning checklist (needs real secrets — do at deploy time)

1. Create the R2 bucket with **object-lock ON**, in an account **separate** from
   the age-key store. Mint two scoped tokens (write+list, read-only).
2. Generate the age keypair (`age-keygen`). Put **only the public key** in
   `AGE_RECIPIENT`. Store the private key in a password manager **and** a physical
   off-site copy — **never on the server** (`AGE_IDENTITY` stays unset in prod).
   The key is the master secret for every backup; protect it accordingly and plan
   to verify the custody copy is readable at each quarterly drill.
3. Create the two healthchecks.io checks; set their ping URLs.
4. Apply [`backup-role.sql`](backup-role.sql) to prod, set `BACKUP_DB_PASSWORD`.
5. Deploy; watch the first `02:00`/`14:00` backups (each must upload a `.age` **and**
   its `.manifest.json`) and the Sunday `04:00` **keyless** `verify-offsite`. Soak
   48h under observation before declaring Phase 1B live (§12.6).
6. Schedule the first **quarterly** `restore-drill` (manual, off-server key) — the
   full decrypt→restore proof and the custody-copy read test.

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
