# KoodakBook Mobile

React Native app (Expo SDK 57, expo-router). Talks to the same
`@koodakbook/backend` as web — same API, same database, so progress/badges
"sync" automatically across devices. Shares types and the API client from
`@koodakbook/shared`.

## Run

```bash
cp .env.example .env   # point EXPO_PUBLIC_API_URL at a backend the DEVICE can reach
npm install            # from repo root
npx expo start         # from apps/mobile — scan QR with Expo Go, or press i / a
```

Notes:

- `EXPO_PUBLIC_API_URL` is the backend **origin** (no `/api` suffix — paths
  carry it). Never `localhost`: that's the phone. Use your Mac's LAN IP for a
  local backend (`http://<mac-ip>:4000`) or the home server (`http://192.168.178.34`).
- Native requests send no `Origin` header, so the backend's CORS allowlist
  doesn't apply to the app — no backend change needed.
- The JWT is stored in the device keychain via `expo-secure-store`
  ([lib/auth.ts](lib/auth.ts)), mirroring web's `lib/auth.ts`.
- RTL: forced in [app/_layout.tsx](app/_layout.tsx) + `extra.supportsRTL` in
  app.json. In Expo Go the first launch may need one reload to flip.

## What lives where

- `app/` — screens (expo-router file routing)
- `lib/api.ts` — instantiates the shared `createApiClient` with SecureStore + router
- Anything that isn't rendering (rules, formatting, level math) belongs in
  `packages/shared` or the backend — never duplicated here and in `apps/web`.
