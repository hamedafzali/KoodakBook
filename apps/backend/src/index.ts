import 'dotenv/config'
import express from 'express'
import { migrate } from './lib/migrate'
import { seedAdmin } from './lib/seedAdmin'
import cors from 'cors'
import path from 'path'
import authRouter     from './routes/auth'
import childrenRouter from './routes/children'
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
import aiRouter       from './routes/ai'

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

// serve uploaded files
app.use('/uploads', express.static(path.resolve(UPLOADS_DIR)))

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth',      authRouter)
app.use('/api/children',  childrenRouter)
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
app.use('/api/ai',        aiRouter)

app.listen(PORT, async () => {
  console.log(`Backend running on http://localhost:${PORT}`)
  await migrate()
  await seedAdmin()
})
