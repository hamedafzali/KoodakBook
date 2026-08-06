#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# db-backup — shared library
#
# Sourced by backup.sh and restore-drill.sh. Holds logging, the rclone remote
# builder (driven entirely from env — no committed rclone.conf), age helpers,
# and the healthchecks.io heartbeat pings.
#
# Design rules baked in here (from the approved Phase 1B plan):
#   • Fail-closed: callers run under `set -Eeuo pipefail`; a success ping is
#     only ever sent after every step has verified. Absence of a ping is the
#     alert (dead-man's switch), so we must never ping on a half-done job.
#   • Encrypt-everywhere: the plaintext dump exists only transiently on the
#     staging volume and is shredded the moment it is encrypted. Nothing
#     unencrypted is ever kept or uploaded.
#   • Least privilege: the backup path uses the write/list credential; the
#     restore path uses a separate read credential. They are different env vars
#     so a leaked backup key cannot read history and vice-versa.
#   • DRY-RUN: with no heartbeat URL set, pings are logged not sent (mirrors the
#     Phase 0 alerting convention) so the image is safe to run before the real
#     R2 + healthchecks accounts exist.
# ─────────────────────────────────────────────────────────────────────────────

# No rclone.conf ships in this image — all remotes come from --s3-* flags. Point
# rclone at /dev/null so it doesn't log a "config not found" notice every call.
export RCLONE_CONFIG="${RCLONE_CONFIG:-/dev/null}"

# ── logging ──────────────────────────────────────────────────────────────────
log()  { printf '%s [db-backup] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }
die()  { log "FATAL: $*"; exit 1; }

# Names of env vars that must never be echoed, for the redacted-env dump below.
_SECRET_KEYS='BACKUP_KEY_SECRET RESTORE_KEY_SECRET AGE_IDENTITY BACKUP_TRIGGER_SECRET PGPASSWORD'

# ── config from environment ──────────────────────────────────────────────────
# Generic S3-compatible knobs so the SAME script targets Cloudflare R2 in prod
# and a local MinIO in staging — only these values change.
: "${BACKUP_S3_ENDPOINT:=}"          # e.g. https://<acct>.r2.cloudflarestorage.com  |  http://minio:9000
: "${BACKUP_S3_PROVIDER:=Other}"     # rclone s3 provider: Cloudflare (R2) | Minio | Other
: "${BACKUP_S3_REGION:=auto}"        # R2 = auto
: "${BACKUP_BUCKET:=}"               # bucket name
: "${BACKUP_PREFIX:=koodakbook}"     # key prefix; staging uses a distinct prefix
: "${BACKUP_KEY_ID:=}"               # write+list credential
: "${BACKUP_KEY_SECRET:=}"
: "${RESTORE_KEY_ID:=}"              # read credential (restore-drill only)
: "${RESTORE_KEY_SECRET:=}"

: "${AGE_RECIPIENT:=}"               # age public key — encryption. Safe on server.
: "${AGE_IDENTITY:=}"                # age private key CONTENTS (machine drill only).
: "${AGE_IDENTITY_FILE:=}"           # …or a path to it (e.g. off-server key mount).

: "${HEARTBEAT_BACKUP_URL:=}"        # healthchecks.io check URL for the backup job
: "${HEARTBEAT_DRILL_URL:=}"         # …and for the restore-drill job

: "${PGHOST:=db}"; : "${PGPORT:=5432}"; : "${PGDATABASE:=koodakbook}"
: "${PGUSER:=backup}"                 # least-privilege role (pg_read_all_data)
# PGPASSWORD is passed straight through to pg_dump/pg_restore/psql.

: "${STAGING_DIR:=/staging}"          # writable volume for the transient dump + local .age copies
: "${LOCAL_KEEP:=2}"                  # number of encrypted local copies to retain
: "${ANOMALY_DROP_PCT:=40}"           # size-drop % vs trailing median that trips an anomaly ping

# ── rclone remote, built from env (no config file with secrets on disk) ───────
# Emits the --s3-* flags that configure the on-the-fly `:s3:` backend. The
# remote PATH itself (":s3:bucket/…") is passed as an argument by the caller,
# never here. $1 = role: write|read.
rclone_remote_flags() {
  local role="$1" key secret
  if [ "$role" = "read" ]; then key="$RESTORE_KEY_ID"; secret="$RESTORE_KEY_SECRET"
  else                          key="$BACKUP_KEY_ID";  secret="$BACKUP_KEY_SECRET"; fi
  printf '%s\0' \
    "--s3-provider=${BACKUP_S3_PROVIDER}" \
    "--s3-endpoint=${BACKUP_S3_ENDPOINT}" \
    "--s3-region=${BACKUP_S3_REGION}" \
    "--s3-access-key-id=${key}" \
    "--s3-secret-access-key=${secret}" \
    "--s3-acl=private" \
    "--s3-no-check-bucket"
}

# rclone <role> <rclone-subcommand> [args…]  — remote path is "store:" mapped to :s3:bucket
rclone_do() {
  local role="$1"; shift
  local -a flags=()
  # shellcheck disable=SC2016
  while IFS= read -r -d '' f; do flags+=("$f"); done < <(rclone_remote_flags "$role")
  rclone "${flags[@]}" "$@"
}

# Absolute bucket path for an object key.
store_path() { printf ':s3:%s/%s/%s' "$BACKUP_BUCKET" "$BACKUP_PREFIX" "$1"; }

# ── heartbeat (healthchecks.io) ──────────────────────────────────────────────
# ping <backup|drill> <start|success|fail> [payload]
ping() {
  local which="$1" state="$2" payload="${3:-}" url=""
  case "$which" in
    backup) url="$HEARTBEAT_BACKUP_URL" ;;
    drill)  url="$HEARTBEAT_DRILL_URL"  ;;
  esac
  if [ -z "$url" ]; then
    log "DRY-RUN heartbeat[$which/$state]${payload:+ — $payload}"
    return 0
  fi
  local target="$url"
  case "$state" in
    start)   target="$url/start" ;;
    fail)    target="$url/fail"  ;;
    success) target="$url"       ;;
  esac
  # Best-effort, short timeout. A missed/failed ping is itself the alert, so a
  # heartbeat network blip must NOT abort the job (see behaviour note in README).
  if curl -fsS -m 10 --retry 3 --data-raw "${payload:-}" "$target" >/dev/null 2>&1; then
    log "heartbeat[$which/$state] sent"
  else
    log "WARN heartbeat[$which/$state] could not be delivered (monitor unreachable) — continuing"
  fi
}

# ── age helpers ──────────────────────────────────────────────────────────────
age_encrypt() {  # age_encrypt <plaintext> <out.age>
  [ -n "$AGE_RECIPIENT" ] || die "AGE_RECIPIENT unset — refusing to write an unencrypted backup"
  age -r "$AGE_RECIPIENT" -o "$2" "$1"
}

# Resolve the identity (private key) file for decryption, or die.
age_identity_file() {
  if [ -n "$AGE_IDENTITY_FILE" ] && [ -f "$AGE_IDENTITY_FILE" ]; then
    printf '%s' "$AGE_IDENTITY_FILE"; return 0
  fi
  if [ -n "$AGE_IDENTITY" ]; then
    local f; f="$(mktemp)"; printf '%s\n' "$AGE_IDENTITY" > "$f"; chmod 600 "$f"
    printf '%s' "$f"; return 0
  fi
  die "no age identity available (set AGE_IDENTITY or AGE_IDENTITY_FILE) — cannot decrypt"
}

age_decrypt() {  # age_decrypt <in.age> <out-plaintext>
  local id; id="$(age_identity_file)"
  age -d -i "$id" -o "$2" "$1"
}

# Overwrite-then-remove a plaintext file so no unencrypted dump lingers.
shred_file() { [ -f "$1" ] && { dd if=/dev/zero of="$1" bs=64k count=1 conv=notrunc 2>/dev/null || true; rm -f "$1"; }; }

# ── preflight: fail loudly and early if config is incoherent ─────────────────
require_backup_config() {
  local missing=()
  [ -n "$BACKUP_S3_ENDPOINT" ] || missing+=(BACKUP_S3_ENDPOINT)
  [ -n "$BACKUP_BUCKET" ]      || missing+=(BACKUP_BUCKET)
  [ -n "$BACKUP_KEY_ID" ]      || missing+=(BACKUP_KEY_ID)
  [ -n "$BACKUP_KEY_SECRET" ]  || missing+=(BACKUP_KEY_SECRET)
  [ -n "$AGE_RECIPIENT" ]      || missing+=(AGE_RECIPIENT)
  [ -n "${PGPASSWORD:-}" ]     || missing+=(PGPASSWORD)
  [ ${#missing[@]} -eq 0 ] || die "missing required config: ${missing[*]}"
  mkdir -p "$STAGING_DIR"
}

require_restore_config() {
  local missing=()
  [ -n "$BACKUP_S3_ENDPOINT" ] || missing+=(BACKUP_S3_ENDPOINT)
  [ -n "$BACKUP_BUCKET" ]      || missing+=(BACKUP_BUCKET)
  [ -n "$RESTORE_KEY_ID" ]     || missing+=(RESTORE_KEY_ID)
  [ -n "$RESTORE_KEY_SECRET" ] || missing+=(RESTORE_KEY_SECRET)
  [ ${#missing[@]} -eq 0 ] || die "missing required config: ${missing[*]}"
  mkdir -p "$STAGING_DIR"
}
