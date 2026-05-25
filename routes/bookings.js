// routes/bookings.js — REST CRUD for bookings
//
// GET    /api/bookings         list all (admin) or own (member)
// GET    /api/bookings/:id     single
// POST   /api/bookings         create (public — guests allowed)
// PATCH  /api/bookings/:id     update status (admin)
// DELETE /api/bookings/:id     cancel/delete

import { Router } from 'express'
import { db } from '../db.js'
import { validateBooking } from '../middleware/validate.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()

// LIST — admins see all; members see only their own. JOINs item + user.
router.get('/', requireAuth, (req, res, next) => {
  try {
    const base = `
      SELECT b.*, i.name AS item_name, i.price AS item_price, i.image AS item_image,
             u.name AS user_name, u.email AS user_email
      FROM bookings b
      LEFT JOIN items i ON i.id = b.item_id
      LEFT JOIN users u ON u.id = b.user_id
    `
    const rows = req.user.role === 'admin'
      ? db.prepare(`${base} ORDER BY b.created_at DESC`).all()
      : db.prepare(`${base} WHERE b.user_id = ? ORDER BY b.created_at DESC`).all(req.user.id)
    res.json(rows)
  } catch (err) { next(err) }
})

// READ ONE
router.get('/:id', requireAuth, (req, res, next) => {
  try {
    const row = db.prepare(`
      SELECT b.*, i.name AS item_name, i.image AS item_image
      FROM bookings b LEFT JOIN items i ON i.id = b.item_id
      WHERE b.id = ?
    `).get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Booking not found' })
    if (req.user.role !== 'admin' && row.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your booking' })
    }
    res.json(row)
  } catch (err) { next(err) }
})

// CREATE — public, supports guest bookings. Decrements stock in a transaction.
router.post('/', (req, res, next) => {
  try {
    const { valid, errors } = validateBooking(req.body)
    if (!valid) return res.status(400).json({ error: 'Validation failed', details: errors })

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.body.item_id)
    if (!item) return res.status(404).json({ error: 'Item not found' })

    const qty = req.body.qty ?? 1
    if (item.stock < qty) {
      return res.status(409).json({ error: 'Not enough stock', available: item.stock })
    }

    // Atomic: insert booking + decrement stock together.
    // node:sqlite has no .transaction() helper, so we drive BEGIN/COMMIT
    // manually and roll back on any error.
    let id
    db.exec('BEGIN')
    try {
      const result = db.prepare(`
        INSERT INTO bookings (user_id, item_id, guest_name, guest_email, qty, notes, status)
        VALUES (@user_id, @item_id, @guest_name, @guest_email, @qty, @notes, 'confirmed')
      `).run({
        user_id:     req.body.user_id ?? null,
        item_id:     req.body.item_id,
        guest_name:  req.body.guest_name ?? null,
        guest_email: req.body.guest_email ?? null,
        qty,
        notes:       req.body.notes ?? null,
      })
      db.prepare('UPDATE items SET stock = stock - ? WHERE id = ?').run(qty, req.body.item_id)
      db.exec('COMMIT')
      id = result.lastInsertRowid
    } catch (txErr) {
      db.exec('ROLLBACK')
      throw txErr
    }
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id)
    res.status(201).json(booking)
  } catch (err) { next(err) }
})

// UPDATE status (admin)
router.patch('/:id', requireAdmin, (req, res, next) => {
  try {
    const allowed = ['pending', 'confirmed', 'cancelled']
    if (!allowed.includes(req.body.status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` })
    }
    const result = db.prepare('UPDATE bookings SET status = ? WHERE id = ?')
      .run(req.body.status, req.params.id)
    if (result.changes === 0) return res.status(404).json({ error: 'Booking not found' })
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id)
    res.json(booking)
  } catch (err) { next(err) }
})

// DELETE (admin)
router.delete('/:id', requireAdmin, (req, res, next) => {
  try {
    const result = db.prepare('DELETE FROM bookings WHERE id = ?').run(req.params.id)
    if (result.changes === 0) return res.status(404).json({ error: 'Booking not found' })
    res.status(204).end()
  } catch (err) { next(err) }
})

export default router
