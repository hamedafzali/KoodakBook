#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# db-backup — the BACKUP job (approved plan §5)
#
#   dump → integrity pre-check → age-encrypt → upload → verify → retain → ping
#
# Fail-closed at every step: any failure exits non-zero, sends a FAIL ping, and
# — critically — never sends the SUCCESS ping. Absence of the success ping is
# what the healthchecks.io dead-man's switch alerts on.
#
# Modes:
#   backup                       scheduled full dump (supercronic calls this)
#   backup --label <label>       on-demand labelled dump; prints
#                                "VERIFIED_OFFSITE <key>" on success so Item 2's
#                                pre-migration hook can block on a real restore
#                                point. (Hook point built now, wired in Item 2.)
# ─────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

LABEL=""
while [ $# -gt 0 ]; do
  case "$1" in
    --label) LABEL="${2:?--label needs a value}"; shift 2 ;;
    *) die "unknown argument: $1" ;;
  esac
done

require_backup_config

TS="$(date -u '+%Y%m%dT%H%M%SZ')"
if [ -n "$LABEL" ]; then NAME="${BACKUP_PREFIX}-${TS}-${LABEL}.dump"
else                     NAME="${BACKUP_PREFIX}-${TS}.dump"; fi
DUMP="${STAGING_DIR}/${NAME}"
ENC="${DUMP}.age"
METRICS="${STAGING_DIR}/backup_metrics.log"

# On any error, shred any plaintext, fire the FAIL ping, exit non-zero.
on_err() {
  local code=$?
  shred_file "$DUMP"
  ping backup fail "backup ${NAME} FAILED (exit ${code})"
  log "backup failed (exit ${code})"
  exit "$code"
}
trap on_err ERR

ping backup start "${NAME}"
log "starting backup ${NAME} (host=${PGHOST} db=${PGDATABASE} role=${PGUSER})"

# 1+2. Dump — custom format (compressed, selective/parallel restore capable).
log "pg_dump -Fc → ${DUMP}"
pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -Fc -f "$DUMP"

# 3. Integrity pre-check BEFORE we trust it — catches a truncated/corrupt dump.
log "integrity pre-check (pg_restore --list)"
OBJ_COUNT="$(pg_restore --list "$DUMP" | grep -cvE '^;|^$' || true)"
[ "${OBJ_COUNT:-0}" -gt 0 ] || die "pg_restore --list found no objects — dump looks empty/corrupt"
log "dump lists ${OBJ_COUNT} objects"

# 7. Row-count sanity number (cheap signal a dump captured real data). Uses the
#    same least-privilege role. Not fatal if it can't run — dump integrity is
#    the load-bearing check; this only feeds the anomaly ping.
ROWS="$(PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
        -tAc "select coalesce((select count(*) from children),0) + coalesce((select count(*) from child_word_progress),0)" 2>/dev/null || echo 0)"
ROWS="$(printf '%s' "$ROWS" | tr -dc '0-9')"; ROWS="${ROWS:-0}"

# 4. Encrypt (everything is encrypted, including local copies) then shred plaintext.
log "age-encrypt → ${ENC}"
age_encrypt "$DUMP" "$ENC"
shred_file "$DUMP"
SIZE="$(stat -c %s "$ENC" 2>/dev/null || wc -c < "$ENC")"

# 5. Upload, then verify the remote object actually exists at the right size.
KEY="$(date -u '+%Y/%m/%d')/${NAME}.age"
log "upload → $(store_path "$KEY")"
rclone_do write copyto "$ENC" "$(store_path "$KEY")"
REMOTE_SIZE="$(rclone_do write size "$(store_path "$KEY")" --json 2>/dev/null | grep -oE '"bytes":[0-9]+' | grep -oE '[0-9]+' || echo 0)"
[ "$REMOTE_SIZE" = "$SIZE" ] || die "remote size ${REMOTE_SIZE} != local ${SIZE} — upload not verified"
log "upload verified (${SIZE} bytes offsite at ${KEY})"

# 6. Local retention — keep the last N encrypted copies (encrypted, per decision).
#    Never keep the labelled on-demand dumps in the rotation.
ls -1t "${STAGING_DIR}/${BACKUP_PREFIX}-"*.dump.age 2>/dev/null \
  | grep -vE -- '-pre-migrate-|-manual-' \
  | tail -n +"$((LOCAL_KEEP + 1))" \
  | while IFS= read -r old; do log "prune local ${old##*/}"; rm -f "$old"; done || true

# 7b. Record metrics + anomaly check (belt-and-suspenders on top of the dead-man's switch).
printf '%s\t%s\t%s\n' "$TS" "$SIZE" "$ROWS" >> "$METRICS"
ANOMALY=""
MEDIAN="$(awk -F'\t' '{print $2}' "$METRICS" | tail -n 8 | head -n 7 | sort -n | awk '{a[NR]=$1} END{if(NR)print a[int((NR+1)/2)]}')"
if [ -n "${MEDIAN:-}" ] && [ "$MEDIAN" -gt 0 ]; then
  # size dropped more than ANOMALY_DROP_PCT vs trailing-7 median?
  if [ "$(( SIZE * 100 ))" -lt "$(( MEDIAN * (100 - ANOMALY_DROP_PCT) ))" ]; then
    ANOMALY="size ${SIZE}B is >${ANOMALY_DROP_PCT}% below trailing median ${MEDIAN}B"
  fi
fi
PREV_ROWS="$(awk -F'\t' '{print $3}' "$METRICS" | tail -n 2 | head -n 1)"
if [ -n "${PREV_ROWS:-}" ] && [ "$ROWS" -lt "$PREV_ROWS" ]; then
  ANOMALY="${ANOMALY:+$ANOMALY; }row-count regressed ${PREV_ROWS} → ${ROWS}"
fi

PAYLOAD="name=${NAME} size=${SIZE}B objects=${OBJ_COUNT} rows=${ROWS} key=${KEY}"
if [ -n "$ANOMALY" ]; then
  # Job technically succeeded (verified offsite) but the data smells wrong:
  # this is exactly the "ran but captured a truncated DB" signature. Fail LOUD.
  log "ANOMALY: ${ANOMALY}"
  ping backup fail "backup ${NAME} succeeded but ANOMALY: ${ANOMALY} | ${PAYLOAD}"
else
  ping backup success "$PAYLOAD"
fi

# On-demand contract: emit the verified-offsite marker Item 2 will parse/block on.
if [ -n "$LABEL" ]; then echo "VERIFIED_OFFSITE ${KEY}"; fi
log "backup ${NAME} complete"
trap - ERR
