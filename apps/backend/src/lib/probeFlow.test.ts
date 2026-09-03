/* Placement probe navigation (probeFlow.ts, in @koodakbook/shared) — which
 * item is on screen given the bank + answers so far. Web and mobile both
 * drive their question screen from this, so it's the single behaviour under
 * test, same rationale as reviewFrustration.ts's tests.
 *
 * Tested from the backend runner because it already resolves the shared
 * package and runs node:test; the function itself is client-shared code.
 *
 * Run: npm test */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  currentProbeStep, recordProbeAnswer, emptyProbeResults,
} from '@koodakbook/shared'
import type { PlacementProbe, ProbeQuestion, ProbeStaircase } from '@koodakbook/shared'

const q = (id: string, strand: ProbeQuestion['strand']): ProbeQuestion => ({
  strand, stage: 1, mode: 'listen', prompt: 'p', choices: [], correct_id: id,
})

function staircase(mid: string | null, hard: string | null, easy: string | null, strand: ProbeQuestion['strand']): ProbeStaircase {
  return {
    mid: mid ? q(mid, strand) : null,
    hard: hard ? q(hard, strand) : null,
    easy: easy ? q(easy, strand) : null,
  }
}

const fullBank: PlacementProbe = {
  V: staircase('v-mid', 'v-hard', 'v-easy', 'V'),
  D: staircase('d-mid', 'd-hard', 'd-easy', 'D'),
  F: staircase('f-mid', 'f-hard', 'f-easy', 'F'),
  C: q('c-item', 'C'),
}

// ── Walking a full bank strand by strand ────────────────────────────────────

test('starts at V mid, then branches hard on a correct mid answer', () => {
  let results = emptyProbeResults()
  let step = currentProbeStep(fullBank, results)!
  assert.equal(step.strand, 'V')
  assert.equal(step.role, 'mid')
  assert.equal(step.question.correct_id, 'v-mid')

  results = recordProbeAnswer(results, step, true)
  step = currentProbeStep(fullBank, results)!
  assert.equal(step.role, 'branch')
  assert.equal(step.question.correct_id, 'v-hard')
})

test('branches easy on an incorrect mid answer', () => {
  let results = emptyProbeResults()
  const step = currentProbeStep(fullBank, results)!
  results = recordProbeAnswer(results, step, false)
  const next = currentProbeStep(fullBank, results)!
  assert.equal(next.role, 'branch')
  assert.equal(next.question.correct_id, 'v-easy')
})

test('walks V → D → F → C in order, then returns null (done)', () => {
  let results = emptyProbeResults()
  const seen: string[] = []
  for (let i = 0; i < 20; i++) {
    const step = currentProbeStep(fullBank, results)
    if (!step) break
    seen.push(step.question.correct_id)
    results = recordProbeAnswer(results, step, true)
  }
  assert.deepEqual(seen, ['v-mid', 'v-hard', 'd-mid', 'd-hard', 'f-mid', 'f-hard', 'c-item'])
  assert.equal(currentProbeStep(fullBank, results), null)
})

// ── Skipping strands / branches with no usable content ──────────────────────

test('a strand with no mid item is skipped entirely', () => {
  const bank: PlacementProbe = { ...fullBank, V: staircase(null, null, null, 'V') }
  const results = emptyProbeResults()
  const step = currentProbeStep(bank, results)!
  assert.equal(step.strand, 'D', 'V is skipped straight to D')
})

test('a missing branch item resolves the strand after just the mid item', () => {
  const bank: PlacementProbe = { ...fullBank, V: staircase('v-mid', null, null, 'V') }
  let results = emptyProbeResults()
  const mid = currentProbeStep(bank, results)!
  results = recordProbeAnswer(results, mid, true)   // would branch hard, but hard is null
  const next = currentProbeStep(bank, results)!
  assert.equal(next.strand, 'D', 'moves straight to D, no branch item shown')
})

test('a null C item is skipped, ending the probe after F', () => {
  const bank: PlacementProbe = { ...fullBank, C: null }
  let results = emptyProbeResults()
  for (let i = 0; i < 20; i++) {
    const step = currentProbeStep(bank, results)
    if (!step) break
    results = recordProbeAnswer(results, step, true)
  }
  assert.equal(results.C, null)
  assert.equal(currentProbeStep(bank, results), null)
})

test('a totally empty bank finishes immediately with no answers recorded', () => {
  const bank: PlacementProbe = { V: staircase(null, null, null, 'V'), D: staircase(null, null, null, 'D'), F: staircase(null, null, null, 'F'), C: null }
  const results = emptyProbeResults()
  assert.equal(currentProbeStep(bank, results), null)
  assert.deepEqual(results, emptyProbeResults())
})

// ── recordProbeAnswer shape ──────────────────────────────────────────────────

test('recordProbeAnswer appends to the branch-strand array, and sets C directly', () => {
  let results = emptyProbeResults()
  const vMid = currentProbeStep(fullBank, results)!
  results = recordProbeAnswer(results, vMid, true)
  assert.deepEqual(results.V, [true])

  const cBank: PlacementProbe = { V: staircase(null, null, null, 'V'), D: staircase(null, null, null, 'D'), F: staircase(null, null, null, 'F'), C: q('c-item', 'C') }
  const cStep = currentProbeStep(cBank, emptyProbeResults())!
  const cResults = recordProbeAnswer(emptyProbeResults(), cStep, false)
  assert.equal(cResults.C, false)
})
