import { Router } from 'express';
import bcrypt from 'bcrypt';
import db from '../db.js';

const router = Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const name = email.split('@')[0];
    const passwordHash = await bcrypt.hash(password, 12);
    const avatarLetter = name.charAt(0).toUpperCase();
    const colors = ['#E07C5A', '#6B8F71', '#7B5EA7', '#D4622A', '#3D8B4B', '#C0541F'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const result = db.prepare(
      `INSERT INTO users (name, email, password_hash, avatar_letter, color) VALUES (?, ?, ?, ?, ?)`
    ).run(name, email, passwordHash, avatarLetter, color);

    req.session.userId = result.lastInsertRowid;
    const user = db.prepare(
      'SELECT id, name, email, phone, phone_verified, avatar_letter, color, location FROM users WHERE id = ?'
    ).get(result.lastInsertRowid);

    res.status(201).json({ user, needsVerification: false });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    req.session.userId = user.id;
    const { password_hash, verification_code, code_expires_at, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// Get current user
router.get('/me', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
  const user = db.prepare(
    'SELECT id, name, username, username_last_changed_at, email, phone, phone_verified, avatar_letter, color, location, profile_picture FROM users WHERE id = ?'
  ).get(req.session.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// Update current user
router.patch('/me', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
  const { location, name, email, profile_picture, username } = req.body;
  
  if (location !== undefined) db.prepare('UPDATE users SET location = ? WHERE id = ?').run(location, req.session.userId);
  if (name !== undefined) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.session.userId);
  
  if (username !== undefined && username.trim() !== "") {
    const user = db.prepare('SELECT username, username_last_changed_at FROM users WHERE id = ?').get(req.session.userId);
    
    // Only check cooldown if changing to a NEW username (not the current one)
    if (user.username !== username) {
      if (user.username_last_changed_at) {
        const lastChanged = new Date(user.username_last_changed_at);
        const now = new Date();
        const diffDays = Math.ceil((now - lastChanged) / (1000 * 60 * 60 * 24));
        if (diffDays < 30) {
          return res.status(400).json({ error: `You can only change your username once every 30 days. You have ${30 - diffDays} days left.` });
        }
      }
      
      const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.session.userId);
      if (existing) {
        return res.status(400).json({ error: 'Username is already taken' });
      }
      
      db.prepare('UPDATE users SET username = ?, username_last_changed_at = ? WHERE id = ?').run(username, new Date().toISOString(), req.session.userId);
    }
  }

  // Email logic intentionally left disabled following requirements
  // if (email !== undefined) db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, req.session.userId);
  if (profile_picture !== undefined) db.prepare('UPDATE users SET profile_picture = ? WHERE id = ?').run(profile_picture, req.session.userId);
  
  const updatedUser = db.prepare(
    'SELECT id, name, username, username_last_changed_at, email, phone, phone_verified, avatar_letter, color, location, profile_picture FROM users WHERE id = ?'
  ).get(req.session.userId);
  res.json({ user: updatedUser });
});

export default router;
