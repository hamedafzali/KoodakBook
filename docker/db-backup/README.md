# db-backup — encrypted offsite Postgres backups (Phase 1B)

A single sidecar image that gives KoodakBook a **tested, encrypted, offsite**
restore point. One image, several roles (approved plan §3):

| Command                         | Role                                                            |
| ------------------------------- | -------------------------------------------------------------- |
| _(default)_ / `scheduler`       | `supercronic` on `crontab` — the long-running service          |
| `backup`                        | one scheduled full dump                                         |
| `backup --label <label>`        | one on-demand labelled dump (e.g. `pre-migrate`); prints `VERIFIED_OFFSITE <key>` on success |
| `restore-drill`                 | fetch the latest offsite copy and prove it restores            |
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

## Configuration

All real values live in **ACM project variables**; `.env.example` carries
placeholders only. See the `db-backup` service in `docker-compose.prod.yml` for
the full wiring. Key vars:

- `BACKUP_S3_*`, `BACKUP_BUCKET`, `BACKUP_PREFIX` — S3-compatible endpoint
  (Cloudflare R2 in prod, MinIO in the local harness).
- `BACKUP_KEY_ID/SECRET` (write+list) · `RESTORE_KEY_ID/SECRET` (read-only).
- `AGE_RECIPIENT` — **public** key; safe on the server. `AGE_IDENTITY` — private
  key for the automated weekly drill only (ACM var); the quarterly **manual**
  drill supplies the off-server key via `AGE_IDENTITY_FILE` instead.
- `HEARTBEAT_BACKUP_URL` / `HEARTBEAT_DRILL_URL`.
- `DRILL_PGPASSWORD` — the throwaway db-drill server's password.

## Provisioning checklist (needs real secrets — do at deploy time)

1. Create the R2 bucket with **object-lock ON**, in an account **separate** from
   the age-key store. Mint two scoped tokens (write+list, read-only).
2. Generate the age keypair (`age-keygen`). Put **only the public key** in
   `AGE_RECIPIENT`. Store the private key in a password manager **and** a
   physical off-site copy — never on the server (except `AGE_IDENTITY` for the
   automated drill, if you opt into it).
3. Create the two healthchecks.io checks; set their ping URLs.
4. Apply [`backup-role.sql`](backup-role.sql) to prod, set `BACKUP_DB_PASSWORD`.
5. Deploy; watch the first `02:00`/`14:00` backups and the Sunday `04:00` drill.
   Soak 48h under observation before declaring Phase 1B live (§12.6).

## Local verification (no real secrets)

`staging/run-tests.sh` runs the approved §10 table against a local **MinIO**
stand-in for R2 and an ephemeral age keypair. Rows that genuinely need hosted R2
or hosted healthchecks.io are reported **CANNOT-LOCAL / PARTIAL** (with the
reason) rather than skipped:

```
bash docker/db-backup/staging/run-tests.sh
```

Current local status: 7 PASS · 2 PARTIAL · 1 CANNOT-LOCAL —

- **PARTIAL — Off-server-key recovery:** the crypto half is proven locally
  (restores with only the isolated private key); the human off-server-custody
  rehearsal is the manual quarterly drill (prod §11.6).
- **PARTIAL — Scheduler:** supercronic validates the crontab locally; the 48h
  drift soak is a prod-under-observation item (§12.6).
- **CANNOT-LOCAL — Dead-man's switch:** observing a *missed-ping* alert needs the
  hosted healthchecks.io monitor; locally only the ping call is exercisable
  (DRY-RUN). Covered by the Phase 0 hosted rehearsal + prod §11.6.
