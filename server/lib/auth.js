// Minimal auth for a single fixed admin account, credentials from .env.
// Tokens are kept in memory — fine for a single-admin local/personal tool.
// If this ever needs multiple admins or to survive server restarts,
// swap the in-memory Map for a DB-backed session store.

const crypto = require('crypto');

const tokens = new Map(); // token -> { email, expiresAt }
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function login(email, password) {
  const validEmail = process.env.ADMIN_EMAIL;
  const validPassword = process.env.ADMIN_PASSWORD;

  if (!validEmail || !validPassword) {
    throw new Error('ADMIN_EMAIL / ADMIN_PASSWORD are not set in .env');
  }

  if (email === validEmail && password === validPassword) {
    const token = crypto.randomBytes(24).toString('hex');
    tokens.set(token, { email, expiresAt: Date.now() + SESSION_TTL_MS });
    return token;
  }
  return null;
}

function logout(token) {
  tokens.delete(token);
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const session = token ? tokens.get(token) : null;

  if (!session || session.expiresAt < Date.now()) {
    if (token) tokens.delete(token);
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
  next();
}

module.exports = { login, logout, requireAuth };
