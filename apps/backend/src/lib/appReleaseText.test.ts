import { test } from 'node:test'
import assert from 'node:assert/strict'
import { releasePostText } from './appReleaseText'
import { validDraftText } from './postGuard'

const HOST = 'koodakbook.eu.cc'

test('the release announcement passes the channel content gate', () => {
  const plain = releasePostText({ version_name: '0.1.0', notes: null }, `https://${HOST}/`)
  assert.ok(validDraftText(plain, { allowedLinkHost: HOST }), plain)
  assert.match(plain, /https:\/\/koodakbook\.eu\.cc\/app/)

  const withNotes = releasePostText({ version_name: '0.2.0', notes: 'بازی‌های تازه و رفع چند اشکال کوچک' }, `https://${HOST}`)
  assert.ok(validDraftText(withNotes, { allowedLinkHost: HOST }), withNotes)
})
