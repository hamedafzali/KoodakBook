# Phase 2 — Restore Drills & Disaster-Recovery Runbook (DRAFT for review)

> **Status:** design only. Depends on Phase 1B being *live* to run, but not to
> design. Nothing here needs R2/hc.io provisioning to review. Sibling of
> `docker/db-backup/README.md` (which covers the 1B build).

Phase 1B proves a backup can be *made* and *restored once* (the weekly automated
drill). Phase 2 turns that into an operational guarantee: **restores are proven
continuously, against a spec of what "restored correctly" means, with a runbook a
human can follow under pressure.**

## 1. Restore-drill topology (confirmed decision)

The plan's §7.1 literal wording ("spin up an ephemeral `postgres:16-alpine`
container") is **superseded** by the `db-drill` approach already shipped in 1B,
and Phase 2 keeps it:

- Restores target a uniquely-named **scratch database** created and dropped each
  run, on a dedicated **dataless** `db-drill` server (a client connection).
- Rejected alternative: socket-spawned container — needs the Docker socket (root
  on a 10-project shared host), which undoes the sidecar's non-root/`read_only`
  hardening. The isolation goal (a runaway restore can't touch prod's server) is
  met by db-drill without host-level power.

**Two drill cadences:**

| Drill | Cadence | Key used | Purpose |
| --- | --- | --- | --- |
| Automated | Weekly, Sun 04:00 (`restore-drill.sh`) | machine `AGE_IDENTITY` (ACM) | continuous proof the offsite chain restores |
| Manual | Quarterly | **off-server** private key only (`AGE_IDENTITY_FILE` mount) | proves recovery survives total loss of the server's secrets — the human-custody rehearsal |

## 2. §7 verification assertion catalog (the "restored correctly" spec)

The automated drill (`restore-drill.sh`) already asserts these; Phase 2 *ratifies*
this as the acceptance spec and adds the two marked ⬚ (new work):

1. **Dump lists objects** — `pg_restore --list` count > 0 (catches truncation).
2. **`pg_restore` exits 0** into the scratch DB.
3. **`_migrations` parity** — restored `max(filename)` == live (schema is current,
   not a stale dump).
4. **Row-count floors + tolerance band** — each core table ≥ floor and within
   `DRILL_ROW_TOLERANCE_PCT` (25%) of live (allows the ≤12h dump lag).
5. **Referential integrity** — no orphaned `child_word_progress` / `story_pages`.
6. **Sentinel round-trip** — the seeded admin row survives.
7. ⬚ **RPO assertion** — restored dump's wall-clock age ≤ 12h (the twice-daily
   guarantee). Fail if the newest offsite object is older than 12h + grace.
8. ⬚ **RTO measurement** — record fetch+decrypt+restore duration each drill; alert
   if it exceeds the off-peak budget (target: full restore << the nightly window).

Pass → success heartbeat; any fail → `fail` ping (dead-man's switch), non-zero exit.

## 3. DR runbook structure (the human-facing document)

To be written as `docs/DR-RUNBOOK.md` once 1B is live (so every command in it has
been executed for real at least once). Structure:

1. **Trigger & severity** — what counts as a DR event (data loss / corruption /
   host loss); who declares it; where to look first (healthchecks.io + Telegram).
2. **Pre-flight** — stop writes (put app in maintenance), snapshot current broken
   state before touching it (never destroy forensic evidence).
3. **Recover the key** — retrieve the age **private** key from custody
   (password-manager entry + physical off-site copy). Explicit "the server key is
   gone, use the off-server key" branch.
4. **Fetch the target backup** — list offsite objects with the read credential;
   choose the newest good one (or a specific pre-migrate label); the exact rclone
   command.
5. **Restore** — into a *fresh* DB first (never straight over prod); the §7
   assertions run manually as the go/no-go gate.
6. **Cut over** — promote the restored DB; run app smoke tests; lift maintenance.
7. **Post-incident** — what was lost (RPO actual), timeline, and the fix so it
   can't recur.
8. **Appendix** — every credential's custody location (not the values), the ACM
   variable names, and the "who to call."

Each numbered step gets: the literal command, expected output, and the failure
branch. The runbook is **rehearsed** by the quarterly manual drill — if a step in
the runbook can't be executed from cold custody, that's a drill failure.

## 4. Phase 2 acceptance (when is Phase 2 "done")

- [ ] Weekly automated drill green for 4 consecutive weeks.
- [ ] RPO + RTO assertions (§2.7, §2.8) added and passing.
- [ ] One quarterly manual drill completed **from off-server key only**, timed.
- [ ] `DR-RUNBOOK.md` written, every command executed for real, peer-reviewed.
- [ ] A deliberate game-day: restore into a fresh DB and diff against live.

## 5. Open questions for review

- RTO budget: what's the acceptable max restore time? (sets the §2.8 alert
  threshold.)
- Manual-drill custody: who physically holds the off-site key copy, and is the
  quarterly cadence right for this project's risk?
- Do we want a monthly *lightweight* restore (automated) between quarterly manual
  drills, or is weekly-automated + quarterly-manual sufficient?
