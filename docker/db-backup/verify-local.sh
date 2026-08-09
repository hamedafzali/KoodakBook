#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# db-backup — the WEEKLY LOCAL-ONLY verification job (BACKUP_OFFSITE=0)
#
# Stand-in for verify-offsite.sh while no offsite destination is provisioned.
# Same cadence, same heartbeat (HEARTBEAT_DRILL_URL) — so the healthchecks.io
# side needs NO separate check, only the same weekly one. What differs is the
# claim: this can only prove the LOCAL encrypted copy on backup_staging is
# intact. It says nothing about surviving disk failure, theft, ransomware, or
# volume deletion — backup_staging and postgres_data share the same disk. See
# README "Local-only mode" before treating a green run here as more than that.
#
# Checks (all against the local `.dump.age` + `.manifest.json` on STAGING_DIR):
#   1. EXISTS      — a fresh, non-labelled local .age copy is present
#   2. SIZE TREND  — in-band vs the trailing median (backup_metrics.log)
#   3. AGE HEADER  — well-formed age v1, expected recipient stanza, no scrypt
#   4. RECIPIENT   — manifest's recipient fingerprint matches OUR public key
#   5. CHECKSUM+SIZE — local bytes hash to the manifest's sha256 + size
#   6. ROW/SIZE SANITY — manifest row counts clear floors, don't regress
#
# NOT checked (impossible without an offsite target): object-lock retention,
# "is it actually retrievable from somewhere other than this host." Re-enable
# verify-offsite.sh (BACKUP_OFFSITE=1 + real S3 config) to get those back.
# ─────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

: "${DRILL_ROW_TOLERANCE_PCT:=25}"
: "${DRILL_ROW_FLOORS:=users:1 children:0 words:1 stories:1 child_word_progress:0}"
: "${AGE_STANZA_TYPE:=X25519}"
: "${AGE_STANZA_COUNT:=1}"

[ -n "$AGE_RECIPIENT" ] || die "AGE_RECIPIENT unset — cannot verify recipient without it"

FAILURES=()
REPORT=""
assert() { local ok="$1" msg="$2"; if [ "$ok" = "1" ]; then REPORT+="  PASS  ${msg}"$'\n'; else REPORT+="  FAIL  ${msg}"$'\n'; FAILURES+=("$msg"); fi; }
live_psql() { PGPASSWORD="${PGPASSWORD:-}" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -tAc "$1" 2>/dev/null; }

on_err() {
  local code=$?
  ping drill fail "verify-local ERRORED (exit ${code}) before checks completed"
  log "verify-local errored (exit ${code})"
  exit "$code"
}
trap on_err ERR

ping drill start "verify-local (LOCAL-ONLY, no offsite destination provisioned)"
log "verify-local starting — checking backup_staging only (BACKUP_OFFSITE=0)"

# ── 1. EXISTS — newest non-labelled local .age, with sizes for the trend check ─
mapfile -t CANDIDATES < <(ls -1t "${STAGING_DIR}/${BACKUP_PREFIX}-"*.dump.age 2>/dev/null | grep -vE -- '-pre-migrate-|-manual-' || true)
LATEST="${CANDIDATES[0]:-}"
[ -n "$LATEST" ] || die "no local backup found on ${STAGING_DIR} — has backup.sh ever run?"
LATEST_SIZE="$(stat -c %s "$LATEST" 2>/dev/null || wc -c < "$LATEST")"
assert 1 "latest local object present (${LATEST##*/})"
log "latest: ${LATEST##*/} (${LATEST_SIZE}B)"

# ── 2. SIZE TREND — not >ANOMALY_DROP_PCT% below the trailing-7 median ────────
METRICS="${STAGING_DIR}/backup_metrics.log"
if [ -f "$METRICS" ]; then
  MEDIAN="$(awk -F'\t' '{print $2}' "$METRICS" | tail -n 8 | head -n 7 | sort -n | awk '{a[NR]=$1} END{if(NR)print a[int((NR+1)/2)]}')"
else
  MEDIAN=""
fi
if [ -n "${MEDIAN:-}" ] && [ "${MEDIAN:-0}" -gt 0 ]; then
  lo=$(( MEDIAN * (100 - ANOMALY_DROP_PCT) / 100 ))
  assert "$([ "${LATEST_SIZE:-0}" -ge "$lo" ] && echo 1 || echo 0)" \
    "size in band (${LATEST_SIZE}B ≥ ${lo}B, median ${MEDIAN}B)"
else
  log "WARN size trend: not enough history yet (median unavailable) — skipped"
  REPORT+="  WARN  size trend: not enough history yet — skipped"$'\n'
fi

# ── local manifest ─────────────────────────────────────────────────────────
MAN="${LATEST}.manifest.json"
if [ -s "$MAN" ]; then
  assert 1 "manifest present (${MAN##*/})"
else
  assert 0 "manifest present (${MAN##*/})"
fi

# ── 3. AGE HEADER — well-formed, right stanza type/count, no scrypt ───────────
if age_header_ok "$LATEST" "$AGE_STANZA_TYPE" "$AGE_STANZA_COUNT"; then
  assert 1 "age header well-formed (${AGE_STANZA_COUNT}×${AGE_STANZA_TYPE}, no scrypt)"
else
  assert 0 "age header well-formed (${AGE_STANZA_COUNT}×${AGE_STANZA_TYPE}, no scrypt)"
fi

# ── 4. RECIPIENT — manifest fingerprint matches OUR configured public key ─────
if [ -s "$MAN" ]; then
  MAN_FPR="$(manifest_get "$MAN" age_recipient_fpr)"
  OUR_FPR="$(age_recipient_fpr)"
  assert "$([ -n "$MAN_FPR" ] && [ "$MAN_FPR" = "$OUR_FPR" ] && echo 1 || echo 0)" \
    "recipient matches (manifest=${MAN_FPR:-?} ours=${OUR_FPR})"
else
  assert 0 "recipient matches (manifest unreadable)"
fi

# ── 5. CHECKSUM + SIZE — hash the local file, match the manifest ─────────────
if [ -s "$MAN" ]; then
  GOT_SHA="$(sha256_of "$LATEST")"
  WANT_SHA="$(manifest_get "$MAN" ciphertext_sha256)"
  WANT_BYTES="$(manifest_get "$MAN" ciphertext_bytes)"
  assert "$([ -n "$WANT_SHA" ] && [ "$GOT_SHA" = "$WANT_SHA" ] && echo 1 || echo 0)" \
    "checksum matches manifest (sha256 ${GOT_SHA%%????????*}…)"
  assert "$([ "${LATEST_SIZE:-0}" = "${WANT_BYTES:-x}" ] && echo 1 || echo 0)" \
    "size matches manifest (got=${LATEST_SIZE} manifest=${WANT_BYTES})"
else
  assert 0 "checksum matches manifest (manifest unreadable)"
fi

log "NOT CHECKED (impossible without an offsite target): object-lock retention, off-host retrievability — re-enable BACKUP_OFFSITE=1 to restore these"

# ── 6. ROW/SIZE SANITY from the manifest (floors, regression, optional live) ──
if [ -s "$MAN" ]; then
  for spec in $DRILL_ROW_FLOORS; do
    tbl="${spec%%:*}"; floor="${spec##*:}"
    mv="$(manifest_row "$MAN" "$tbl")"; mv="${mv:-0}"
    assert "$([ "${mv:-0}" -ge "$floor" ] 2>/dev/null && echo 1 || echo 0)" "manifest ${tbl}=${mv} (floor≥${floor})"
  done
  PREV="${CANDIDATES[1]:-}"
  if [ -n "$PREV" ] && [ -s "${PREV}.manifest.json" ]; then
    CUR_TOT="$(manifest_get "$MAN" rows_total)"; PRE_TOT="$(manifest_get "${PREV}.manifest.json" rows_total)"
    assert "$([ "${CUR_TOT:-0}" -ge "${PRE_TOT:-0}" ] 2>/dev/null && echo 1 || echo 0)" \
      "rows_total not regressed (${PRE_TOT:-?} → ${CUR_TOT:-?})"
  else
    log "WARN no previous local manifest to compare — regression check skipped"
    REPORT+="  WARN  no previous local manifest to compare — regression check skipped"$'\n'
  fi
  if [ -n "${PGPASSWORD:-}" ] && LIVE_OK="$(live_psql "select 1")" && [ "$LIVE_OK" = "1" ]; then
    for spec in $DRILL_ROW_FLOORS; do
      tbl="${spec%%:*}"
      mv="$(manifest_row "$MAN" "$tbl")"; mv="${mv:-0}"
      lv="$(live_psql "select count(*) from \"$tbl\"" | tr -dc '0-9')"; lv="${lv:-0}"
      within=1
      if [ "${lv:-0}" -gt 0 ]; then
        lo=$(( lv * (100 - DRILL_ROW_TOLERANCE_PCT) / 100 ))
        [ "${mv:-0}" -ge "$lo" ] || within=0
      fi
      assert "$within" "${tbl}: manifest=${mv} vs live=${lv} (within ${DRILL_ROW_TOLERANCE_PCT}%)"
    done
  else
    log "WARN live DB not reachable — manifest-vs-live comparison skipped (floors+regression still enforced)"
    REPORT+="  WARN  live DB not reachable — manifest-vs-live comparison skipped"$'\n'
  fi
else
  assert 0 "row/size sanity (manifest unreadable)"
fi

trap - ERR

log "verify-local checks:"$'\n'"$REPORT"
if [ "${#FAILURES[@]}" -eq 0 ]; then
  ping drill success "verify-local PASS [LOCAL-ONLY — NOT verified offsite] — ${LATEST##*/}"$'\n'"$REPORT"
  log "verify-local PASS (LOCAL-ONLY — this is not an offsite verification)"
else
  ping drill fail "verify-local FAIL (${#FAILURES[@]}): ${FAILURES[*]}"$'\n'"$REPORT"
  log "verify-local FAIL — ${#FAILURES[@]} check(s) failed"
  exit 1
fi
