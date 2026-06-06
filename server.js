// server.js — Express application entry point
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { attachUser } from './middleware/auth.js'
import './db.js'                       // ensures DB is created + seeded on boot
import itemsRouter    from './routes/items.js'
import bookingsRouter from './routes/bookings.js'
import authRouter     from './routes/auth.js'

const app  = express()
const PORT = process.env.PORT || 4000

// ---- Global middleware ----
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
app.use(express.json())
app.use(attachUser)                    // populates req.user if a token is present

// ---- Health check ----
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// ---- Routes ----
app.use('/api/items',    itemsRouter)
app.use('/api/bookings', bookingsRouter)
app.use('/api/auth',     authRouter)

// ---- 404 fallback for unknown API routes ----
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

// ---- Centralised error handler ----
app.use((err, _req, res, _next) => {
  console.error('[error]', err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`🌱 Urban Harvest API running on http://localhost:${PORT}`)
})

export default app
// TEMP: raw db viewer (remove before final submission)
app.get('/api/debug/tables', (_req, res) => {
  const items    = db.prepare('SELECT * FROM items').all()
  const bookings = db.prepare('SELECT * FROM bookings').all()
  const users    = db.prepare('SELECT id, email, name, role FROM users').all()
  res.json({ items, bookings, users })
})