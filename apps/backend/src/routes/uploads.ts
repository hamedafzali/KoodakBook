import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { requireAuth } from '../middleware/auth'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'

// ensure subdirectories exist
for (const dir of ['audio', 'images', 'pdfs']) {
  fs.mkdirSync(path.join(UPLOADS_DIR, dir), { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const type = (req.params.type ?? 'images') as string
    const allowed = ['audio', 'images', 'pdfs']
    cb(null, path.join(UPLOADS_DIR, allowed.includes(type) ? type : 'images'))
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
    cb(null, name)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(mp3|wav|ogg|jpg|jpeg|png|webp|gif|pdf)$/i
    cb(null, allowed.test(file.originalname))
  },
})

const router = Router()

router.post('/:type', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) { res.status(400).json({ data: null, error: 'No file uploaded' }); return }
  const url = `/uploads/${req.params.type}/${req.file.filename}`
  res.json({ data: { url }, error: null })
})

export default router
