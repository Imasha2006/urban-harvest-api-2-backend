// routes/items.js — REST CRUD for catalogue items
//
// GET    /api/items              list + filter ?category=...&search=...
// GET    /api/items/:id          single item
// POST   /api/items              create (admin)
// PUT    /api/items/:id          full update (admin)
// PATCH  /api/items/:id          partial update (admin)
// DELETE /api/items/:id          delete (admin)

import { Router } from 'express'
import { db, rowToItem } from '../db.js'
import { validateItem } from '../middleware/validate.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

// LIST — supports ?category=food&search=honey
router.get('/', (req, res, next) => {
  try {
    const { category, search } = req.query
    const clauses = []
    const params  = {}
    if (category) { clauses.push('category = @category'); params.category = category }
    if (search)   { clauses.push('(name LIKE @q OR short_desc LIKE @q)'); params.q = `%${search}%` }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const rows = db.prepare(`SELECT * FROM items ${where} ORDER BY created_at DESC`).all(params)
    res.json(rows.map(rowToItem))
  } catch (err) { next(err) }
})

// READ ONE
router.get('/:id', (req, res, next) => {
  try {
    const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Item not found' })
    res.json(rowToItem(row))
  } catch (err) { next(err) }
})

// CREATE (admin)
router.post('/', requireAdmin, (req, res, next) => {
  try {
    const { valid, errors } = validateItem(req.body)
    if (!valid) return res.status(400).json({ error: 'Validation failed', details: errors })

    const exists = db.prepare('SELECT 1 FROM items WHERE id = ?').get(req.body.id)
    if (exists) return res.status(409).json({ error: 'Item with this id already exists' })

    const params = {
      id: req.body.id,
      category: req.body.category,
      name: req.body.name,
      short_desc: req.body.short_desc,
      description: req.body.description,
      price: req.body.price ?? 0,
      unit: req.body.unit ?? '/one-time',
      image: req.body.image,
      stock: req.body.stock ?? 0,
      tags: JSON.stringify(req.body.tags ?? []),
      event_date: req.body.event_date ?? null,
      location: req.body.location ?? null,
    }
    db.prepare(`
      INSERT INTO items (id, category, name, short_desc, description, price, unit, image, stock, tags, event_date, location)
      VALUES (@id, @category, @name, @short_desc, @description, @price, @unit, @image, @stock, @tags, @event_date, @location)
    `).run(params)

    const row = db.prepare('SELECT * FROM items WHERE id = ?').get(params.id)
    res.status(201).json(rowToItem(row))
  } catch (err) { next(err) }
})

// UPDATE (admin) — accepts both PUT and PATCH
function update(req, res, next, partial) {
  try {
    const { valid, errors } = validateItem(req.body, { partial })
    if (!valid) return res.status(400).json({ error: 'Validation failed', details: errors })

    const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Item not found' })

    const next_ = { ...rowToItem(existing), ...req.body }
    db.prepare(`
      UPDATE items SET
        category = @category, name = @name, short_desc = @short_desc,
        description = @description, price = @price, unit = @unit,
        image = @image, stock = @stock, tags = @tags,
        event_date = @event_date, location = @location,
        updated_at = datetime('now')
      WHERE id = @id
    `).run({
      ...next_,
      id: req.params.id,
      tags: JSON.stringify(next_.tags ?? []),
      event_date: next_.event_date ?? null,
      location:   next_.location ?? null,
    })

    const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id)
    res.json(rowToItem(row))
  } catch (err) { next(err) }
}
router.put  ('/:id', requireAdmin, (req, res, next) => update(req, res, next, false))
router.patch('/:id', requireAdmin, (req, res, next) => update(req, res, next, true))

// DELETE (admin)
router.delete('/:id', requireAdmin, (req, res, next) => {
  try {
    const result = db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id)
    if (result.changes === 0) return res.status(404).json({ error: 'Item not found' })
    res.status(204).end()
  } catch (err) { next(err) }
})

export default router
