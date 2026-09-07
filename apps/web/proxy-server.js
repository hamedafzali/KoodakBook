// Public entrypoint for the web container (parity phase 3, multiplayer pass).
//
// In production only THIS container has a route through the Cloudflare
// tunnel — backend has none (see docker-compose.yml) — and next.config.ts's
// `rewrites()` only proxies plain HTTP, not a WebSocket upgrade. So a
// same-origin `/socket.io` connection from the browser (apps/web/src/lib/
// socket.ts) has nowhere to land unless something in this container forwards
// it on. That's the only job of this file: it wraps Next's generated
// standalone server, which keeps running unmodified on an internal-only
// port, and puts one thin listener in front of it on the real published
// port — `/socket.io/*` (HTTP polling and the WS upgrade both) goes to the
// backend's socket.io server, everything else passes straight through to
// Next exactly as it did before this file existed.
const { spawn } = require('child_process')
const http = require('http')
const httpProxy = require('http-proxy')

const PORT = Number(process.env.PORT) || 3000
const NEXT_PORT = Number(process.env.NEXT_INTERNAL_PORT) || 3999
const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:4000'

const next = spawn(process.execPath, ['apps/web/server.js'], {
  stdio: 'inherit',
  // Docker sets HOSTNAME on every container to the container ID, and Next's
  // standalone server.js does `process.env.HOSTNAME || '0.0.0.0'` — so left
  // alone, Next binds to that container-ID hostname instead of loopback, and
  // this proxy's fixed `127.0.0.1:${NEXT_PORT}` target below can never reach
  // it (ECONNREFUSED, 100% of requests). Override it explicitly.
  env: { ...process.env, PORT: String(NEXT_PORT), HOSTNAME: '127.0.0.1' },
})
next.on('exit', (code, signal) => {
  console.error(`[proxy] Next process exited (code=${code}, signal=${signal}) — shutting down`)
  process.exit(code ?? 1)
})
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => { next.kill(sig); process.exit(0) })
}

const proxy = httpProxy.createProxyServer({ ws: true })
proxy.on('error', (err, _req, res) => {
  console.error('[proxy] upstream error:', err.message)
  if (res && 'writeHead' in res && !res.headersSent) { res.writeHead(502); res.end('bad gateway') }
})

function targetFor(url) {
  return url.startsWith('/socket.io') ? BACKEND_URL : `http://127.0.0.1:${NEXT_PORT}`
}

const server = http.createServer((req, res) => {
  proxy.web(req, res, { target: targetFor(req.url) })
})
server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head, { target: targetFor(req.url) })
})
server.listen(PORT, () => {
  console.log(`[proxy] listening on :${PORT} — /socket.io -> ${BACKEND_URL}, everything else -> :${NEXT_PORT}`)
})
