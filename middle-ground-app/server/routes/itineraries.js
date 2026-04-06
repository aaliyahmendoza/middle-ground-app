import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import db from '../db.js';

const router = Router();

router.post('/', requireAuth, (req, res) => {
  try {
    const { name, friend_id, user_location, friend_location, stops } = req.body;
    const userId = req.session.userId;

    const result = db.prepare(
      `INSERT INTO itineraries (user_id, friend_id, name, user_location, friend_location) VALUES (?, ?, ?, ?, ?)`
    ).run(userId, friend_id || null, name || 'Untitled Plan', user_location || '', friend_location || '');

    const itId = result.lastInsertRowid;
    if (stops?.length > 0) {
      const ins = db.prepare(
        `INSERT INTO itinerary_stops (itinerary_id, spot_id, stop_order, transport_mode, eta_seconds_user, eta_seconds_friend, eta_text_user, eta_text_friend, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const s of stops) {
        ins.run(itId, s.spot_id, s.stop_order, s.transport_mode || 'DRIVING', s.eta_seconds_user || 0, s.eta_seconds_friend || 0, s.eta_text_user || '', s.eta_text_friend || '', s.start_time || '', s.end_time || '');
      }
    }
    res.status(201).json({ id: itId });
  } catch (err) {
    console.error('Create itinerary error:', err);
    res.status(500).json({ error: 'Failed to create itinerary' });
  }
});

router.get('/', requireAuth, (req, res) => {
  try {
    const its = db.prepare(`
      SELECT i.*, u.name as friend_name, u.avatar_letter as friend_avatar, u.color as friend_color
      FROM itineraries i LEFT JOIN users u ON i.friend_id = u.id
      WHERE i.user_id = ? ORDER BY i.created_at DESC
    `).all(req.session.userId);

    const getStops = db.prepare(`
      SELECT ist.*, s.name as spot_name, s.category, s.emoji, s.address, s.lat, s.lng, s.rating, s.price_level, s.photo_url
      FROM itinerary_stops ist JOIN saved_spots s ON ist.spot_id = s.id
      WHERE ist.itinerary_id = ? ORDER BY ist.stop_order
    `);

    res.json({ itineraries: its.map(it => ({ ...it, stops: getStops.all(it.id) })) });
  } catch (err) {
    console.error('List itineraries error:', err);
    res.status(500).json({ error: 'Failed to list itineraries' });
  }
});

router.get('/:id', requireAuth, (req, res) => {
  try {
    const it = db.prepare(`
      SELECT i.*, u.name as friend_name, u.avatar_letter as friend_avatar, u.color as friend_color
      FROM itineraries i LEFT JOIN users u ON i.friend_id = u.id WHERE i.id = ?
    `).get(req.params.id);
    if (!it) return res.status(404).json({ error: 'Itinerary not found' });

    const stops = db.prepare(`
      SELECT ist.*, s.name as spot_name, s.category, s.emoji, s.address, s.lat, s.lng, s.rating, s.price_level, s.photo_url
      FROM itinerary_stops ist JOIN saved_spots s ON ist.spot_id = s.id
      WHERE ist.itinerary_id = ? ORDER BY ist.stop_order
    `).all(req.params.id);

    res.json({ itinerary: { ...it, stops } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get itinerary' });
  }
});

router.patch('/:id/stops/:stopId', requireAuth, (req, res) => {
  try {
    const { transport_mode, eta_seconds_user, eta_seconds_friend, eta_text_user, eta_text_friend } = req.body;
    db.prepare(
      `UPDATE itinerary_stops SET transport_mode=?, eta_seconds_user=?, eta_seconds_friend=?, eta_text_user=?, eta_text_friend=? WHERE id=? AND itinerary_id=?`
    ).run(transport_mode, eta_seconds_user || 0, eta_seconds_friend || 0, eta_text_user || '', eta_text_friend || '', req.params.stopId, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update stop' });
  }
});

router.delete('/:id', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM itinerary_stops WHERE itinerary_id = ?').run(req.params.id);
    db.prepare('DELETE FROM itineraries WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete itinerary' });
  }
});

export default router;
