# KoodakBook Mobile

React Native app (Expo SDK 57, expo-router). Talks to the same
`@koodakbook/backend` as web — same API, same database, so progress/badges
"sync" automatically across devices. Shares types and the API client from
`@koodakbook/shared`.

## Run (development)

```bash
cp .env.example .env   # point EXPO_PUBLIC_API_URL at a backend the DEVICE can reach
npm install            # from repo root
npx expo start         # from apps/mobile — scan QR with Expo Go, or press i / a
```

Notes:

- `EXPO_PUBLIC_API_URL` is the backend **origin** (no `/api` suffix — paths
  carry it). Never `localhost` on a physical phone: that's the phone itself.
  The home server backend is directly reachable at `http://192.168.178.37:4000`.
- Native requests send no `Origin` header, so the backend's CORS allowlist
  doesn't apply to the app — no backend change needed.
- The JWT lives in the device keychain via `expo-secure-store` ([lib/auth.ts](lib/auth.ts)).
- RTL: forced in [app/_layout.tsx](app/_layout.tsx) + `extra.supportsRTL` in
  app.json. In Expo Go the first launch may need one reload to flip.
- Env changes need a bundler restart; dependency changes need `expo start -c`.

## What's built

- **Auth**: parent email/password + kid username login; session-revocation
  bounce to login (shared `createApiClient` from `packages/shared`).
- **Home hub**: activity grid — قصه‌ها، درس‌ها، مرور، جایزه‌ها، دوست‌ها، ریاضی.
- **Stories**: catalogue + the child's AI «داستان‌های من» (create with theme
  picker), reader with illustrated scene backdrops, per-page audio + next-page
  prefetch, and self-healing AI-story audio (built on open, no manual step);
  progress/badges via the same endpoints as web.
- **Learning loop**: lessons (4 quiz modes, level-aware) + spaced-repetition
  review, feeding the same Leitner boxes as web.
- **Rewards**: earned-badges gallery. **Friends**: character roster + greeting
  lines (the «حرف بزنیم» chat stays web-only for now). **Math**: شمارش
  tap-to-count game (digits/bazaar pending).

## Builds (EAS)

Expo Go is dev-only. For real devices use EAS builds (profiles in
[eas.json](eas.json) — note each profile pins `EXPO_PUBLIC_API_URL`).
`production` points at the real public API (`https://koodakbook.eu.cc`,
fixed 2026-09-17 — it previously pointed at `api.koodakbook.com`, a domain
that has never resolved, which would have shipped a build unable to reach
the backend at all). `development`/`preview` still point at a home-server
LAN IP, which is correct for local device testing but means those two
profiles won't work for a tester who isn't on that LAN.

```bash
npm i -g eas-cli
eas login                      # your Expo account
eas build --profile preview --platform ios      # installable internal build
eas build --profile preview --platform android  # .apk for sideloading
```

Before a store release, in order:

1. **Link the project to EAS** — `eas init` (this repo has never been run
   through it; `app.json` has no `extra.eas.projectId` yet, and
   `eas.json`'s `cli.appVersionSource: "remote"` needs a linked project to
   track a `versionCode` against).
2. **Real icon/adaptive-icon art.** `app.json` now points at
   `assets/icon.png` / `assets/adaptive-icon.png` — the app's existing web
   icon, reused so the app isn't shipping Expo's default placeholder icon
   any more. It is NOT proper adaptive-icon art: Android's adaptive-icon
   mask crops to a safe zone of roughly the center 66% of the foreground
   image, and this icon's circle fills most of the 512×512 canvas with
   little margin, so it will likely look cropped on a real launcher.
   Replace `assets/adaptive-icon.png` with a version that has real padding
   before submitting (1024×1024 recommended).
3. **Store listing.** No screenshots, feature graphic, or store
   description exist anywhere in this repo yet — all still need to be
   produced before Play Console will accept a submission.
4. Then `eas build --profile production --platform android` + `eas
   submit`.

## What lives where

- `app/` — screens (expo-router file routing)
- `components/` — QuizCard (4 quiz modes), RewardPopup, SceneBackdrop,
  ScreenBackground, AuthScene
- `lib/` — api (shared client + SecureStore), media (absolutizes `/uploads`),
  sound (load-aware one-shot clips), prefs, theme
- Anything that isn't rendering (rules, formatting, level math) belongs in
  `packages/shared` or the backend — never duplicated here and in `apps/web`.
