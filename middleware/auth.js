// middleware/auth.js — JWT verification + role guard
import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

/** Attaches req.user if a valid Bearer token is present. Does NOT block. */
export function attachUser(req, _res, next) {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), SECRET)
    } catch {
      // ignore invalid tokens — protected routes will reject
    }
  }
  next()
}

/** Blocks the request if there is no authenticated user. */
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' })
  next()
}

/** Blocks the request unless req.user.role === 'admin'. */
export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' })
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin role required' })
  }
  next()
}

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' })
}
