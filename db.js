// db.js — SQLite database setup, schema, and seed data
//
// Uses Node's BUILT-IN SQLite (node:sqlite, Node 22.5+).
// No native compilation, no npm install needed for the DB driver —
// works identically on Windows, macOS, and Linux.
// Run with the --experimental-sqlite flag (already in npm scripts).
//
// Three related tables with indexes and foreign keys:
//   items    — products / workshops / events (the catalogue)
//   users    — registered accounts (member + admin roles)
//   bookings — joins users to items (with stock decrement on booking)
//
// Run `npm run seed` to (re-)create and seed the database.

import { DatabaseSync } from 'node:sqlite'
import bcrypt from 'bcryptjs'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const DB_PATH    = path.join(__dirname, 'data.db')

export const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA foreign_keys = ON')

// ============================================
// SCHEMA
// ============================================
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id          TEXT PRIMARY KEY,
    category    TEXT NOT NULL CHECK (category IN ('food','lifestyle','education','events')),
    name        TEXT NOT NULL,
    short_desc  TEXT NOT NULL,
    description TEXT NOT NULL,
    price       REAL NOT NULL DEFAULT 0,
    unit        TEXT NOT NULL DEFAULT '/one-time',
    image       TEXT NOT NULL,
    stock       INTEGER NOT NULL DEFAULT 0,
    tags        TEXT NOT NULL DEFAULT '[]',
    event_date  TEXT,
    location    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
  CREATE INDEX IF NOT EXISTS idx_items_name     ON items(name);

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name          TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('member','admin')) DEFAULT 'member',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

  CREATE TABLE IF NOT EXISTS bookings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER,
    item_id     TEXT NOT NULL,
    guest_name  TEXT,
    guest_email TEXT,
    qty         INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
    notes       TEXT,
    status      TEXT NOT NULL CHECK (status IN ('pending','confirmed','cancelled')) DEFAULT 'confirmed',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
  CREATE INDEX IF NOT EXISTS idx_bookings_item ON bookings(item_id);
`)

// ============================================
// SEED — only if `items` is empty
// ============================================
const itemCount = db.prepare('SELECT COUNT(*) AS c FROM items').get().c
if (itemCount === 0) {
  console.log('[db] Seeding initial items…')

  const seedItems = [
    { id: 'p1', category: 'food', name: 'Eco Veg Box',
      short_desc: 'Seasonal vegetables from local organic farms.',
      description: 'Our signature Eco Veg Box contains 5-7 varieties of seasonal, locally-sourced vegetables delivered fresh weekly. Every box supports organic farmers within 50 miles of you and arrives in compostable packaging.',
      price: 29, unit: '/week', stock: 42, tags: ['Organic','Local','Carbon-neutral'],
      image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&h=500&fit=crop' },
    { id: 'p2', category: 'lifestyle', name: 'Zero-Waste Starter Kit',
      short_desc: 'Reusable bags, jars, and utensils to begin your zero-waste journey.',
      description: 'A complete kit of reusable produce bags, stainless-steel utensils, glass food jars, and beeswax wraps. Designed with zero-waste educators.',
      price: 49, unit: '/one-time', stock: 18, tags: ['Reusable','Plastic-free'],
      image: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&h=500&fit=crop' },
    { id: 'p3', category: 'food', name: 'Seasonal Fruit Basket',
      short_desc: 'Fresh seasonal fruits from local orchards.',
      description: 'A weekly selection of seasonal, organic fruit from orchards within 50 miles. Perfect for smoothies and lunchboxes.',
      price: 35, unit: '/week', stock: 27, tags: ['Organic','Seasonal'],
      image: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=800&h=500&fit=crop' },
    { id: 'p4', category: 'lifestyle', name: 'Herb Garden Kit',
      short_desc: 'Grow your own herbs at home with biodegradable pots.',
      description: 'Five varieties of organic herb seeds (basil, parsley, coriander, mint, thyme), peat-free soil, and biodegradable coir pots.',
      price: 32, unit: '/one-time', stock: 35, tags: ['DIY','Organic'],
      image: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800&h=500&fit=crop' },
    { id: 'p5', category: 'lifestyle', name: 'Bamboo Essentials',
      short_desc: 'Sustainable bamboo kitchen and bathroom essentials.',
      description: 'Bamboo toothbrushes, cutlery, cotton buds, and dish brushes. Fully biodegradable and ethically FSC-certified.',
      price: 24, unit: '/one-time', stock: 60, tags: ['Biodegradable','Plastic-free'],
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=500&fit=crop' },
    { id: 'p6', category: 'food', name: 'Local Raw Honey',
      short_desc: 'Unfiltered honey from local beekeepers.',
      description: 'Raw, unprocessed honey from small-scale apiaries within 50 miles. Each jar supports wild pollinator habitat restoration.',
      price: 18, unit: '/jar', stock: 22, tags: ['Raw','Local'],
      image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=500&fit=crop' },
    { id: 'w1', category: 'education', name: 'Home Composting 101',
      short_desc: 'Turn kitchen scraps into garden gold in 90 minutes.',
      description: 'A practical hands-on workshop covering composting methods and troubleshooting. Take home a starter bokashi kit.',
      price: 25, unit: '/seat', stock: 12, tags: ['Beginner','Hands-on'],
      event_date: '2026-06-14', location: 'Colombo Community Garden',
      image: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800&h=500&fit=crop' },
    { id: 'w2', category: 'education', name: 'Plant-Based Cooking Basics',
      short_desc: 'Three sustainable, budget-friendly weeknight meals.',
      description: 'Chef-led cooking workshop with three plant-based meals using seasonal produce. All ingredients and equipment provided.',
      price: 40, unit: '/seat', stock: 8, tags: ['Cooking','Plant-based'],
      event_date: '2026-06-22', location: 'Urban Harvest Kitchen Studio',
      image: 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=800&h=500&fit=crop' },
    { id: 'w3', category: 'education', name: 'DIY Natural Cleaning Products',
      short_desc: 'Replace your cleaning cupboard with safe, low-cost alternatives.',
      description: 'Make all-purpose spray, laundry powder, and dish soap from simple ingredients. Take bottles of each home.',
      price: 20, unit: '/seat', stock: 15, tags: ['DIY','Zero-waste'],
      event_date: '2026-07-05', location: 'Colombo Community Garden',
      image: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&h=500&fit=crop' },
    { id: 'e1', category: 'events', name: 'Saturday Farmers Market',
      short_desc: 'Weekly market with 30+ local growers.',
      description: 'Seasonal produce, prepared food, live music, and free composting advice from our community team.',
      price: 0, unit: '/free', stock: 200, tags: ['Free','Family-friendly'],
      event_date: '2026-06-07', location: 'Galle Face Green',
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=500&fit=crop' },
    { id: 'e2', category: 'events', name: 'Community Tree Planting',
      short_desc: 'Help plant 500 native trees along the canal.',
      description: 'Volunteer-led tree planting day. Tools, gloves, and lunch provided - bring a reusable water bottle.',
      price: 0, unit: '/free', stock: 80, tags: ['Volunteer','Free'],
      event_date: '2026-06-28', location: 'Diyawanna Canal Park',
      image: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800&h=500&fit=crop' },
  ]

  const insert = db.prepare(`
    INSERT INTO items (id, category, name, short_desc, description, price, unit, image, stock, tags, event_date, location)
    VALUES (@id, @category, @name, @short_desc, @description, @price, @unit, @image, @stock, @tags, @event_date, @location)
  `)
  for (const r of seedItems) {
    insert.run({
      id: r.id, category: r.category, name: r.name, short_desc: r.short_desc,
      description: r.description, price: r.price, unit: r.unit, image: r.image,
      stock: r.stock, tags: JSON.stringify(r.tags ?? []),
      event_date: r.event_date ?? null, location: r.location ?? null,
    })
  }
  console.log(`[db] Seeded ${seedItems.length} items.`)
}

// Seed default admin if no users exist
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c
if (userCount === 0) {
  const hash = bcrypt.hashSync('admin123', 10)
  db.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)')
    .run('admin@urbanharvest.local', hash, 'Admin User', 'admin')
  console.log('[db] Seeded default admin: admin@urbanharvest.local / admin123')
}

// Helper to deserialise the JSON tags column into an array
export function rowToItem(row) {
  if (!row) return null
  return { ...row, tags: JSON.parse(row.tags || '[]') }
}

// If run directly (npm run seed), exit cleanly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('[db] Done.')
  process.exit(0)
}
