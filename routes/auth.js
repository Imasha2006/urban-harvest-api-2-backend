// routes/auth.js — registration & login
//
// POST /api/auth/register   create a member account
// POST /api/auth/login      exchange credentials for a JWT
// GET  /api/auth/me         return the current user (requires token)

import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db.js'
import { validateUser } from '../middleware/validate.js'
import { signToken, requireAuth } from '../middleware/auth.js'

const router = Router()

router.post('/register', (req, res, next) => {
  try {
    const { valid, errors } = validateUser(req.body)
    if (!valid) return res.status(400).json({ error: 'Validation failed', details: errors })

    const existing = db.prepare('SELECT 1 FROM users WHERE email = ?').get(req.body.email)
    if (existing) return res.status(409).json({ error: 'Email already registered' })

    const hash = bcrypt.hashSync(req.body.password, 10)
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
    ).run(req.body.email, hash, req.body.name, 'member')

    const user = { id: result.lastInsertRowid, email: req.body.email, name: req.body.name, role: 'member' }
    const token = signToken(user)
    res.status(201).json({ user, token })
  } catch (err) { next(err) }
})

router.post('/login', (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }
    const user = { id: row.id, email: row.email, name: row.name, role: row.role }
    const token = signToken(user)
    res.json({ user, token })
  } catch (err) { next(err) }
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

export default router
