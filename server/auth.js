// ============================================================
// server/auth.js — HEXATİ kimlik doğrulama  v2.3
// bcryptjs hash + kalıcı token store (restart-safe)
// ============================================================
'use strict';

const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const { SessionStore } = require('./db');

const TOKEN_EXPIRY = 7 * 24 * 3600 * 1000; // 7 gün

const Auth = {
  async hashPassword(pw) {
    return bcrypt.hash(pw, 10);
  },

  async verifyPassword(pw, hash) {
    return bcrypt.compare(pw, hash);
  },

  generateToken(username, role, ip = '') {
    if (!username || typeof username !== 'string') throw new Error('Invalid username');
    if (!role || typeof role !== 'string') throw new Error('Invalid role');
    const token = crypto.randomBytes(32).toString('hex');
    SessionStore.set(token, {
      username: String(username).toLowerCase(),
      role: String(role).toLowerCase(),
      ip: String(ip).slice(0, 45),
      exp:       Date.now() + TOKEN_EXPIRY,
      createdAt: Date.now(),
    });
    return token;
  },

  verifyToken(token) {
    if (!token) return null;
    return SessionStore.get(token); // null if expired or not found
  },

  revokeToken(token) {
    SessionStore.delete(token);
  },

  revokeAllForUser(username) {
    SessionStore.deleteAllForUser(username);
  },

  getActiveSessions() {
    return SessionStore.getAll();
  },

  activeSessionCount() {
    return SessionStore.count();
  },

  // Express middleware — cookie veya Authorization header'dan token al
  middleware(req, res, next) {
    const raw   = req.headers.authorization || '';
    const token = req.cookies?.hexati_token || raw.replace('Bearer ', '').trim();
    if (token) {
      const sess = Auth.verifyToken(token);
      if (sess) req.session_user = sess;
    }
    next();
  },

  requireAdmin(req, res, next) {
    if (!req.session_user || req.session_user.role !== 'admin') {
      return res.status(403).json({ error: 'Yetersiz yetki' });
    }
    next();
  },

  requireMod(req, res, next) {
    if (!req.session_user || !['admin','moderator'].includes(req.session_user.role)) {
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
