import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import db from '../db.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  try {
    const userId = req.session.userId;
    const friends = db.prepare(`
      SELECT DISTINCT 
             u.id, u.name, u.email, u.phone, u.avatar_letter, u.color, u.location,
             f.status, f.id as friendship_id, f.user_id as requester_id, f.is_pinned
      FROM friends f
      JOIN users u ON (f.friend_id = u.id AND f.user_id = ?) OR (f.user_id = u.id AND f.friend_id = ?)
      WHERE (f.user_id = ? OR f.friend_id = ?) AND u.id != ?
      GROUP BY u.id
    `).all(userId, userId, userId, userId, userId);
    res.json({ friends });
  } catch (err) {
    console.error('List friends error:', err);
    res.status(500).json({ error: 'Failed to list friends' });
  }
});

// Add friend — status starts as 'pending'
router.post('/', requireAuth, (req, res) => {
  try {
    const { email, phone } = req.body;
    const userId = req.session.userId;
    let friend;
    if (email) friend = db.prepare('SELECT id, name, avatar_letter, color, location FROM users WHERE email = ?').get(email);
    else if (phone) friend = db.prepare('SELECT id, name, avatar_letter, color, location FROM users WHERE phone = ?').get(phone);

    if (!friend) return res.status(404).json({ error: 'not_found' });
    if (friend.id === userId) return res.status(400).json({ error: 'Cannot add yourself' });

    const existing = db.prepare(
      'SELECT id FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'
    ).get(userId, friend.id, friend.id, userId);
    if (existing) return res.status(409).json({ error: 'Already friends or request pending' });

    db.prepare('INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)').run(userId, friend.id, 'pending');
    res.status(201).json({ friend: { ...friend, status: 'pending', requester_id: userId } });
  } catch (err) {
    console.error('Add friend error:', err);
    res.status(500).json({ error: 'Failed to add friend' });
  }
});

// Accept or decline
router.patch('/:id', requireAuth, (req, res) => {
  try {
    const { status, is_pinned } = req.body;
    if (status && !['accepted', 'declined'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (status) db.prepare('UPDATE friends SET status = ? WHERE id = ?').run(status, req.params.id);
    if (is_pinned !== undefined) db.prepare('UPDATE friends SET is_pinned = ? WHERE id = ?').run(is_pinned ? 1 : 0, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update friend' });
  }
});

// Remove friend
router.delete('/:id', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM friends WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

export default router;
