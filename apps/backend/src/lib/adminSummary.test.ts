import { test } from 'node:test'
import assert from 'node:assert/strict'
import { localDateHour, formatSummary, type DailyNumbers } from './adminSummaryFormat'

test('local date and hour follow the configured zone, not UTC', () => {
  // 20:30 UTC on a summer day is 22:30 in Berlin (CEST, UTC+2).
  assert.deepEqual(localDateHour(new Date('2026-07-01T20:30:00Z'), 'Europe/Berlin'), { date: '2026-07-01', hour: 22 })
  // 23:30 UTC in winter is already the next day in Berlin (CET, UTC+1).
  assert.deepEqual(localDateHour(new Date('2026-01-10T23:30:00Z'), 'Europe/Berlin'), { date: '2026-01-11', hour: 0 })
})

test('midnight is hour 0, never 24', () => {
  assert.equal(localDateHour(new Date('2026-03-01T23:00:00Z'), 'Europe/Berlin').hour, 0)
})

const zero: DailyNumbers = {
  signups: 0, total_families: 0, new_children: 0, active_children: 0, active_children_7d: 0,
  sessions: 0, minutes: 0, lessons_done: 0, stories_done: 0, ai_stories: 0,
  ai_translate_pages: 0, ai_audio_pages: 0, temp_grants: 0, premium_active: 0, paying: 0,
  new_subscriptions: 0, leads_today: 0, leads_open: 0, feedback_today: 0, feedback_open: 0, drafts_pending: 0, word_images_pending: 0, covers_pending: 0,
}

test('the summary carries the day and Persian digits, and stays under Telegram\'s limit', () => {
  const text = formatSummary('2026-10-25', { ...zero, signups: 3, total_families: 120, active_children: 14 })
  assert.match(text, /2026-10-25/)
  assert.match(text, /ثبت‌نام امروز: ۳ \(کل: ۱۲۰\)/)
  assert.match(text, /کودک فعال امروز: ۱۴/)
  assert.ok(text.length < 4096)
})

test('the AI usage line only appears when there was AI usage', () => {
  assert.doesNotMatch(formatSummary('2026-10-25', zero), /مصرف هوش مصنوعی/)
  assert.match(formatSummary('2026-10-25', { ...zero, ai_audio_pages: 5 }), /مصرف هوش مصنوعی/)
})
