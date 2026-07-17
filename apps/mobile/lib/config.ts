// Backend origin (no path) — see .env / .env.example. Unlike web, which rides
// Next.js rewrites, mobile talks to the backend directly, so both API calls
// and /uploads/... assets need this prefix.
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? ''
