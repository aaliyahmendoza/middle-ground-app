import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import db from '../db.js';

const router = Router();

router.post('/send-itinerary', requireAuth, async (req, res) => {
  try {
    const { phone, itinerary_id } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(req.session.userId);
    const itinerary = db.prepare('SELECT * FROM itineraries WHERE id = ?').get(itinerary_id);
    if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

    const stops = db.prepare(`
      SELECT ist.*, s.name as spot_name, s.emoji, s.address
      FROM itinerary_stops ist JOIN saved_spots s ON ist.spot_id = s.id
      WHERE ist.itinerary_id = ? ORDER BY ist.stop_order
    `).all(itinerary_id);

    const te = { DRIVING: '🚗', WALKING: '🚶', TRANSIT: '🚌', BICYCLING: '🚲' };
    let msg = `Hey! 🎯 ${user.name} planned a hangout on Middle Ground:\n\n`;
    stops.forEach((s, i) => {
      msg += `${te[s.transport_mode] || '📍'} Stop ${i + 1}: ${s.spot_name}`;
      if (s.eta_text_user) msg += ` (${s.eta_text_user})`;
      msg += '\n';
      if (s.address) msg += `   📍 ${s.address}\n`;
    });
    msg += '\nSee you there! 🤝';

    const twilio = (await import('twilio')).default;
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({ body: msg, from: process.env.TWILIO_PHONE_NUMBER, to: phone });

    res.json({ success: true });
  } catch (err) {
    console.error('Send SMS error:', err);
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});

export default router;
