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

1. **Link the project to EAS** — done, 2026-09-17 (`extra.eas.projectId`
   in `app.json`, project `@hamed.afzali/koodakbook`).
2. **Icon/adaptive-icon art.** `app.json` points at `assets/icon.png` /
   `assets/adaptive-icon.png` — سیمرغ (Simorgh), rendered as static SVG
   straight from the `pixel-wizards-charachters` rig
   (`renderActorSVG(CHARACTERS.simorgh, {...defaultFrame('simorgh'),
   emotion:'happy'}, 1024)`, apps/mobile/assets/simorgh-source.svg is the
   source) and rasterized with `sharp` -- not app-local art, not a design
   placeholder, the same character the app already uses for the placement
   mini-game. `icon.png` is the character on the brand cream background
   (#FFF3DE); `adaptive-icon.png` shrinks it to ~62% of the canvas,
   transparent-padded, so Android's adaptive-icon mask (crops to roughly
   the center 66%) doesn't clip the wingtips or crest. Regenerate either
   at a different size/emotion by re-running the node snippet against
   `pixel-wizards-charachters` and re-rasterizing with `sharp`.
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
