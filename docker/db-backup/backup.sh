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
bkp_psql() { PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -tAc "$1" 2>/dev/null; }
ROWS="$(bkp_psql "select coalesce((select count(*) from children),0) + coalesce((select count(*) from child_word_progress),0)" || echo 0)"
ROWS="$(printf '%s' "$ROWS" | tr -dc '0-9')"; ROWS="${ROWS:-0}"

# 7a. Per-table metadata for the manifest sidecar (the weekly keyless drill reads
#     this instead of decrypting). METADATA ONLY — table names + row counts,
#     never row values. Best-effort: a missing table counts as 0, not fatal.
TABLE_LIST="$(bkp_psql "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1" | tr -d '\r')"
TABLES_JSON="$(printf '%s\n' "$TABLE_LIST" | awk 'NF{a[++n]=$0} END{for(i=1;i<=n;i++) printf "%s\"%s\"",(i>1?",":""),a[i]}')"
ROWS_JSON=""; ROWS_TOTAL=0
for t in $MANIFEST_TABLES; do
  c="$(bkp_psql "select count(*) from \"$t\"" | tr -dc '0-9')"; c="${c:-0}"
  ROWS_JSON="${ROWS_JSON:+$ROWS_JSON,}\"${t}\":${c}"
  ROWS_TOTAL=$(( ROWS_TOTAL + c ))
done

# 4. Encrypt (everything is encrypted, including local copies) then shred plaintext.
log "age-encrypt → ${ENC}"
age_encrypt "$DUMP" "$ENC"
DUMP_BYTES="$(stat -c %s "$DUMP" 2>/dev/null || wc -c < "$DUMP")"   # capture BEFORE shred
shred_file "$DUMP"
SIZE="$(stat -c %s "$ENC" 2>/dev/null || wc -c < "$ENC")"
SHA="$(sha256_of "$ENC")"

# 5. Upload, then verify the remote object actually exists at the right size.
#    LOCAL-ONLY MODE (BACKUP_OFFSITE=0): no offsite destination is provisioned
#    yet. The encrypted object and its manifest stay ONLY on the backup_staging
#    volume — same disk as postgres_data (see README "Local-only mode" for the
#    sharp edge). Every log line and the heartbeat payload say LOCAL-ONLY loudly;
#    this must never read like a normal, offsite-verified backup.
KEY="$(date -u '+%Y/%m/%d')/${NAME}.age"
if offsite_enabled; then
  log "upload → $(store_path "$KEY")"
  rclone_do write copyto "$ENC" "$(store_path "$KEY")"
  REMOTE_SIZE="$(rclone_do write size "$(store_path "$KEY")" --json 2>/dev/null | grep -oE '"bytes":[0-9]+' | grep -oE '[0-9]+' || echo 0)"
  [ "$REMOTE_SIZE" = "$SIZE" ] || die "remote size ${REMOTE_SIZE} != local ${SIZE} — upload not verified"
  log "upload verified (${SIZE} bytes offsite at ${KEY})"
else
  log "############################################################"
  log "# LOCAL-ONLY MODE (BACKUP_OFFSITE=0) — NOT SHIPPED OFFSITE  #"
  log "# ${ENC##*/} exists ONLY on backup_staging (same disk as    #"
  log "# postgres_data). Does not survive disk failure, theft,     #"
  log "# ransomware, or volume deletion. See README.                #"
  log "############################################################"
fi

# 5b. Manifest — plaintext metadata sidecar next to the .age (off-server-key
#     model). Lets the weekly keyless drill sanity-check the ciphertext (recipient,
#     checksum, sizes, row counts) WITHOUT the private key. Offsite: uploaded +
#     verified before the success ping, so a missing/failed manifest fails the
#     backup. Local-only: written next to the .age on backup_staging instead, for
#     verify-local.sh to read.
MKEY="$(manifest_key "$KEY")"
# Local filename MUST be `${ENC basename}.manifest.json` (i.e. NAME.dump.age.manifest.json),
# not NAME.manifest.json — retention pruning (step 6, `rm -f "$old" "${old}.manifest.json"`
# where $old is a .dump.age path) and verify-local.sh (`MAN="${LATEST}.manifest.json"`,
# same convention) both derive the manifest path from the .age file's own name. Offsite
# naming (MKEY, above) is independent and unaffected — this only matters for what
# survives on backup_staging in local-only mode.
MANIFEST="${STAGING_DIR}/${ENC##*/}.manifest.json"
{
  printf '{\n'
  printf '  "schema_version": 1,\n'
  printf '  "name": "%s",\n'                "$NAME"
  printf '  "key": "%s",\n'                 "$KEY"
  printf '  "ts": "%s",\n'                  "$TS"
  printf '  "age_recipient_fpr": "%s",\n'   "$(age_recipient_fpr)"
  printf '  "plaintext_dump_bytes": %s,\n'  "$DUMP_BYTES"
  printf '  "ciphertext_bytes": %s,\n'      "$SIZE"
  printf '  "ciphertext_sha256": "%s",\n'   "$SHA"
  printf '  "object_count": %s,\n'          "${OBJ_COUNT:-0}"
  printf '  "rows_total": %s,\n'            "$ROWS_TOTAL"
  printf '  "rows": {%s},\n'                "$ROWS_JSON"
  printf '  "tables": [%s]\n'               "$TABLES_JSON"
  printf '}\n'
} > "$MANIFEST"
if offsite_enabled; then
  log "upload manifest → $(store_path "$MKEY")"
  rclone_do write copyto "$MANIFEST" "$(store_path "$MKEY")"
  MREMOTE="$(rclone_do write size "$(store_path "$MKEY")" --json 2>/dev/null | grep -oE '"bytes":[0-9]+' | grep -oE '[0-9]+' || echo 0)"
  MLOCAL="$(stat -c %s "$MANIFEST" 2>/dev/null || wc -c < "$MANIFEST")"
  [ "$MREMOTE" = "$MLOCAL" ] || die "manifest upload not verified (remote ${MREMOTE} != local ${MLOCAL})"
  rm -f "$MANIFEST"
  log "manifest verified offsite (${MLOCAL} bytes at ${MKEY})"
else
  log "manifest written locally (LOCAL-ONLY, not shipped offsite) → ${MANIFEST##*/}"
fi

# 6. Local retention — keep the last N encrypted copies (encrypted, per decision).
#    Never keep the labelled on-demand dumps in the rotation. Local-only mode
#    accumulates a .manifest.json next to each .age (§5b) — prune those in step
#    with their .age so they don't pile up forever on backup_staging.
ls -1t "${STAGING_DIR}/${BACKUP_PREFIX}-"*.dump.age 2>/dev/null \
  | grep -vE -- '-pre-migrate-|-manual-' \
  | tail -n +"$((LOCAL_KEEP + 1))" \
  | while IFS= read -r old; do
      log "prune local ${old##*/}"; rm -f "$old" "${old}.manifest.json"
    done || true

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

# The heartbeat payload must reflect reality: a LOCAL-ONLY tag on the SAME
# success ping (not a separate, easy-to-miss channel) so hc.io's own history/log
# shows this run never left the host, not just "backup succeeded".
OFFSITE_TAG=""; offsite_enabled || OFFSITE_TAG=" [LOCAL-ONLY — NOT shipped offsite]"
PAYLOAD="name=${NAME} size=${SIZE}B objects=${OBJ_COUNT} rows=${ROWS} key=${KEY} manifest=${MKEY}${OFFSITE_TAG}"
if [ -n "$ANOMALY" ]; then
  # Job technically succeeded (verified offsite, or locally if BACKUP_OFFSITE=0)
  # but the data smells wrong: this is exactly the "ran but captured a truncated
  # DB" signature. Fail LOUD.
  log "ANOMALY: ${ANOMALY}"
  ping backup fail "backup ${NAME} succeeded but ANOMALY: ${ANOMALY} | ${PAYLOAD}"
else
  ping backup success "$PAYLOAD"
fi

# On-demand contract: emit the verified-offsite marker Item 2's future pre-migrate
# hook will parse and block on, treating its presence as proof a real *offsite*
# restore point exists before letting a destructive migration proceed.
#
# DELIBERATELY WITHHELD IN LOCAL-ONLY MODE (BACKUP_OFFSITE=0). A local-only copy
# living on backup_staging — the SAME disk as postgres_data — is not a restore
# point a destructive-migration gate can trust: a disk failure that takes the DB
# also takes the "backup". Emitting VERIFIED_OFFSITE here would let that hook
# wave a migration through on a copy that cannot survive the failure mode it
# exists to guard against. DO NOT "helpfully" re-enable this for local-only —
# it must only ever fire once bytes have actually left this host and been
# verified there (see the `offsite_enabled` branch above, §5).
if [ -n "$LABEL" ] && offsite_enabled; then echo "VERIFIED_OFFSITE ${KEY}"; fi
log "backup ${NAME} complete${OFFSITE_TAG}"
trap - ERR
