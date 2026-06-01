import 'dotenv/config'
import express from 'express'
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

const allowedOrigins = [
  process.env.WEB_URL   ?? 'http://localhost:3000',
  process.env.ADMIN_URL ?? 'http://localhost:3001',
]
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
  await seedAdmin()
})
