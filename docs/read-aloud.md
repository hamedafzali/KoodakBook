# Read-aloud recordings

The north-star event is *"a child reads a story aloud to a grandparent"*. Until
now it had no interface and no data — the parent dashboard couldn't even count
it, which is why the dashboard's lead number is "stories finished" and not
"stories read aloud".

This document covers the **record-only** half, which is what ships. The child
records; the parent listens. Delivery to a grandparent, and a voice reply back,
are deliberately not built — see *Not built* below.

## Why record-only first

Recording and delivery look like one feature and are not. Recording needs a
microphone, a blob store, a consent model and a retention policy. Delivery needs
all of that **plus** an identity model for people who are not account holders,
an invite flow, a notification channel, and a moderation story for audio leaving
the family. Shipping the first half proves the moment is worth building — if
children don't record, there is nothing to deliver.

The record-only half also stands on its own. Hearing your own voice read a book
is the reward for a pre-reader; it does not depend on a grandparent existing.

## The privacy surface, and why it needed new machinery

This is the **first time the product stores a child's voice**. Nothing in the
codebase was shaped for that:

- `lib/recognition.ts` is not precedent. It uses the Web Speech API, which
  returns a transcript and retains no audio.
- **`/api/uploads` could not be reused.** It writes into `UPLOADS_DIR`, which
  `index.ts` serves with `express.static` at `immutable, max-age=30d`, and which
  `nginx` in `docker-compose.prod.yml` mounts read-only and serves too. That is
  correct for story art and TTS clips, which are identical for every family. It
  would have published every child's voice on a permanent, unauthenticated URL.
- No consent model existed anywhere in the schema.
- No retention model existed anywhere in the schema.

So the feature introduces all four, and they are the load-bearing parts:

| Control | Where | Rule |
|---|---|---|
| Consent | `users.read_aloud_consent_at` (mig 061) | Null by default. `POST /api/read-aloud` returns 403 without it. Set only by a parent-scope session — a kid-login shares the parent's account id, so `requireParent` is what stops a child consenting on their parent's behalf. |
| Private storage | `READ_ALOUD_DIR`, its own Docker volume | Not inside `UPLOADS_DIR`, and never mounted into nginx. Nothing serves it statically. |
| Authenticated playback | `GET /api/read-aloud/:id/audio` | Ownership checked by joining `children.parent_id`; a kid-login is additionally locked to its own `child_id`. Responds `Cache-Control: no-store, private`. |
| Expiry | `read_aloud_recordings.expires_at`, never null | 30 days by default (`READ_ALOUD_TTL_DAYS`). A sweeper in `index.ts` deletes row and file together every 6h. A parent opts one recording out with `kept = true`. |

Two consequences worth stating plainly:

- **The audio has no URL.** `ReadAloudRecording` in `packages/shared` has no
  `url` field, and that absence is the design. The parent app fetches each clip
  as a blob with the JWT attached and plays it from an object URL — an
  `<audio src>` pointing at the API would not send the header, and making it
  work without one would mean a link that plays a child's voice for anyone
  holding it.
- **Temporary is the default.** Keeping a recording is an explicit act. This is
  backwards from how the rest of the app treats data, and deliberately so.

## The child's side

`components/child/ReadAloud.tsx`, shown after the last page of a story — not in
a share menu, not on a settings page. The emotional charge is already there.

Four rules the component follows:

1. **Skippable in one press, always.** «الان نه». A prompt a child can't escape
   turns the end of a story into a chore.
2. **They hear themselves before anything is sent.** This is the reward, and it
   is local — the blob never leaves the device until they press keep.
3. **Recording shows sound.** A level ring driven by an `AnalyserNode`, not a
   spinner. A five-year-old cannot tell "listening" from "broken".
4. **No score, no stars, no "great job!"** The under-gamified constraint applies
   hardest at the emotional peak.

`lib/readAloud.ts` owns the recorder. It stops the media stream on every exit
path including unmount (a mic indicator left on after the child walks away is
the worst possible bug here), stops itself at `MAX_MS` (nothing about a
five-year-old guarantees they press stop), and treats a sub-512-byte blob as a
failure rather than uploading silence.

Container support differs — webm/opus on Chrome and Firefox, mp4/aac on Safari
— so the client asks for the best available and the server accepts all of them
rather than forcing a transcode the pilot doesn't need.

## The parent's side

- `/parent/settings` → «صدای کودک». Its own section, not a row inside «تنظیمات
  یادگیری»: consent to record a child is not the same kind of decision as
  picking a daily goal, and burying it next to one would misrepresent what is
  being agreed to. The three things being agreed to — parent-only playback,
  30-day auto-delete, off means off — are stated at the switch, not in a privacy
  page nobody opens.
- `/parent/recordings`. Flat register. Unheard clips carry a «تازه» chip, so
  what's new reads without parsing dates. Keep, delete (with confirmation,
  because it's irreversible and sits next to keep), and the retention rule
  restated where its consequence is visible.

## Not built

- **Delivery to a grandparent, and a voice reply back.** The reason the
  dashboard's primary action points at `/parent/share` and says so in a comment.
- **Transcoding.** Clips are stored in whatever container the recording browser
  produced. Fine within a family on modern browsers; would need addressing
  before audio is sent to an arbitrary recipient's device.
- **Any read-aloud number on the parent dashboard.** The data now exists, but
  one pilot's worth of recordings is not a metric yet, and a count of one is
  worse than no count.
- **Deleting recordings when consent is switched off.** Off stops new recordings
  and nothing else; existing clips stay until they expire or the parent deletes
  them. That is the less surprising behaviour, but it is a choice, and a
  "delete everything" action belongs here if the pilot asks for it.
