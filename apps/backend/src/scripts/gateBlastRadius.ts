/*
 * READ-ONLY blast-radius report for the progression rebuild (BUG-C fix).
 * docs/placement-progression-rebuild.md §4.
 *
 * Runs the NEW gate recompute against CURRENT data for every child and reports
 * how many children are affected and by how much — WITHOUT writing anything.
 * Safe against production: it only issues SELECTs (via the read-only
 * computeGateResults path) and prints a report. It never persists a gate, never
 * logs a recompute, never deploys.
 *
 * It reports two numbers per strand, which differ by design:
 *   • EVENTUAL delta  = undamped target − current gate. The full correction a
 *                       child converges to over repeated sessions. This is the
 *                       true blast radius.
 *   • FIRST-STEP delta = damped gate − current gate. What the child experiences
 *                       in the very next session (bounded by the damping cap).
 *
 * Run with the production DATABASE_URL in the environment:
 *   node --import tsx apps/backend/src/scripts/gateBlastRadius.ts
 */
import { db, query } from '../lib/db'
import { computeGateResults } from '../lib/strands'
import { targetGate, EARNABLE, type EarnableStrand } from '../lib/gate'

type Bucket = Map<number, number> // delta → count
const bump = (m: Bucket, k: number) => m.set(k, (m.get(k) ?? 0) + 1)

function histogram(m: Bucket): string {
  const keys = [...m.keys()].sort((a, b) => a - b)
  if (keys.length === 0) return '   (none)'
  return keys
    .map(k => `   ${k > 0 ? '+' : ''}${k}: ${'█'.repeat(Math.min(m.get(k)!, 40))} ${m.get(k)}`)
    .join('\n')
}

async function main() {
  const children = await query<{ id: string }>('select id from children')

  let scanned = 0
  let noBaseline = 0            // strands with no existing gate row (brand-new / pre-placement)
  const affectedChildren = new Set<string>()

  // per-strand eventual + first-step delta histograms
  const eventual: Record<EarnableStrand, Bucket> = { V: new Map(), D: new Map(), F: new Map() }
  const firstStep: Record<EarnableStrand, Bucket> = { V: new Map(), D: new Map(), F: new Map() }

  let worstDrop = { delta: 0, strand: '' as string, childId: '' } // most-negative eventual delta

  for (const { id } of children) {
    const results = await computeGateResults(id)
    if (!results) continue
    scanned++

    for (const r of results) {
      if (r.gateBefore === null) { noBaseline++; continue } // nothing to regress from
      const eventualGate = targetGate(r.prior, r.demonstrated, r.n, r.k)
      const evDelta = eventualGate - r.gateBefore
      const stepDelta = r.gateAfter - r.gateBefore

      bump(eventual[r.strand], evDelta)
      bump(firstStep[r.strand], stepDelta)
      if (evDelta !== 0) affectedChildren.add(id)
      if (evDelta < worstDrop.delta) worstDrop = { delta: evDelta, strand: r.strand, childId: id }
    }
  }

  const line = (s: string = '') => console.log(s)
  line('═══════════════════════════════════════════════════════════')
  line(' Progression rebuild — blast-radius report (READ-ONLY)')
  line('═══════════════════════════════════════════════════════════')
  line(`Children scanned:            ${scanned}`)
  line(`Children with any change:    ${affectedChildren.size}  (${scanned ? Math.round(100 * affectedChildren.size / scanned) : 0}%)`)
  line(`Strand-rows with no baseline: ${noBaseline}  (new/pre-placement — establish silently, no regression)`)
  line('')
  for (const strand of EARNABLE) {
    const ev = eventual[strand]
    const down = [...ev].filter(([d]) => d < 0).reduce((a, [, c]) => a + c, 0)
    const up = [...ev].filter(([d]) => d > 0).reduce((a, [, c]) => a + c, 0)
    const flat = ev.get(0) ?? 0
    line(`── Strand ${strand} ─────────────────────────────`)
    line(`   unchanged ${flat} · up ${up} · down ${down}`)
    line(`   EVENTUAL delta distribution (target − current):`)
    line(histogram(ev))
    line(`   FIRST-SESSION delta distribution (damped step):`)
    line(histogram(firstStep[strand]))
    line('')
  }
  line('── Worst case ──────────────────────────────')
  if (worstDrop.strand) {
    line(`   Largest EVENTUAL single-strand drop: ${worstDrop.delta} (strand ${worstDrop.strand}, child ${worstDrop.childId})`)
    line(`   (Any single SESSION drop is capped at the damping cap — see FIRST-SESSION above.)`)
  } else {
    line('   No downward corrections at all.')
  }
  line('═══════════════════════════════════════════════════════════')

  await db.end()
}

main().catch(async (err) => {
  console.error('blast-radius report failed:', err)
  await db.end()
  process.exit(1)
})
