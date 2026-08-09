#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# db-backup — the WEEKLY KEYLESS verification job (off-server-key model, "C")
#
# The age PRIVATE key does not live on this host, so the weekly drill CANNOT
# decrypt. Instead of "assume it restores", it proves everything about the
# offsite copy that is checkable WITHOUT the key, using the READ credential:
#
#   1. EXISTS         — a fresh, non-labelled .age object is present offsite
#   2. SIZE TREND     — its size is in-band vs the trailing median (not truncated)
#   3. AGE HEADER     — well-formed age v1, exactly the expected recipient stanza
#                       type/count, and NO scrypt (passphrase) stanza
#   4. RECIPIENT      — manifest's recipient fingerprint matches OUR public key
#   5. CHECKSUM+SIZE  — the stored bytes hash to the manifest's sha256 and match
#                       its recorded size (and the remote size) — fully retrievable
#   6. OBJECT LOCK    — retention is in force on the object (best-effort via rclone)
#   7. ROW/SIZE SANITY— manifest row counts clear per-table floors, don't regress
#                       vs the previous manifest, and (if a live DB is reachable)
#                       sit within tolerance of live
#
# What this CANNOT prove — that the ciphertext decrypts to a restorable dump —
# is the job of the QUARTERLY manual drill (restore-drill.sh, off-server key).
# PASS/FAIL is reported on the SAME drill heartbeat, so the dead-man's switch
# still fires if this stops running.
# ─────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

: "${DRILL_ROW_TOLERANCE_PCT:=25}"
: "${DRILL_ROW_FLOORS:=users:1 children:0 words:1 stories:1 child_word_progress:0}"
: "${AGE_STANZA_TYPE:=X25519}"        # recipient type we encrypt to
: "${AGE_STANZA_COUNT:=1}"            # how many recipients each backup is addressed to

require_verify_config

WORK="$(mktemp -d "${STAGING_DIR}/verify.XXXXXX")"
FAILURES=()
REPORT=""
assert() { local ok="$1" msg="$2"; if [ "$ok" = "1" ]; then REPORT+="  PASS  ${msg}"$'\n'; else REPORT+="  FAIL  ${msg}"$'\n'; FAILURES+=("$msg"); fi; }
warn()   { REPORT+="  WARN  ${1}"$'\n'; log "WARN ${1}"; }
live_psql() { PGPASSWORD="${PGPASSWORD:-}" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -tAc "$1" 2>/dev/null; }

cleanup() { rm -rf "$WORK"; }
on_err() {
  local code=$?
  cleanup
  ping drill fail "verify-offsite ERRORED (exit ${code}) before checks completed"
  log "verify-offsite errored (exit ${code})"
  exit "$code"
}
trap on_err ERR

ping drill start "verify-offsite (keyless)"
log "verify-offsite starting (read credential, no private key)"

# ── 1. EXISTS — newest non-labelled .age, with sizes for the trend check ──────
LISTING="$(rclone_do read lsf -R --files-only --format "sp" --separator ";" ":s3:${BACKUP_BUCKET}/${BACKUP_PREFIX}/" \
           | grep -E '\.dump\.age$' | grep -vE -- '-pre-migrate-|-manual-' || true)"
[ -n "$LISTING" ] || die "no offsite backup object found under ${BACKUP_PREFIX}/"
# Sort by path (timestamped keys sort chronologically); newest last.
SORTED="$(printf '%s\n' "$LISTING" | sort -t';' -k2,2)"
LATEST="$(printf '%s\n' "$SORTED" | tail -n1 | cut -d';' -f2-)"
LATEST_SIZE="$(printf '%s\n' "$SORTED" | tail -n1 | cut -d';' -f1)"
assert 1 "latest offsite object present (${LATEST})"
log "latest: ${LATEST} (${LATEST_SIZE}B)"

# ── 2. SIZE TREND — not >ANOMALY_DROP_PCT% below the trailing-7 median ────────
MEDIAN="$(printf '%s\n' "$SORTED" | cut -d';' -f1 | tail -n 8 | head -n 7 | sort -n \
          | awk '{a[NR]=$1} END{if(NR)print a[int((NR+1)/2)]}')"
if [ -n "${MEDIAN:-}" ] && [ "${MEDIAN:-0}" -gt 0 ]; then
  lo=$(( MEDIAN * (100 - ANOMALY_DROP_PCT) / 100 ))
  assert "$([ "${LATEST_SIZE:-0}" -ge "$lo" ] && echo 1 || echo 0)" \
    "size in band (${LATEST_SIZE}B ≥ ${lo}B, median ${MEDIAN}B)"
else
  warn "size trend: not enough history yet (median unavailable) — skipped"
fi

# ── fetch the manifest (read cred) ────────────────────────────────────────────
MKEY="$(manifest_key "$LATEST")"
if rclone_do read copyto "$(store_path "$MKEY")" "${WORK}/manifest.json" 2>/dev/null; then
  assert 1 "manifest present (${MKEY})"
else
  assert 0 "manifest present (${MKEY})"
fi
MAN="${WORK}/manifest.json"

# ── 3. AGE HEADER — well-formed, right stanza type/count, no scrypt ───────────
rclone_do read cat --head 8192 "$(store_path "$LATEST")" > "${WORK}/head.age" 2>/dev/null || true
if [ -s "${WORK}/head.age" ] && age_header_ok "${WORK}/head.age" "$AGE_STANZA_TYPE" "$AGE_STANZA_COUNT"; then
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

# ── 5. CHECKSUM + SIZE — download the object, hash it, match the manifest ─────
if [ -s "$MAN" ]; then
  rclone_do read copyto "$(store_path "$LATEST")" "${WORK}/latest.age"
  GOT_SHA="$(sha256_of "${WORK}/latest.age")"
  GOT_BYTES="$(stat -c %s "${WORK}/latest.age" 2>/dev/null || wc -c < "${WORK}/latest.age")"
  WANT_SHA="$(manifest_get "$MAN" ciphertext_sha256)"
  WANT_BYTES="$(manifest_get "$MAN" ciphertext_bytes)"
  assert "$([ -n "$WANT_SHA" ] && [ "$GOT_SHA" = "$WANT_SHA" ] && echo 1 || echo 0)" \
    "checksum matches manifest (sha256 ${GOT_SHA%%????????*}…)"
  assert "$([ "${GOT_BYTES:-0}" = "${WANT_BYTES:-x}" ] && [ "${GOT_BYTES:-0}" = "${LATEST_SIZE:-y}" ] && echo 1 || echo 0)" \
    "size matches manifest+remote (got=${GOT_BYTES} manifest=${WANT_BYTES} remote=${LATEST_SIZE})"
else
  assert 0 "checksum matches manifest (manifest unreadable)"
fi

# ── 6. OBJECT LOCK — retention in force (best-effort via rclone metadata) ─────
LOCKJSON="$(rclone_do read lsjson --metadata "$(store_path "$LATEST")" 2>/dev/null || true)"
if printf '%s' "$LOCKJSON" | grep -qiE 'object-lock-(mode|retain)|x-amz-object-lock'; then
  # A retain-until in the FUTURE means the object is immutable now.
  RETAIN="$(printf '%s' "$LOCKJSON" | grep -oiE 'retain-until[^"]*"[^"]+"' | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -n1)"
  NOW="$(date -u '+%Y-%m-%d')"
  if [ -n "$RETAIN" ] && [ "$RETAIN" \> "$NOW" ]; then
    assert 1 "object-lock retention in force (until ${RETAIN})"
  else
    assert 0 "object-lock retention in force (retain-until='${RETAIN:-none}')"
  fi
else
  # rclone/R2 may not surface lock headers here; the authoritative check is at
  # provisioning + the quarterly drill. Don't silently pass — flag it.
  warn "object-lock: retention metadata not surfaced by rclone — verify at provisioning + quarterly (§ DR plan)"
fi

# ── 7. ROW/SIZE SANITY from the manifest (floors, regression, optional live) ──
if [ -s "$MAN" ]; then
  # Per-table floors.
  for spec in $DRILL_ROW_FLOORS; do
    tbl="${spec%%:*}"; floor="${spec##*:}"
    mv="$(manifest_row "$MAN" "$tbl")"; mv="${mv:-0}"
    assert "$([ "${mv:-0}" -ge "$floor" ] 2>/dev/null && echo 1 || echo 0)" "manifest ${tbl}=${mv} (floor≥${floor})"
  done
  # Regression vs the PREVIOUS manifest (second-newest object).
  PREV="$(printf '%s\n' "$SORTED" | tail -n2 | head -n1 | cut -d';' -f2-)"
  if [ -n "$PREV" ] && [ "$PREV" != "$LATEST" ] \
     && rclone_do read copyto "$(store_path "$(manifest_key "$PREV")")" "${WORK}/prev.json" 2>/dev/null; then
    CUR_TOT="$(manifest_get "$MAN" rows_total)"; PRE_TOT="$(manifest_get "${WORK}/prev.json" rows_total)"
    assert "$([ "${CUR_TOT:-0}" -ge "${PRE_TOT:-0}" ] 2>/dev/null && echo 1 || echo 0)" \
      "rows_total not regressed (${PRE_TOT:-?} → ${CUR_TOT:-?})"
  else
    warn "no previous manifest to compare — regression check skipped"
  fi
  # Optional: compare to live DB if reachable (proves the backup matches reality).
  if [ -n "${PGPASSWORD:-}" ] && LIVE_MIG="$(live_psql "select 1")" && [ "$LIVE_MIG" = "1" ]; then
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
    warn "live DB not reachable — manifest-vs-live comparison skipped (floors+regression still enforced)"
  fi
else
  assert 0 "row/size sanity (manifest unreadable)"
fi

cleanup
trap - ERR

log "verify-offsite checks:"$'\n'"$REPORT"
if [ "${#FAILURES[@]}" -eq 0 ]; then
  ping drill success "verify-offsite PASS (keyless) — ${LATEST}"$'\n'"$REPORT"
  log "verify-offsite PASS"
else
  ping drill fail "verify-offsite FAIL (${#FAILURES[@]}): ${FAILURES[*]}"$'\n'"$REPORT"
  log "verify-offsite FAIL — ${#FAILURES[@]} check(s) failed"
  exit 1
fi
