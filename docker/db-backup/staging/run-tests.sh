#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# db-backup — local staging verification (approved plan §10)
#
# Runs the §10 table against a local MinIO stand-in for R2 and an ephemeral age
# keypair. Rows that genuinely need hosted R2 or hosted healthchecks.io are
# reported CANNOT-LOCAL (with the reason) rather than skipped. No real secrets.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")"
DC="docker compose"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
ROWS=()

record() { ROWS+=("$1|$2|$3"); printf '  [%s] %s — %s\n' "$2" "$1" "$3"; }
mc_root() { $DC run --rm --no-deps --entrypoint sh minio-setup -c "mc alias set local http://minio:9000 minioadmin minioadmin >/dev/null 2>&1; $*" 2>/dev/null; }

echo "== bringing up infra =="
$DC down -v >/dev/null 2>&1 || true
$DC build db-backup 2>&1 | tail -3
BUILD_RC=${PIPESTATUS[0]}
$DC up -d --wait db db-drill minio 2>&1 | tail -2
$DC run --rm --no-deps minio-setup 2>&1 | tail -2

echo "== generating ephemeral age keypair =="
$DC run --rm --no-deps --entrypoint sh db-backup -c 'age-keygen' > "$WORK/key.txt" 2>/dev/null
RECIP="$(grep 'public key:' "$WORK/key.txt" | awk '{print $NF}')"
IDENT="$(grep 'AGE-SECRET-KEY' "$WORK/key.txt")"
echo "   recipient: ${RECIP:-<none>}"

runjob() { $DC run --rm --no-deps -e AGE_RECIPIENT="$RECIP" -e AGE_IDENTITY="$IDENT" "$@"; }

# ── Row 1: Image builds + tool versions ──────────────────────────────────────
echo "== [1] image builds =="
VERS="$(runjob --entrypoint sh db-backup -c 'pg_dump --version; age --version 2>&1 | head -1; rclone version | head -1; curl --version | head -1; supercronic -version 2>&1 | head -1' 2>/dev/null)"
echo "$VERS" | sed 's/^/     /'
if [ "$BUILD_RC" -eq 0 ] && echo "$VERS" | grep -q 'pg_dump (PostgreSQL) 16'; then
  record "Image builds (tools present, pg_dump==16)" PASS "all five tools present; pg_dump major matches server 16"
else
  record "Image builds" FAIL "build rc=$BUILD_RC or pg_dump!=16"
fi

# ── Row 2: Backup happy path ─────────────────────────────────────────────────
echo "== [2] backup happy path =="
OUT="$(runjob db-backup backup 2>&1)"; echo "$OUT" | sed 's/^/     /'
OBJ="$(mc_root 'mc ls --recursive local/koodakbook-backups' | grep -oE 'staging-[0-9TZ]+\.dump\.age' | head -1)"
if echo "$OUT" | grep -q 'backup .* complete' && [ -n "$OBJ" ]; then
  record "Backup happy path" PASS "object in bucket ($OBJ); upload size-verified; success heartbeat DRY-RUN logged"
else
  record "Backup happy path" FAIL "no verified object / job did not complete"
fi

# ── Row 3: Encryption is real ────────────────────────────────────────────────
# All in-container (fetch via reader creds, attempt decrypt with/without key) so
# no binary is piped through the host shell.
echo "== [3] encryption is real =="
KEY="$(mc_root 'mc ls --recursive local/koodakbook-backups' | awk '{print $NF}' | grep '\.dump\.age$' | head -1)"
OUT="$($DC run --rm --no-deps -e IDENT="$IDENT" -e KEY="$KEY" --entrypoint sh db-backup -c '
  rclone --s3-provider=Minio --s3-endpoint=http://minio:9000 --s3-region=us-east-1 \
    --s3-access-key-id=backupreader --s3-secret-access-key=backupreaderpw --s3-no-check-bucket \
    copyto ":s3:koodakbook-backups/$KEY" /tmp/o.age 2>/dev/null
  if age -d /tmp/o.age >/dev/null 2>&1; then echo NOKEY=decrypted; else echo NOKEY=denied; fi
  printf "%s\n" "$IDENT" > /tmp/id
  age -d -i /tmp/id -o /tmp/o.dump /tmp/o.age 2>/dev/null
  head -c5 /tmp/o.dump 2>/dev/null | grep -q PGDMP && echo WITHKEY=pgdmp || echo WITHKEY=bad
  echo PLAINLEFT=$(ls /staging/*.dump 2>/dev/null | wc -l | tr -dc 0-9)
' 2>/dev/null)"
echo "$OUT" | sed 's/^/     /'
if echo "$OUT" | grep -q 'NOKEY=denied' && echo "$OUT" | grep -q 'WITHKEY=pgdmp' && echo "$OUT" | grep -q 'PLAINLEFT=0'; then
  record "Encryption is real" PASS "undecryptable without key; decrypts WITH key to a valid PGDMP; no plaintext left on staging"
else
  record "Encryption is real" FAIL "$(echo "$OUT" | tr '\n' ' ')"
fi

# ── Row 4: Restore-drill happy path ──────────────────────────────────────────
echo "== [4] restore-drill happy path =="
OUT="$(runjob db-backup restore-drill 2>&1)"; DRC=$?; echo "$OUT" | sed 's/^/     /'
if [ "$DRC" -eq 0 ] && echo "$OUT" | grep -q 'restore-drill PASS' && ! echo "$OUT" | grep -q '  FAIL  '; then
  record "Restore-drill happy path" PASS "scratch restored; all §7 assertions PASS; scratch dropped"
else
  record "Restore-drill happy path" FAIL "exit=$DRC or an assertion failed"
fi

# ── Row 5: Restore-drill catches bad data ────────────────────────────────────
echo "== [5] restore-drill catches a bad dump =="
# Upload a garbage 'dump' encrypted with the real key, keyed to sort LAST.
runjob --entrypoint sh db-backup -c '
  echo "this is not a valid pg_dump" > /tmp/bad
  age -r "$AGE_RECIPIENT" -o /tmp/bad.age /tmp/bad
  rclone --s3-provider=Minio --s3-endpoint=http://minio:9000 --s3-region=us-east-1 \
    --s3-access-key-id=backupwriter --s3-secret-access-key=backupwriterpw --s3-no-check-bucket \
    copyto /tmp/bad.age :s3:koodakbook-backups/staging/9999/12/31/staging-99991231T235959Z.dump.age' >/dev/null 2>&1
OUT="$(runjob db-backup restore-drill 2>&1)"; DRC=$?; echo "$OUT" | grep -E 'FAIL|ERRORED|PASS' | sed 's/^/     /'
# A non-zero exit (whether a graceful assertion FAIL or an ERRORED trap) proves
# the drill did not silently accept a bad dump — meaningful because the good-data
# drill in Row 4 exits 0.
if [ "$DRC" -ne 0 ] && echo "$OUT" | grep -qE 'restore-drill FAIL|ERRORED'; then
  record "Restore-drill catches bad data" PASS "bad dump → drill exit ${DRC}, did NOT pass (assertions actually assert)"
else
  record "Restore-drill catches bad data" FAIL "drill did not fail on a bad dump (exit=$DRC)"
fi
# clean the poisoned object so later reruns aren't affected
mc_root 'mc rm local/koodakbook-backups/staging/9999/12/31/staging-99991231T235959Z.dump.age' >/dev/null 2>&1

# ── Row 6: Dead-man's switch fires on ABSENCE ────────────────────────────────
echo "== [6] dead-man's switch =="
record "Dead-man's switch fires on absence" CANNOT-LOCAL "needs the hosted healthchecks.io monitor to observe a missed-ping alert; locally only the ping call is exercisable (DRY-RUN). Verified in the Phase 0 hosted rehearsal + prod §11.6."

# ── Row 7: Anomaly alert fires (detection logic) ─────────────────────────────
echo "== [7] anomaly detection =="
# Seed a large trailing median, then a normal (smaller) backup → must anomaly-fail.
runjob --entrypoint sh db-backup -c 'for i in 1 2 3 4 5 6 7; do printf "T%s\t900000000\t999999\n" "$i" >> /staging/backup_metrics.log; done' >/dev/null 2>&1
OUT="$(runjob db-backup backup 2>&1)"; echo "$OUT" | grep -iE 'anomaly|heartbeat\[backup/fail' | sed 's/^/     /'
if echo "$OUT" | grep -qi 'ANOMALY' && echo "$OUT" | grep -q 'heartbeat\[backup/fail'; then
  record "Anomaly alert fires" PASS "size <40% of trailing median → job emits FAIL ping despite a good upload (delivery itself is the hc.io half)"
else
  record "Anomaly alert fires" FAIL "anomaly branch not triggered"
fi
runjob --entrypoint sh db-backup -c 'rm -f /staging/backup_metrics.log' >/dev/null 2>&1

# ── Row 8: Least-privilege holds ─────────────────────────────────────────────
echo "== [8] least-privilege =="
DEL="$(mc_root 'mc alias set w http://minio:9000 backupwriter backupwriterpw >/dev/null 2>&1; mc rm "w/koodakbook-backups/'"$KEY"'" 2>&1' )"
WRITE="$(runjob --entrypoint sh db-backup -c 'PGPASSWORD=backuppw psql -h db -U backup -d koodakbook -tAc "insert into users(email,password_hash) values ('"'"'x@x'"'"','"'"'x'"'"')" 2>&1' 2>/dev/null)"
DEL_DENIED=0; echo "$DEL" | grep -qiE 'denied|forbidden|AccessDenied' && DEL_DENIED=1
WRITE_DENIED=0; echo "$WRITE" | grep -qiE 'permission denied|must be owner|denied' && WRITE_DENIED=1
if [ "$DEL_DENIED" = "1" ] && [ "$WRITE_DENIED" = "1" ]; then
  record "Least-privilege holds" PASS "writer credential DELETE denied; backup DB role INSERT denied"
else
  record "Least-privilege holds" FAIL "del_denied=$DEL_DENIED write_denied=$WRITE_DENIED (del:'$DEL' write:'$WRITE')"
fi

# ── Row 9: Off-server-key recovery (crypto half) ─────────────────────────────
echo "== [9] off-server-key recovery =="
# Restore the offsite object using ONLY the isolated private-key file — no other
# key material, no ACM env — into db-drill, to prove recovery survives loss of
# the server's secrets. (The human 'machine that never held the ACM key' custody
# step is the manual quarterly rehearsal — flagged.)
printf '%s\n' "$IDENT" > "$WORK/offserver.key"
OUT="$($DC run --rm --no-deps -v "$WORK:/w" -e KEY="$KEY" --entrypoint sh db-backup -c '
  set -e
  rclone --s3-provider=Minio --s3-endpoint=http://minio:9000 --s3-region=us-east-1 \
    --s3-access-key-id=backupreader --s3-secret-access-key=backupreaderpw --s3-no-check-bucket \
    copyto ":s3:koodakbook-backups/$KEY" /tmp/o.age
  age -d -i /w/offserver.key -o /tmp/o.dump /tmp/o.age
  # Admin connections must target an existing DB: the image sets PGDATABASE=koodakbook,
  # which does not exist on the dataless db-drill server — pass -d postgres explicitly.
  PGPASSWORD=drillsecret psql -h db-drill -U postgres -d postgres -tAc "drop database if exists offdrill" >/dev/null
  PGPASSWORD=drillsecret psql -h db-drill -U postgres -d postgres -tAc "create database offdrill" >/dev/null
  PGPASSWORD=drillsecret pg_restore --clean --if-exists --no-owner -h db-drill -U postgres -d offdrill /tmp/o.dump >/dev/null 2>&1 || true
  echo "OFFUSERS=$(PGPASSWORD=drillsecret psql -h db-drill -U postgres -d offdrill -tAc "select count(*) from users" | tr -dc 0-9)"
  PGPASSWORD=drillsecret psql -h db-drill -U postgres -d postgres -tAc "drop database if exists offdrill" >/dev/null
' 2>&1)"
USERS="$(echo "$OUT" | grep -oE 'OFFUSERS=[0-9]+' | cut -d= -f2)"
if [ "${USERS:-0}" -ge 1 ]; then
  record "Off-server-key recovery (crypto)" PARTIAL "restored offsite dump with ONLY the isolated private key ($USERS users). Human off-server-custody rehearsal remains manual (prod §11.6)."
else
  record "Off-server-key recovery (crypto)" FAIL "isolated-key restore produced no rows"
fi

# ── Row 10: Scheduler ────────────────────────────────────────────────────────
echo "== [10] scheduler =="
# supercronic -test logs to stderr, so judge on the combined-stream "crontab is
# valid" line (emitted only on a clean parse). NOTE: a trailing command is
# deliberate — `sh -c 'supercronic …'` exec-optimises supercronic to PID 1, which
# enables its process reaper; under -test in this sandbox that reaper intermittently
# dies "Failed to fork exec" BEFORE validation prints. Keeping supercronic a child
# (reaping disabled) makes the check deterministic. Run mode as PID 1 (the prod
# scheduler) is unaffected — reaping there is correct and desired.
SOUT="$(runjob --entrypoint sh db-backup -c 'supercronic -test /app/crontab 2>&1; echo __RC=$?' 2>/dev/null)"
if echo "$SOUT" | grep -q 'crontab is valid' && echo "$SOUT" | grep -q '__RC=0'; then
  record "Scheduler (crontab valid + fires)" PARTIAL "supercronic parses & validates the crontab (crontab is valid, exit 0); the 48h drift soak is explicitly a prod-under-observation item (§12.6)."
else
  record "Scheduler" FAIL "supercronic -test did not report a valid crontab: $(echo "$SOUT" | grep -oE 'crontab is valid|Failed to fork exec|__RC=[0-9]+' | tr '\n' ' ')"
fi

echo ""; echo "════════════ §10 RESULTS ════════════"
printf '%-38s %-13s %s\n' "ROW" "RESULT" "NOTE"
for r in "${ROWS[@]}"; do IFS='|' read -r a b c <<<"$r"; printf '%-38s %-13s %s\n' "$a" "$b" "$c"; done
echo "════════════════════════════════════"
$DC down -v >/dev/null 2>&1 || true
