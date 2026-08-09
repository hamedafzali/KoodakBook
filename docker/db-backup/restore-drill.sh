#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# db-backup — the QUARTERLY MANUAL restore-drill (approved plan §7)
#
# "Tested, not assumed." The full decrypt→restore proof: the ONE place the
# ciphertext is actually decrypted and restored. Under the off-server-key model
# this is human-run (NOT cron) and is supplied ONLY the off-server private key
# via AGE_IDENTITY_FILE — AGE_IDENTITY is never set in production. The WEEKLY
# automated job is keyless (verify-offsite.sh) and does everything EXCEPT decrypt;
# this quarterly run closes that gap and simultaneously rehearses reading the cold
# key from custody (see README "age identity & drills" / DR plan §11.6).
#
#   fetch latest offsite .age (read cred) → decrypt (off-server key) → restore into
#   an isolated scratch database → run assertions → drop scratch → PASS/FAIL heartbeat
#
# ── Deviation from the plan's literal wording, flagged deliberately ───────────
# §7.1 says "spin up an ephemeral postgres:16-alpine container." Doing that from
# INSIDE this sidecar requires mounting the Docker socket — i.e. root on a host
# shared with ~10 projects — which would undo this image's non-root/read-only
# hardening. Instead the drill restores into a freshly-created, uniquely-named
# DATABASE on a dedicated, DATALESS `db-drill` Postgres service (a client
# connection, no socket). The database is created and dropped each run, so it is
# ephemeral; the server process is a small always-on container. This keeps true
# process isolation from prod (a runaway restore cannot touch the prod server)
# without granting the sidecar host-level power. See README "Restore isolation".
# ─────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

# Scratch (drill) Postgres server — dataless restore target.
: "${DRILL_PGHOST:=db-drill}"; : "${DRILL_PGPORT:=5432}"
: "${DRILL_PGUSER:=postgres}"; : "${DRILL_PGADMINDB:=postgres}"
: "${DRILL_PGPASSWORD:?DRILL_PGPASSWORD required}"

# Tolerance band for row-count drift between the ~≤12h-old dump and live (%).
: "${DRILL_ROW_TOLERANCE_PCT:=25}"
# Per-table minimum floors: "table:min table:min …"
: "${DRILL_ROW_FLOORS:=users:1 children:0 words:1 stories:1 child_word_progress:0}"

require_restore_config

WORK="$(mktemp -d "${STAGING_DIR}/drill.XXXXXX")"
SCRATCH_DB="drill_$(date -u '+%Y%m%d%H%M%S')"
FAILURES=()
REPORT=""

drill_psql()  { PGPASSWORD="$DRILL_PGPASSWORD" psql -h "$DRILL_PGHOST" -p "$DRILL_PGPORT" -U "$DRILL_PGUSER" "$@"; }
scratch_psql(){ drill_psql -d "$SCRATCH_DB" -tAc "$1"; }
live_psql()   { PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -tAc "$1"; }
assert()      { local ok="$1" msg="$2"; if [ "$ok" = "1" ]; then REPORT+="  PASS  ${msg}"$'\n'; else REPORT+="  FAIL  ${msg}"$'\n'; FAILURES+=("$msg"); fi; }

cleanup() {
  drill_psql -d "$DRILL_PGADMINDB" -c "DROP DATABASE IF EXISTS \"$SCRATCH_DB\" WITH (FORCE)" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
on_err() {
  local code=$?
  cleanup
  ping drill fail "restore-drill ERRORED (exit ${code}) before assertions completed"
  log "restore-drill errored (exit ${code})"
  exit "$code"
}
trap on_err ERR

ping drill start "restore-drill ${SCRATCH_DB}"
log "restore-drill starting (scratch=${SCRATCH_DB} on ${DRILL_PGHOST})"

# 1. Find the latest offsite object using the READ credential (proves offsite).
log "listing offsite backups (read credential)"
LATEST="$(rclone_do read lsf -R --files-only ":s3:${BACKUP_BUCKET}/${BACKUP_PREFIX}/" \
          | grep -E '\.dump\.age$' | grep -vE -- '-pre-migrate-|-manual-' | sort | tail -n1)"
[ -n "$LATEST" ] || die "no offsite backup object found under ${BACKUP_PREFIX}/"
log "latest offsite object: ${LATEST}"
rclone_do read copyto ":s3:${BACKUP_BUCKET}/${BACKUP_PREFIX}/${LATEST}" "${WORK}/latest.dump.age"

# 2. Decrypt with the OFF-SERVER identity (AGE_IDENTITY_FILE — the cold key read
#    from custody for this manual run). age_identity_file() also accepts
#    AGE_IDENTITY, but that path is for local staging tests only; in production the
#    private key is never present on the host, so this step also proves the custody
#    copy is readable (the "a key you've never tested reading" failure mode).
log "decrypting offsite copy (off-server key)"
age_decrypt "${WORK}/latest.dump.age" "${WORK}/latest.dump"

# 3. Assertion: dump lists objects, and capture expected object count.
OBJ_COUNT="$(pg_restore --list "${WORK}/latest.dump" | grep -cvE '^;|^$' || true)"
assert "$([ "${OBJ_COUNT:-0}" -gt 0 ] && echo 1 || echo 0)" "dump lists objects (${OBJ_COUNT})"

# 4. Create scratch DB and restore into it.
log "creating scratch database ${SCRATCH_DB}"
drill_psql -d "$DRILL_PGADMINDB" -c "DROP DATABASE IF EXISTS \"$SCRATCH_DB\" WITH (FORCE)" >/dev/null
drill_psql -d "$DRILL_PGADMINDB" -c "CREATE DATABASE \"$SCRATCH_DB\"" >/dev/null
RESTORE_RC=0
PGPASSWORD="$DRILL_PGPASSWORD" pg_restore --clean --if-exists --no-owner --no-privileges \
  -h "$DRILL_PGHOST" -p "$DRILL_PGPORT" -U "$DRILL_PGUSER" -d "$SCRATCH_DB" \
  "${WORK}/latest.dump" >/dev/null 2>"${WORK}/restore.err" || RESTORE_RC=$?
# pg_restore exits non-zero on benign "already exists" noise with --clean on an
# empty DB; treat it as pass only if the core tables materialised (checked next).
assert "$([ "$RESTORE_RC" -eq 0 ] && echo 1 || echo 0)" "pg_restore exit 0 (rc=${RESTORE_RC})"

# 5a. _migrations parity — schema is CURRENT, not a stale dump. Exact match.
SCRATCH_MIG="$(scratch_psql "select coalesce(max(filename),'') from _migrations" 2>/dev/null || echo '')"
LIVE_MIG="$(live_psql "select coalesce(max(filename),'') from _migrations" 2>/dev/null || echo '?')"
assert "$([ -n "$SCRATCH_MIG" ] && [ "$SCRATCH_MIG" = "$LIVE_MIG" ] && echo 1 || echo 0)" \
  "_migrations max matches live (restored='${SCRATCH_MIG}' live='${LIVE_MIG}')"

# 5b. Row-count floors + tolerance band vs live.
for spec in $DRILL_ROW_FLOORS; do
  tbl="${spec%%:*}"; floor="${spec##*:}"
  sc="$(scratch_psql "select count(*) from ${tbl}" 2>/dev/null || echo -1)"
  lv="$(live_psql   "select count(*) from ${tbl}" 2>/dev/null || echo -1)"
  sc="${sc//[!0-9-]/}"; lv="${lv//[!0-9-]/}"
  above_floor=$([ "${sc:--1}" -ge "$floor" ] 2>/dev/null && echo 1 || echo 0)
  # within tolerance band of live (allow the dump to be up to ≤12h behind)
  within=1
  if [ "${lv:-0}" -gt 0 ]; then
    lo=$(( lv * (100 - DRILL_ROW_TOLERANCE_PCT) / 100 ))
    [ "${sc:-0}" -ge "$lo" ] || within=0
  fi
  ok=$([ "$above_floor" = "1" ] && [ "$within" = "1" ] && echo 1 || echo 0)
  assert "$ok" "${tbl}: restored=${sc} live=${lv} (floor≥${floor}, within ${DRILL_ROW_TOLERANCE_PCT}%)"
done

# 5c. Referential-integrity probes — no orphans after restore.
orphan() { scratch_psql "$1" 2>/dev/null | tr -dc '0-9'; }
CWP_ORPH="$(orphan "select count(*) from child_word_progress p left join children c on c.id=p.child_id where c.id is null")"
SP_ORPH="$(orphan  "select count(*) from story_pages sp left join stories s on s.id=sp.story_id where s.id is null")"
assert "$([ "${CWP_ORPH:-1}" = "0" ] && echo 1 || echo 0)" "no orphaned child_word_progress (${CWP_ORPH:-?})"
assert "$([ "${SP_ORPH:-1}"  = "0" ] && echo 1 || echo 0)" "no orphaned story_pages (${SP_ORPH:-?})"

# 5d. Round-trip sentinel — the seeded admin user survives the round trip.
SENTINEL="$(scratch_psql "select count(*) from users where email = '${SENTINEL_EMAIL:-admin@koodakbook.com}'" 2>/dev/null | tr -dc '0-9')"
assert "$([ "${SENTINEL:-0}" -ge 1 ] && echo 1 || echo 0)" "sentinel admin row present (${SENTINEL:-0})"

cleanup
trap - ERR

# 6. Report PASS/FAIL with the assertion table.
log "restore-drill assertions:"$'\n'"$REPORT"
if [ "${#FAILURES[@]}" -eq 0 ]; then
  ping drill success "restore-drill PASS (${OBJ_COUNT} objects, migrations=${SCRATCH_MIG})"$'\n'"$REPORT"
  log "restore-drill PASS"
else
  ping drill fail "restore-drill FAIL (${#FAILURES[@]} assertion(s)): ${FAILURES[*]}"$'\n'"$REPORT"
  log "restore-drill FAIL — ${#FAILURES[@]} assertion(s) failed"
  exit 1
fi
