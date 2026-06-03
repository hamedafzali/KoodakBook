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
import uploadsRouter  from './routes/uploads'
import adminRouter    from './routes/admin'

const app = express()
const PORT = process.env.PORT ?? 4000
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'

// Build allowed origins: explicit env vars + derive admin URL from WEB_URL if not set
function buildAllowedOrigins(): string[] {
  const origins = new Set<string>()

  // Always allow localhost variants for local dev
  origins.add('http://localhost:3000')
  origins.add('http://localhost:3001')
  origins.add('http://localhost:3002')

  const webUrl   = process.env.WEB_URL
  const adminUrl = process.env.ADMIN_URL

  if (webUrl)   origins.add(webUrl)
  if (adminUrl) origins.add(adminUrl)

  // If ADMIN_URL not set but WEB_URL is, derive admin URL by replacing the port
  if (webUrl && !adminUrl) {
    try {
      const u = new URL(webUrl)
      u.port = '3002'
      origins.add(u.toString().replace(/\/$/, ''))
      u.port = '3001'
      origins.add(u.toString().replace(/\/$/, ''))
    } catch { /* ignore malformed URL */ }
  }

  return [...origins]
}

const allowedOrigins = buildAllowedOrigins()
console.log('CORS allowed origins:', allowedOrigins.join(', '))

app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
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
app.use('/api/uploads',   uploadsRouter)
app.use('/api/admin',     adminRouter)

app.listen(PORT, async () => {
  console.log(`Backend running on http://localhost:${PORT}`)
  await migrate()
  await seedAdmin()
})
