import { queryOne, query } from '../db'

// Month-to-date TTS character metering — the runaway-bill guardrail for the
// single cloud tier (Piper removal). Every cloud synthesis records the number of
// characters it sent to the provider; when the month crosses a budget we raise
// an alarm ONCE for that month.
//
// ⚠️ THE ALARM IS INERT. `alert()` below only logs — it does NOT page anyone.
// This is deliberate: the tracking has to land now so month-to-date history
// accrues, but real paging depends on the Phase 0 alerting sink, which is not
// wired yet. Do NOT treat this as active runaway-bill protection until Phase 0
// closes and alert() is pointed at the real sink. See the Phase 0 checklist.

const DEFAULT_MONTHLY_BUDGET = 1_000_000   // ~$150–300/mo at ElevenLabs rates (verify eleven_v3 rate!)

function monthlyBudget(): number {
  const v = Number(process.env.TTS_MONTHLY_CHAR_BUDGET)
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_MONTHLY_BUDGET
}

/** INERT until Phase 0 alerting lands — logs only, pages no one. */
function alert(msg: string): void {
  console.error(`[TTS-BUDGET][INERT — no paging until Phase 0] ${msg}`)
}

/** Best-effort: add `chars` to this month's tally and fire the (inert) alarm the
 *  first time the month crosses the budget. Never throws — a metering failure
 *  must not break synthesis. */
export async function recordTtsChars(chars: number): Promise<void> {
  if (!Number.isFinite(chars) || chars <= 0) return
  try {
    const month = new Date().toISOString().slice(0, 7)   // 'YYYY-MM'
    const row = await queryOne<{ chars: string; alerted: boolean }>(
      `insert into tts_usage_monthly (month, chars) values ($1, $2)
         on conflict (month) do update set chars = tts_usage_monthly.chars + $2
       returning chars, alerted`,
      [month, chars],
    )
    const total = Number(row?.chars ?? 0)
    const budget = monthlyBudget()
    if (total >= budget && row && !row.alerted) {
      await query('update tts_usage_monthly set alerted = true where month = $1', [month])
      alert(`month-to-date TTS characters ${total.toLocaleString()} ≥ budget ${budget.toLocaleString()} (${month})`)
    }
  } catch (err) {
    console.error('tts meter failed (non-fatal):', (err as Error).message)
  }
}
