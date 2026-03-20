// ============================================================
// server/auth.js — HEXATİ kimlik doğrulama
// bcryptjs şifre hash + JWT benzeri token sistemi
// ============================================================
'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Users, Logs } = require('./db');

const SECRET       = process.env.JWT_SECRET || 'hexati_secret_' + Math.random().toString(36);
const TOKEN_EXPIRY = 7 * 24 * 3600 * 1000; // 7 gün

// Aktif token → {username, role, exp} haritası (bellek)
const activeSessions = new Map();

const Auth = {
  async hashPassword(pw) {
    return bcrypt.hash(pw, 10);
  },

  async verifyPassword(pw, hash) {
    return bcrypt.compare(pw, hash);
  },

  generateToken(username, role) {
    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.set(token, {
      username, role,
      exp: Date.now() + TOKEN_EXPIRY,
      createdAt: Date.now(),
    });
    return token;
  },

  verifyToken(token) {
    if (!token) return null;
    const sess = activeSessions.get(token);
    if (!sess) return null;
    if (sess.exp < Date.now()) { activeSessions.delete(token); return null; }
    return sess;
  },

  revokeToken(token) {
    activeSessions.delete(token);
  },

  revokeAllForUser(username) {
    for (const [tok, sess] of activeSessions) {
      if (sess.username === username) activeSessions.delete(tok);
    }
  },

  getActiveSessions() {
    const now = Date.now();
    const result = [];
    for (const [tok, sess] of activeSessions) {
      if (sess.exp < now) { activeSessions.delete(tok); continue; }
      result.push({ ...sess, tokenPreview: tok.slice(0, 8) + '...' });
    }
    return result;
  },

  activeSessionCount() {
    const now = Date.now();
    let count = 0;
    for (const [tok, sess] of activeSessions) {
      if (sess.exp < now) activeSessions.delete(tok);
      else count++;
    }
    return count;
  },

  // Express middleware: token'ı cookie veya Authorization header'dan al
  middleware(req, res, next) {
    const token = req.cookies?.hexati_token ||
                  (req.headers.authorization || '').replace('Bearer ', '');
    const sess = Auth.verifyToken(token);
    if (sess) {
      req.session_user = sess;
    }
    next();
  },

  // Admin erişim kontrolü
  requireAdmin(req, res, next) {
    if (!req.session_user || req.session_user.role !== 'admin') {
      return res.status(403).json({ error: 'Yetersiz yetki' });
    }
    next();
  },

  requireAuth(req, res, next) {
    if (!req.session_user) {
      return res.status(401).json({ error: 'Giriş yapmanız gerekiyor' });
    }
    next();
  },
};

module.exports = Auth;
