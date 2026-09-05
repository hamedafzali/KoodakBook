/* Streak computation, pulled out of routes/dashboard.ts so the one-day-grace
 * rule (expert review, streak hazard) is unit-testable the same way
 * frustration.ts and gate.ts are: pure function, no DB, no env.
 *
 * A single missed calendar day is forgiven once per computation rather than
 * resetting the streak to 0 — a child shouldn't lose visible progress
 * because a parent didn't hand over the tablet one day. This is stateless
 * and recomputed fresh from child_sessions on every request, so there is
 * nothing to "use up" across days: a genuine second gap on some later day
 * gets its own fresh grace token the next time this runs.
 *
 * Side effect worth knowing about: because grace also covers "no session
 * yet today," a streak that was intact through yesterday no longer reads as
 * broken before today's session happens — arguably the more correct
 * semantics anyway (Duolingo-style "still on track" rather than "reset until
 * proven otherwise"), not something separately requested but a natural
 * consequence of the same one-line rule.
 */

/** `sessionDays`: distinct YYYY-MM-DD days with a session, most-recent-first.
 *  `today`: YYYY-MM-DD. Both as plain date strings so this stays pure/testable
 *  without pulling in a timezone-aware date library. */
export function computeStreak(sessionDays: string[], today: string): number {
  function dayBefore(day: string): string {
    const d = new Date(day)
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }

  let streak = 0
  let graceUsed = false
  let cursor = today
  for (const day of sessionDays) {
    if (day === cursor) {
      streak++
      cursor = dayBefore(cursor)
    } else if (!graceUsed && day === dayBefore(cursor)) {
      graceUsed = true
      streak++
      cursor = dayBefore(day)
    } else break
  }
  return streak
}
