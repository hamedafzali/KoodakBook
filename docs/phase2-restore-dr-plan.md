# Phase 2 — Restore Drills & Disaster-Recovery Runbook (DRAFT for review)

> **Status:** design only. Depends on Phase 1B being *live* to run, but not to
> design. Nothing here needs R2/hc.io provisioning to review. Sibling of
> `docker/db-backup/README.md` (which covers the 1B build).

Phase 1B proves a backup can be *made*, *verified continuously without the key*
(the weekly keyless drill), and *fully restored from off-server custody* (the
quarterly manual drill). Phase 2 turns that into an operational guarantee:
**restores are proven against a spec of what "restored correctly" means, with a
runbook a human can follow under pressure.**

> **Key-custody model (Option C — confirmed).** The age **private** key never
> touches the server. Only the age **public** key (`AGE_RECIPIENT`), the R2
> credentials, and the DB passwords are provisioned into ACM. Consequence, kept
> explicit throughout this document: **the weekly automated drill cannot and does
> not decrypt** — it verifies the offsite chain *keylessly*. The full
> decrypt→restore proof happens only at the **quarterly manual** drill, fed the
> private key from human custody. See the key-loss failure mode in §3.

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

**Two drill cadences (Option C):**

| Drill | Cadence | Key used | Proves |
| --- | --- | --- | --- |
| Automated **keyless** (`verify-offsite.sh`) | Weekly, Sun 04:00 | **none** — no private key on the server | the offsite object exists, is well-formed age ciphertext addressed to *our* recipient, matches its checksum/size, is under Object-Lock retention, and its manifest passes row/size sanity |
| **Manual** decrypt→restore (`restore-drill.sh`) | Quarterly | **off-server** private key only (`AGE_IDENTITY_FILE` mount, from human custody) | the full recovery chain restores *and* the human-custody copy of the key is still readable — the §2 assertion catalog runs here |

The weekly drill deliberately holds no key, so it can run unattended on a server
whose total compromise still yields no ability to decrypt a backup. What it
*cannot* do is prove a dump actually restores — that is the quarterly drill's job.
The manifest sidecar (below) is what lets the keyless drill make meaningful
row/size claims without opening the ciphertext.

## 2. §7 verification assertion catalog (the "restored correctly" spec)

This is the **quarterly manual** drill's spec — the assertions that can only be
made after a real decrypt→restore. `restore-drill.sh` already asserts these;
Phase 2 *ratifies* this as the acceptance spec and adds the two marked ⬚ (new
work):

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

### 2a. Weekly keyless verification catalog (`verify-offsite.sh`)

Runs with **no private key**. It cannot make any of the §2 restore assertions;
instead it proves the offsite chain is intact enough that a quarterly decrypt is
worth attempting:

1. **Exists** — the newest non-labelled `.age` object is present offsite.
2. **Size trend** — its byte size is within `ANOMALY_DROP_PCT` of the trailing-7
   median (catches a silently truncated or empty dump).
3. **Age header** — first 8 KiB parse as `age-encryption.org/v1`, with the exact
   recipient stanza type/count and **no `scrypt` (passphrase) stanza**. Confirms
   it's well-formed ciphertext addressed the way our pipeline addresses it.
4. **Recipient** — the manifest's `age_recipient_fpr` matches *our* public key's
   fingerprint (X25519 recipients aren't recoverable from the header by design, so
   this leg is manifest-attested; the stanza *shape* in check 3 is verified
   cryptographically).
5. **Checksum + size** — download, `sha256`/byte-count vs the manifest and vs the
   remote object's own metadata.
6. **Object Lock** — retention still in force (best-effort; MinIO/rclone may not
   surface lock metadata, in which case this is a WARN, not a FAIL).
7. **Row/size sanity** — manifest row counts clear their floors and don't regress
   versus the previous manifest (optionally compared to the live DB).

**Trust boundary — read this.** The manifest is a plaintext sidecar the *backup
pipeline* emits and signs off on by writing; it is an **operational aid, not a
security control**. An attacker who can rewrite the offsite object can rewrite its
manifest too. The keyless drill therefore proves *operational* health (the chain
isn't quietly rotting), not *authenticity against a hostile writer* — that
guarantee comes from Object Lock + the credential split + the quarterly decrypt
under our key. The manifest carries no row *values*, only counts/sizes/hashes.

## 3. DR runbook structure (the human-facing document)

To be written as `docs/DR-RUNBOOK.md` once 1B is live (so every command in it has
been executed for real at least once). Structure:

1. **Trigger & severity** — what counts as a DR event (data loss / corruption /
   host loss); who declares it; where to look first (healthchecks.io + Telegram).
2. **Pre-flight** — stop writes (put app in maintenance), snapshot current broken
   state before touching it (never destroy forensic evidence).
3. **Recover the key** — retrieve the age **private** key from custody
   (password-manager entry + one physical off-site copy). Under Option C there is
   **no server-side key to fall back on** — the server never held one — so this
   step is not a convenience, it is the only path to plaintext.

   > **⚠️ Key-loss failure mode (the cost of Option C).** Losing the private key
   > means losing the ability to decrypt **every** backup, permanently — no
   > offsite object, however intact, can be recovered without it. This is the
   > deliberate trade for keeping the key off a shared, LAN-exposed host. The
   > mitigation is redundant custody: the **password-manager entry** *and* **one
   > offline copy** (paper/USB in a physically separate location), and the
   > **quarterly manual drill is what proves that copy is still readable** — a
   > drill that can't be run from cold custody is itself a failure, not just a
   > missed check. If either custody copy is ever found unreadable, treat it as a
   > sev-1: re-provision a fresh copy immediately.
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

- [ ] Weekly **keyless** verify (§2a) green for 4 consecutive weeks.
- [ ] RPO + RTO assertions (§2.7, §2.8) added and passing in the quarterly drill.
- [ ] One quarterly manual drill completed **from off-server key only**, timed,
      and confirming the custody copy is readable.
- [ ] `DR-RUNBOOK.md` written, every command executed for real, peer-reviewed,
      with the §3 key-loss branch rehearsed at least once.
- [ ] A deliberate game-day: restore into a fresh DB and diff against live.

## 5. Open questions for review

- RTO budget: what's the acceptable max restore time? (sets the §2.8 alert
  threshold.)
- Manual-drill custody: who physically holds the off-site key copy, and is the
  quarterly cadence right for this project's risk?
- Do we want a monthly *lightweight* restore (automated) between quarterly manual
  drills, or is weekly-automated + quarterly-manual sufficient?
