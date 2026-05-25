// middleware/validate.js — request body validators
//
// Each validator returns { valid, errors } so route handlers can short-circuit
// with a clean 400 response.

const VALID_CATEGORIES = ['food', 'lifestyle', 'education', 'events']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateItem(body, { partial = false } = {}) {
  const errors = []
  const required = ['id','category','name','short_desc','description','image']

  if (!partial) {
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || body[f] === '') {
        errors.push(`Field '${f}' is required`)
      }
    }
  }

  if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category)) {
    errors.push(`Field 'category' must be one of: ${VALID_CATEGORIES.join(', ')}`)
  }
  if (body.price !== undefined && (typeof body.price !== 'number' || body.price < 0)) {
    errors.push("Field 'price' must be a non-negative number")
  }
  if (body.stock !== undefined && (!Number.isInteger(body.stock) || body.stock < 0)) {
    errors.push("Field 'stock' must be a non-negative integer")
  }
  if (body.tags !== undefined && !Array.isArray(body.tags)) {
    errors.push("Field 'tags' must be an array")
  }
  if (body.name !== undefined && typeof body.name === 'string' && body.name.length > 200) {
    errors.push("Field 'name' must be 200 characters or fewer")
  }

  return { valid: errors.length === 0, errors }
}

export function validateBooking(body) {
  const errors = []
  if (!body.item_id) errors.push("Field 'item_id' is required")
  if (body.qty !== undefined && (!Number.isInteger(body.qty) || body.qty < 1)) {
    errors.push("Field 'qty' must be a positive integer")
  }
  // For guest bookings (no user_id), require name + email
  if (!body.user_id) {
    if (!body.guest_name || !body.guest_name.trim()) {
      errors.push("Field 'guest_name' is required for guest bookings")
    }
    if (!body.guest_email) {
      errors.push("Field 'guest_email' is required for guest bookings")
    } else if (!EMAIL_RE.test(body.guest_email)) {
      errors.push("Field 'guest_email' must be a valid email")
    }
  }
  return { valid: errors.length === 0, errors }
}

export function validateUser(body) {
  const errors = []
  if (!body.email)                    errors.push("Field 'email' is required")
  else if (!EMAIL_RE.test(body.email)) errors.push("Field 'email' must be a valid email")
  if (!body.password || body.password.length < 6) {
    errors.push("Field 'password' must be at least 6 characters")
  }
  if (!body.name || !body.name.trim()) {
    errors.push("Field 'name' is required")
  }
  return { valid: errors.length === 0, errors }
}
