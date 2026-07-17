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
  The home server backend is directly reachable at `http://192.168.178.34:4000`.
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
  picker, «ساخت صدا»), reader with per-page audio + next-page prefetch,
  progress/badges via the same endpoints as web.
- **Offline packs**: ⬇️ آفلاین on any story downloads JSON + images + audio to
  the device ([lib/offline.ts](lib/offline.ts)); the reader and the list fall
  back to packs when there's no network.
- **Learning loop**: lessons (4 quiz modes, level-aware) + spaced-repetition
  review, feeding the same Leitner boxes as web.
- **Rewards**: earned-badges gallery. **Friends**: character roster + greeting
  lines (the «حرف بزنیم» chat stays web-only for now). **Math**: شمارش
  tap-to-count game (digits/bazaar pending).

## Builds (EAS)

Expo Go is dev-only. For real devices use EAS builds (profiles in
[eas.json](eas.json) — note each profile pins `EXPO_PUBLIC_API_URL`; adjust the
production URL when the public domain is final):

```bash
npm i -g eas-cli
eas login                      # your Expo account
eas build --profile preview --platform ios      # installable internal build
eas build --profile preview --platform android  # .apk for sideloading
```

Before a store release: add real icon/splash assets in app.json, set
`production.env.EXPO_PUBLIC_API_URL` to the public HTTPS API, then
`eas build --profile production` + `eas submit`.

## What lives where

- `app/` — screens (expo-router file routing)
- `components/` — QuizCard (4 quiz modes), RewardPopup
- `lib/` — api (shared client + SecureStore), media (absolutizes `/uploads`,
  passes `file://`), offline (story packs), sound (one-shot clips), theme
- Anything that isn't rendering (rules, formatting, level math) belongs in
  `packages/shared` or the backend — never duplicated here and in `apps/web`.
