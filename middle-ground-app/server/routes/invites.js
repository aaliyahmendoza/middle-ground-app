import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import db from '../db.js';

const router = Router();

router.post('/', requireAuth, (req, res) => {
  try {
    const { receiver_id, itinerary_id, date_label, time_label, event_date, message, show_guest_list } = req.body;
    const result = db.prepare(
      `INSERT INTO invites (sender_id, receiver_id, itinerary_id, date_label, time_label, event_date, message, show_guest_list) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(req.session.userId, receiver_id, itinerary_id, date_label || '', time_label || '', event_date || '', message || '', show_guest_list !== undefined ? (show_guest_list ? 1 : 0) : 1);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    console.error('Create invite error:', err);
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

router.get('/', requireAuth, (req, res) => {
  try {
    const userId = req.session.userId;
    const getStops = db.prepare(`
      SELECT ist.*, s.name as spot_name, s.category, s.emoji, s.address, s.lat, s.lng, s.google_place_id,
        ist.start_time, ist.end_time
      FROM itinerary_stops ist JOIN saved_spots s ON ist.spot_id = s.id
      WHERE ist.itinerary_id = ? ORDER BY ist.stop_order
    `);

    // Get co-invitees for a given itinerary (other people invited to the same itinerary)
    const getCoInvitees = db.prepare(`
      SELECT inv.receiver_id, u.name, u.avatar_letter, u.color, inv.status
      FROM invites inv JOIN users u ON inv.receiver_id = u.id
      WHERE inv.itinerary_id = ? AND inv.receiver_id != ?
      ORDER BY u.name
    `);

    const received = db.prepare(`
      SELECT inv.*, sender.name as sender_name, sender.avatar_letter as sender_avatar, sender.color as sender_color, sender.location as sender_location,
        it.name as itinerary_name, it.user_location, it.friend_location, it.user_id as it_user_id, it.friend_id as it_friend_id,
        inv.event_date, inv.show_guest_list
      FROM invites inv JOIN users sender ON inv.sender_id = sender.id
      JOIN itineraries it ON inv.itinerary_id = it.id
      WHERE inv.receiver_id = ? ORDER BY inv.created_at DESC
    `).all(userId).map(inv => {
      const result = { ...inv, stops: getStops.all(inv.itinerary_id) };
      // Only include co-invitees if the sender enabled show_guest_list
      if (inv.show_guest_list) {
        result.co_invitees = getCoInvitees.all(inv.itinerary_id, userId);
      }
      return result;
    });

    const sent = db.prepare(`
      SELECT inv.*, receiver.name as receiver_name, receiver.avatar_letter as receiver_avatar, receiver.color as receiver_color, receiver.location as receiver_location,
        it.name as itinerary_name, it.user_location, it.friend_location, it.user_id as it_user_id, it.friend_id as it_friend_id,
        inv.event_date, inv.show_guest_list
      FROM invites inv JOIN users receiver ON inv.receiver_id = receiver.id
      JOIN itineraries it ON inv.itinerary_id = it.id
      WHERE inv.sender_id = ? ORDER BY inv.created_at DESC
    `).all(userId).map(inv => ({ ...inv, stops: getStops.all(inv.itinerary_id) }));

    res.json({ received, sent });
  } catch (err) {
    console.error('List invites error:', err);
    res.status(500).json({ error: 'Failed to list invites' });
  }
});

router.patch('/:id', requireAuth, (req, res) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'declined', 'counter', 'completed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    db.prepare('UPDATE invites SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update invite' });
  }
});

export default router;
