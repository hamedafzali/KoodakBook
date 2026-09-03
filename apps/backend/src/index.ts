import 'dotenv/config'
import express from 'express'
import http from 'http'
import { Server as SocketServer } from 'socket.io'
import { migrate } from './lib/migrate'
import { seedAdmin } from './lib/seedAdmin'
import { setupRealtime } from './lib/realtime'
import cors from 'cors'
import path from 'path'
import authRouter     from './routes/auth'
import childrenRouter from './routes/children'
import plansRouter    from './routes/plans'
import curriculumRouter from './routes/curriculum'
import progressRouter from './routes/progress'
import badgesRouter   from './routes/badges'
import dashboardRouter from './routes/dashboard'
import placementRouter from './routes/placement'
import uploadsRouter  from './routes/uploads'
import adminRouter    from './routes/admin'
import adminUsersRouter from './routes/adminUsers'
import adminTeamRouter from './routes/adminTeam'
import adminAnalyticsRouter from './routes/adminAnalytics'
import adminPlansRouter from './routes/adminPlans'
import adminAiSettingsRouter from './routes/adminAiSettings'
import adminAudioRouter from './routes/adminAudio'
import adminImagesRouter from './routes/adminImages'
import adminWordImagesRouter from './routes/adminWordImages'
import adminStoryCoversRouter from './routes/adminStoryCovers'
import adminPostDraftsRouter from './routes/adminPostDrafts'
import charactersRouter from './routes/characters'
import friendsRouter  from './routes/friends'
import leadsRouter    from './routes/leads'
import aiRouter       from './routes/ai'
import { errorHandler } from './middleware/errorHandler'

const app = express()
const PORT = process.env.PORT ?? 4000
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'

// Explicitly configured origins
const explicitOrigins = new Set<string>(
  [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    process.env.WEB_URL,
    process.env.ADMIN_URL,
  ].filter(Boolean) as string[]
)

// Allow any origin on the standard app ports (3000-3002) so LAN access via
// any hostname or IP works without needing to configure every variation.
const APP_PORTS = new Set(['3000', '3001', '3002'])

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true  // same-origin / server-to-server
  if (explicitOrigins.has(origin)) return true
  try {
    const port = new URL(origin).port
    if (APP_PORTS.has(port)) return true
  } catch { /* malformed origin */ }
  return false
}

app.use(cors({
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
  credentials: true,
}))
app.use(express.json())

// Serve uploaded files. Every upload path in this codebase embeds a
// timestamp/random suffix (e.g. `${id}-${Date.now()}.ext`) and a changed
// asset always gets a new filename rather than overwriting the old one —
// so these are safe to cache as immutable for a long time; the default
// `max-age=0` was forcing a revalidation round-trip on every single load.
app.use('/uploads', express.static(path.resolve(UPLOADS_DIR), {
  maxAge: '30d',
  immutable: true,
}))

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth',      authRouter)
app.use('/api/children',  childrenRouter)
app.use('/api/plans',     plansRouter)
app.use('/api',           curriculumRouter)
app.use('/api/progress',  progressRouter)
app.use('/api/badges',    badgesRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/placement', placementRouter)
app.use('/api/uploads',   uploadsRouter)
app.use('/api/admin',     adminRouter)
app.use('/api/admin',     adminUsersRouter)
app.use('/api/admin',     adminTeamRouter)
app.use('/api/admin',     adminAnalyticsRouter)
app.use('/api/admin',     adminPlansRouter)
app.use('/api/admin',     adminAiSettingsRouter)
app.use('/api/admin',     adminAudioRouter)
app.use('/api/admin',     adminImagesRouter)
app.use('/api/admin',     adminWordImagesRouter)
app.use('/api/admin',     adminStoryCoversRouter)
app.use('/api/admin',     adminPostDraftsRouter)
app.use('/api/characters', charactersRouter)
app.use('/api/friends',   friendsRouter)
app.use('/api/leads',     leadsRouter)
app.use('/api/ai',        aiRouter)

// Must be registered after every route — see errorHandler.ts.
app.use(errorHandler)

// Wrap Express in an HTTP server so Socket.IO can share the port. Native app
// clients send no Origin, so allow any (the JWT handshake is the real gate).
const server = http.createServer(app)
const io = new SocketServer(server, { cors: { origin: '*' } })
setupRealtime(io)

server.listen(PORT, async () => {
  console.log(`Backend running on http://localhost:${PORT}`)
  await migrate()
  await seedAdmin()
})
