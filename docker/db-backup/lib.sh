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

# ── offsite destination: EXPLICIT opt-out only ────────────────────────────────
# Default is 1 (offsite required) — this is the one place a missing S3 destination
# must NOT silently degrade to "well, local is fine". An operator who wants
# local-only (no offsite target provisioned yet) must say so on purpose by setting
# BACKUP_OFFSITE=0; leaving the S3 vars blank with BACKUP_OFFSITE unset (or =1) is
# still a hard error. See require_backup_config() and README "Local-only mode".
: "${BACKUP_OFFSITE:=1}"
offsite_enabled() { [ "${BACKUP_OFFSITE}" != "0" ]; }

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
  # ── R2-specific flags: READY BUT UNAPPLIED (see README "R2 rehearsal watch") ──
  # The code is provider-agnostic; these are needed ONLY if the Phase 0 rehearsal
  # shows R2 misbehaving. Enable per symptom by moving the line into the printf
  # above (append as an extra "…" argument):
  #   • post-upload `rclone size` verify returns stale/empty  →  --s3-no-head
  #   • large dumps stall or error on multipart upload        →  --s3-upload-cutoff=200M
  # Left off deliberately: adding them speculatively would mask a real problem and
  # they may be unnecessary. MinIO can't reproduce either symptom, so this is a
  # rehearsal decision, not a code default.
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

# ── heartbeat preflight: refuse to run the scheduler blind ────────────────────
# The dead-man's switch is the whole point of this sidecar — alerting fires on the
# ABSENCE of a success ping. If a heartbeat URL is blank, ping() silently DRY-RUNs
# (logs, does not send), so a monitor would never learn the backups had stopped.
# Shipping the long-running scheduler in that state is the one failure mode we must
# not allow, so it fails closed. One-shot roles (manual/staging runs, which are
# deliberate) get a loud warning and continue. ALLOW_HEARTBEAT_DRYRUN=1 is an
# explicit, logged opt-out for intentional pre-provisioning bring-up.
heartbeat_preflight() {
  local role="${1:-}" blanks=()
  [ -n "${HEARTBEAT_BACKUP_URL:-}" ] || blanks+=(HEARTBEAT_BACKUP_URL)
  [ -n "${HEARTBEAT_DRILL_URL:-}" ]  || blanks+=(HEARTBEAT_DRILL_URL)
  if [ ${#blanks[@]} -eq 0 ]; then
    log "heartbeat preflight OK — dead-man's-switch URLs set (backup + drill)"
    return 0
  fi
  log "################################################################"
  log "# HEARTBEAT NOT CONFIGURED (${blanks[*]}) — DEAD-MAN'S SWITCH OFF"
  log "# Pings are DRY-RUN (logged, not sent). If backups stop, NO alert fires."
  log "################################################################"
  if [ "$role" = "scheduler" ] && [ "${ALLOW_HEARTBEAT_DRYRUN:-}" != "1" ]; then
    die "refusing to start the scheduler with the dead-man's switch disabled — set HEARTBEAT_BACKUP_URL + HEARTBEAT_DRILL_URL (or ALLOW_HEARTBEAT_DRYRUN=1 to override deliberately)"
  fi
  log "WARN continuing without heartbeats (role=${role}${ALLOW_HEARTBEAT_DRYRUN:+, ALLOW_HEARTBEAT_DRYRUN=1 set})"
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

# ── manifest + keyless verification (off-server-key model, "Option C") ────────
# The private key never lives on this host, so the WEEKLY drill cannot decrypt.
# To still prove more than "an object exists", the backup job writes a PLAINTEXT
# metadata manifest next to each .age object, and verify-offsite.sh checks the
# ciphertext against it WITHOUT the key. The manifest carries only metadata —
# table names, row counts, sizes, a checksum — NEVER row values.
#
# Trust boundary (stated honestly): the manifest is a pipeline-attested
# OPERATIONAL aid, not a security control. A host that can forge a backup can
# forge its manifest, so this catches operational failure (job stopped, 0-byte
# or truncated upload, wrong recipient, checksum drift, row regression), not a
# motivated attacker who already owns the box. The authoritative proof that the
# ciphertext decrypts and restores is the QUARTERLY manual drill (off-server key).

# Object key for the manifest that accompanies an .age object key.
manifest_key() { printf '%s.manifest.json' "$1"; }

: "${MANIFEST_TABLES:=users children words stories child_word_progress story_pages _migrations}"

sha256_of() { sha256sum "$1" | cut -d' ' -f1; }

# Fingerprint of the age recipient (public key). Lets the drill confirm a backup
# was addressed to the EXPECTED recipient without the private key. With X25519 the
# recipient pubkey is not recoverable from the age header by design, so this is an
# intent/config-match check (catches a wrong or rotated recipient); the header
# check verifies stanza TYPE and COUNT cryptographically.
age_recipient_fpr() { printf '%s' "${1:-$AGE_RECIPIENT}" | sha256sum | cut -c1-16; }

# Inspect an age HEADER only (first bytes of the file) — no decryption. Verifies
# the v1 magic, that recipient stanzas are the expected type and exact count, and
# that there is NO scrypt (passphrase) stanza. $1=header-file $2=type(def X25519)
# $3=count(def 1).
age_header_ok() {
  local hdr="$1" want_type="${2:-X25519}" want_n="${3:-1}" first n
  IFS= read -r first < "$hdr" || return 1
  [ "$first" = "age-encryption.org/v1" ] || { log "age header: bad magic ('${first}')"; return 1; }
  if grep -qE '^-> +scrypt ' "$hdr"; then log "age header: scrypt (passphrase) stanza present — unexpected"; return 1; fi
  n="$(grep -cE "^-> +${want_type} " "$hdr" || true)"
  [ "$n" = "$want_n" ] || { log "age header: expected ${want_n} ${want_type} stanza(s), found ${n}"; return 1; }
  return 0
}

# Read a top-level scalar ("key": "val"  or  "key": 123) from a manifest file.
manifest_get() {  # <file> <key>
  grep -oE "\"$2\"[[:space:]]*:[[:space:]]*\"?[^,\"}]*" "$1" | head -n1 | sed -E "s/.*:[[:space:]]*\"?//"
}
# Read a per-table row count from the manifest's "rows" object ("table": N).
manifest_row() { grep -oE "\"$2\"[[:space:]]*:[[:space:]]*[0-9]+" "$1" | head -n1 | grep -oE '[0-9]+$'; }

# ── preflight: fail loudly and early if config is incoherent ─────────────────
# offsite_enabled(): the S3 destination is required, same as always.
# BACKUP_OFFSITE=0 (explicit opt-out, see above): S3 vars are NOT required, but
# the encryption identity + DB credential still are — local-only still means
# "encrypted local retention", never "unencrypted, unattended".
require_backup_config() {
  local missing=()
  if offsite_enabled; then
    [ -n "$BACKUP_S3_ENDPOINT" ] || missing+=(BACKUP_S3_ENDPOINT)
    [ -n "$BACKUP_BUCKET" ]      || missing+=(BACKUP_BUCKET)
    [ -n "$BACKUP_KEY_ID" ]      || missing+=(BACKUP_KEY_ID)
    [ -n "$BACKUP_KEY_SECRET" ]  || missing+=(BACKUP_KEY_SECRET)
  fi
  [ -n "$AGE_RECIPIENT" ]      || missing+=(AGE_RECIPIENT)
  [ -n "${PGPASSWORD:-}" ]     || missing+=(PGPASSWORD)
  [ ${#missing[@]} -eq 0 ] || die "missing required config: ${missing[*]}$(offsite_enabled || printf ' (BACKUP_OFFSITE=0 — offsite creds not required, but these still are)')"
  mkdir -p "$STAGING_DIR"
}

# Full decrypt→restore drill (quarterly, manual). Needs the read credential AND
# an off-server identity (AGE_IDENTITY_FILE, or AGE_IDENTITY for local staging
# tests only). AGE_IDENTITY is deliberately NOT a production input.
require_restore_config() {
  local missing=()
  [ -n "$BACKUP_S3_ENDPOINT" ] || missing+=(BACKUP_S3_ENDPOINT)
  [ -n "$BACKUP_BUCKET" ]      || missing+=(BACKUP_BUCKET)
  [ -n "$RESTORE_KEY_ID" ]     || missing+=(RESTORE_KEY_ID)
  [ -n "$RESTORE_KEY_SECRET" ] || missing+=(RESTORE_KEY_SECRET)
  [ ${#missing[@]} -eq 0 ] || die "missing required config: ${missing[*]}"
  mkdir -p "$STAGING_DIR"
}

# Keyless weekly verification. Read credential + the recipient PUBLIC key only —
# NEVER the private key. Live DB is optional (used for row/size sanity vs live).
require_verify_config() {
  local missing=()
  [ -n "$BACKUP_S3_ENDPOINT" ] || missing+=(BACKUP_S3_ENDPOINT)
  [ -n "$BACKUP_BUCKET" ]      || missing+=(BACKUP_BUCKET)
  [ -n "$RESTORE_KEY_ID" ]     || missing+=(RESTORE_KEY_ID)
  [ -n "$RESTORE_KEY_SECRET" ] || missing+=(RESTORE_KEY_SECRET)
  [ -n "$AGE_RECIPIENT" ]      || missing+=(AGE_RECIPIENT)
  [ ${#missing[@]} -eq 0 ] || die "missing required config: ${missing[*]}"
  mkdir -p "$STAGING_DIR"
}
