#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# db-backup — LOCAL-ONLY mode verification (BACKUP_OFFSITE=0)
#
# Companion to run-tests.sh (which exercises the full offsite §10 table against
# MinIO). This exercises the deferred-offsite path: no MinIO involved at all —
# only `db` + `db-drill` come up, and db-backup runs with --no-deps so it never
# needs the offsite creds. What this proves, concretely:
#
#   - the BACKUP_OFFSITE opt-in is genuinely opt-in: missing S3 creds WITHOUT
#     BACKUP_OFFSITE=0 is still a hard failure (no silent local-only fallback)
#   - with BACKUP_OFFSITE=0, backup/encrypt/local-retention/heartbeat all work
#   - the LOCAL-ONLY labelling actually appears in the log AND the heartbeat
#     payload (not just one or the other)
#   - VERIFIED_OFFSITE is never printed in this mode (the Item 2 hook guard)
#   - the weekly slot runs verify-local.sh (via the verify-offsite auto-route)
#     and its heartbeat payload is tagged too
#
# No real secrets. Usage:  bash docker/db-backup/staging/run-tests-local.sh
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")"
DC="docker compose"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
ROWS=()

record() { ROWS+=("$1|$2|$3"); printf '  [%s] %s — %s\n' "$2" "$1" "$3"; }

echo "== bringing up infra (db + db-drill only — no MinIO needed) =="
$DC down -v >/dev/null 2>&1 || true
$DC build db-backup 2>&1 | tail -3
$DC up -d --wait db db-drill 2>&1 | tail -2

echo "== generating ephemeral age keypair =="
$DC run --rm --no-deps --entrypoint sh db-backup -c 'age-keygen' > "$WORK/key.txt" 2>/dev/null
RECIP="$(grep 'public key:' "$WORK/key.txt" | awk '{print $NF}')"
IDENT="$(grep 'AGE-SECRET-KEY' "$WORK/key.txt")"
echo "   recipient: ${RECIP:-<none>}"

localjob() { $DC run --rm --no-deps -e AGE_RECIPIENT="$RECIP" -e AGE_IDENTITY="$IDENT" -e BACKUP_OFFSITE=0 "$@"; }

# ── Row L1: fail-closed WITHOUT the opt-in (no S3 creds, BACKUP_OFFSITE unset) ─
echo "== [L1] missing offsite creds WITHOUT BACKUP_OFFSITE=0 must still hard-fail =="
OUT="$($DC run --rm --no-deps -e AGE_RECIPIENT="$RECIP" -e AGE_IDENTITY="$IDENT" \
       -e BACKUP_S3_ENDPOINT= -e BACKUP_BUCKET= -e BACKUP_KEY_ID= -e BACKUP_KEY_SECRET= \
       db-backup backup 2>&1)"; RC=$?
echo "$OUT" | grep -iE 'FATAL|missing required config' | sed 's/^/     /'
if [ "$RC" -ne 0 ] && echo "$OUT" | grep -q 'missing required config' && echo "$OUT" | grep -q 'BACKUP_S3_ENDPOINT'; then
  record "Silent local-only fallback is impossible" PASS "no S3 creds + BACKUP_OFFSITE unset → hard FATAL naming the missing vars (exit ${RC}), NOT a quiet local-only run"
else
  record "Silent local-only fallback is impossible" FAIL "expected a hard fail naming missing S3 vars; got exit=${RC}: $(echo "$OUT" | tail -1)"
fi

# ── Row L2: local-only backup happy path — labelling in LOG ──────────────────
echo "== [L2] local-only backup — loud labelling in the log =="
OUT="$(localjob db-backup backup 2>&1)"; RC=$?
echo "$OUT" | grep -iE 'LOCAL-ONLY|complete' | sed 's/^/     /'
if [ "$RC" -eq 0 ] && echo "$OUT" | grep -q 'LOCAL-ONLY MODE (BACKUP_OFFSITE=0) — NOT SHIPPED OFFSITE'; then
  record "Local-only backup: LOCAL-ONLY banner in log" PASS "boxed banner printed; job exit 0"
else
  record "Local-only backup: LOCAL-ONLY banner in log" FAIL "banner missing or job failed (exit=${RC})"
fi

# ── Row L3: same run — labelling in the HEARTBEAT PAYLOAD, not just the log ──
echo "== [L3] local-only backup — loud labelling in the heartbeat payload =="
if echo "$OUT" | grep -q 'heartbeat\[backup/success\].*DRY-RUN\|DRY-RUN heartbeat\[backup/success\]' \
   && echo "$OUT" | grep -q '\[LOCAL-ONLY — NOT shipped offsite\]'; then
  record "Local-only backup: tag in heartbeat payload" PASS "success ping payload carries [LOCAL-ONLY — NOT shipped offsite], not just the log line"
else
  record "Local-only backup: tag in heartbeat payload" FAIL "heartbeat payload missing the LOCAL-ONLY tag: $(echo "$OUT" | grep -i 'DRY-RUN heartbeat\[backup' | tail -1)"
fi

# ── Row L4: local encrypted copy + manifest actually present on /staging ─────
echo "== [L4] local .age + manifest present on backup_staging =="
LS="$($DC run --rm --no-deps --entrypoint sh db-backup -c 'ls -1 /staging' 2>/dev/null)"
echo "$LS" | sed 's/^/     /'
if echo "$LS" | grep -q '\.dump\.age$' && echo "$LS" | grep -q '\.dump\.age\.manifest\.json$'; then
  record "Local .age + manifest on backup_staging" PASS "both present: $(echo "$LS" | grep -E '\.dump\.age($|\.manifest)' | tr '\n' ' ')"
else
  record "Local .age + manifest on backup_staging" FAIL "expected files not found: $(echo "$LS" | tr '\n' ' ')"
fi

# ── Row L5: VERIFIED_OFFSITE is withheld for a labelled local-only backup ────
echo "== [L5] VERIFIED_OFFSITE withheld in local-only mode =="
OUT="$(localjob db-backup backup --label pre-migrate 2>&1)"; RC=$?
echo "$OUT" | grep -iE 'VERIFIED_OFFSITE|LOCAL-ONLY' | sed 's/^/     /'
if [ "$RC" -eq 0 ] && ! echo "$OUT" | grep -q 'VERIFIED_OFFSITE'; then
  record "VERIFIED_OFFSITE withheld (local-only)" PASS "labelled backup succeeded but printed no VERIFIED_OFFSITE marker — Item 2's future hook cannot mistake this for an offsite restore point"
else
  record "VERIFIED_OFFSITE withheld (local-only)" FAIL "marker was printed despite BACKUP_OFFSITE=0 (exit=${RC})"
fi

# ── Row L6: weekly slot auto-routes verify-offsite → verify-local.sh ─────────
echo "== [L6] verify-offsite auto-routes to verify-local.sh when BACKUP_OFFSITE=0 =="
OUT="$(localjob db-backup verify-offsite 2>&1)"; RC=$?
echo "$OUT" | grep -iE 'running verify-local|verify-local (PASS|FAIL)|LOCAL-ONLY' | sed 's/^/     /'
if [ "$RC" -eq 0 ] && echo "$OUT" | grep -q 'running verify-local.sh instead of verify-offsite.sh' && echo "$OUT" | grep -q 'verify-local PASS'; then
  record "verify-offsite auto-routes to verify-local" PASS "entrypoint logged the substitution; verify-local.sh ran and PASSed"
else
  record "verify-offsite auto-routes to verify-local" FAIL "did not route/pass as expected (exit=${RC})"
fi

# ── Row L7: verify-local's own heartbeat payload is tagged ───────────────────
echo "== [L7] verify-local heartbeat payload tagged =="
if echo "$OUT" | grep -q '\[LOCAL-ONLY — NOT verified offsite\]'; then
  record "verify-local: tag in heartbeat payload" PASS "drill success ping payload carries [LOCAL-ONLY — NOT verified offsite]"
else
  record "verify-local: tag in heartbeat payload" FAIL "tag missing from verify-local's heartbeat payload"
fi

echo ""; echo "════════════ LOCAL-ONLY MODE RESULTS ════════════"
printf '%-48s %-9s %s\n' "ROW" "RESULT" "NOTE"
for r in "${ROWS[@]}"; do IFS='|' read -r a b c <<<"$r"; printf '%-48s %-9s %s\n' "$a" "$b" "$c"; done
echo "═══════════════════════════════════════════════"
$DC down -v >/dev/null 2>&1 || true
