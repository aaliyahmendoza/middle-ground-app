import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import db from '../db.js';

const router = Router();
const KEY = () => process.env.GOOGLE_MAPS_API_KEY;

async function geocode(address) {
  const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${KEY()}`);
  const d = await r.json();
  return d.results?.[0]?.geometry?.location || null;
}

function categoryEmoji(cat) {
  const m = {
    restaurant: '🍽️', 
    cafe: '☕', 
    coffee: '☕', 
    bar: '🍸', 
    store: '🛍️',
    shopping_mall: '🛍️', 
    movie_theater: '🎬', 
    park: '🌳', 
    gym: '💪', 
    bowling_alley: '🎳', 
    museum: '🏛️', 
    library: '📚', 
    bakery: '🥐',
    night_club: '🎉', 
    spa: '💆', 
    tourist_attraction: '📸', 
    amusement_park: '🎢',
    pizza_restaurant: '🍕',
    pizza: '🍕',
    italian_restaurant: '🍝',
    fast_food_restaurant: '🍔',
    sushi_restaurant: '🍣',
    japanese_restaurant: '🍣',
  };
  const c = (cat || '').toLowerCase();
  for (const key in m) {
    if (c.includes(key)) return m[key];
  }
  return '📍';
}

// Calculate midpoint (supports multiple friend locations)
router.post('/search-midpoint', requireAuth, async (req, res) => {
  try {
    const { locations } = req.body; // [{ label, address }, ...]
    if (!locations || locations.length < 1) return res.status(400).json({ error: 'At least 1 location required' });

    const coords = [];
    for (const loc of locations) {
      const c = await geocode(loc.address);
      if (!c) return res.status(400).json({ error: `Could not geocode: ${loc.address}` });
      coords.push({ label: loc.label, ...c });
    }

    const midpoint = {
      lat: coords.reduce((s, c) => s + c.lat, 0) / coords.length,
      lng: coords.reduce((s, c) => s + c.lng, 0) / coords.length,
    };

    res.json({ coords, midpoint });
  } catch (err) {
    console.error('Midpoint error:', err);
    res.status(500).json({ error: 'Failed to calculate midpoint' });
  }
});

// Places Autocomplete via new Places API (New) — POST endpoint
router.get('/autocomplete', requireAuth, async (req, res) => {
  try {
    const { input } = req.query;
    if (!input) return res.json({ predictions: [] });

    const r = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': KEY(),
      },
      body: JSON.stringify({ input }),
    });
    const d = await r.json();
    console.log('[Autocomplete] Status:', r.status, '| suggestions:', d.suggestions?.length || 0);

    const predictions = (d.suggestions || []).map(s => {
      const p = s.placePrediction;
      if (!p) return null;
      return {
        place_id: p.placeId || p.place_id || '',
        description: p.text?.text || '',
        main_text: p.structuredFormat?.mainText?.text || p.text?.text || '',
        secondary_text: p.structuredFormat?.secondaryText?.text || '',
      };
    }).filter(Boolean);

    res.json({ predictions });
  } catch (err) {
    console.error('Autocomplete error:', err);
    res.status(500).json({ predictions: [] });
  }
});

// Nearby places search via Places API (New) Text Search
router.get('/nearby', requireAuth, async (req, res) => {
  try {
    const { lat, lng, type, keyword, radius = 3000 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    const textQuery = keyword || type || 'popular places and points of interest';

    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': KEY(),
        'X-Goog-FieldMask': 'places.id,places.displayName,places.primaryType,places.rating,places.priceLevel,places.shortFormattedAddress,places.formattedAddress,places.location,places.photos,places.regularOpeningHours,places.userRatingCount,places.businessStatus',
      },
      body: JSON.stringify({
        textQuery,
        locationBias: {
          circle: {
            center: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
            radius: parseFloat(radius)
          }
        },
        maxResultCount: 20
      })
    });
    
    const d = await r.json();

    const spots = (d.places || []).map(p => {
      let pl = 0;
      if (p.priceLevel === 'PRICE_LEVEL_INEXPENSIVE') pl = 1;
      else if (p.priceLevel === 'PRICE_LEVEL_MODERATE') pl = 2;
      else if (p.priceLevel === 'PRICE_LEVEL_EXPENSIVE') pl = 3;
      else if (p.priceLevel === 'PRICE_LEVEL_VERY_EXPENSIVE') pl = 4;

      return {
        google_place_id: p.id,
        name: p.displayName?.text || '',
        category: p.primaryType || '',
        emoji: categoryEmoji(p.primaryType || ''),
        rating: p.rating || 0,
        price_level: pl > 0 ? '$'.repeat(pl) : '',
        address: p.shortFormattedAddress || p.formattedAddress || '',
        lat: p.location?.latitude,
        lng: p.location?.longitude,
        photo_url: p.photos?.[0]?.name ? `https://places.googleapis.com/v1/${p.photos[0].name}/media?maxHeightPx=400&maxHeightPx=400&key=${KEY()}` : '',
        open_now: p.regularOpeningHours?.openNow ?? null,
        opening_hours: p.regularOpeningHours?.weekdayDescriptions || [],
        business_status: p.businessStatus || 'OPERATIONAL',
        total_ratings: p.userRatingCount || 0,
      };
    });

    res.json({ spots });
  } catch (err) {
    console.error('Nearby error:', err);
    res.status(500).json({ error: 'Failed to search nearby' });
  }
});

// Directions
router.post('/directions', requireAuth, async (req, res) => {
  try {
    const { origin, destination, mode = 'driving' } = req.body;
    if (!origin || !destination) return res.status(400).json({ error: 'Origin and destination required' });

    const os = typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`;
    const ds = typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`;

    const r = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(os)}&destination=${encodeURIComponent(ds)}&mode=${mode.toLowerCase()}&key=${KEY()}`);
    const d = await r.json();

    if (d.routes?.length > 0) {
      const leg = d.routes[0].legs[0];
      res.json({
        duration: leg.duration,
        distance: leg.distance,
        start_address: leg.start_address,
        end_address: leg.end_address,
        overview_polyline: d.routes[0].overview_polyline?.points,
      });
    } else {
      res.status(404).json({ error: 'No route found', status: d.status });
    }
  } catch (err) {
    console.error('Directions error:', err);
    res.status(500).json({ error: 'Failed to get directions' });
  }
});

// Save spot to DB
router.post('/save', requireAuth, (req, res) => {
  try {
    const { google_place_id, name, category, rating, price_level, address, lat, lng, photo_url } = req.body;
    const existing = db.prepare('SELECT id FROM saved_spots WHERE google_place_id = ?').get(google_place_id);
    if (existing) return res.json({ spot_id: existing.id });

    const result = db.prepare(
      `INSERT INTO saved_spots (google_place_id, name, category, emoji, rating, price_level, address, lat, lng, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(google_place_id, name, category, categoryEmoji(category), rating, price_level || '', address, lat, lng, photo_url || '');

    res.json({ spot_id: result.lastInsertRowid });
  } catch (err) {
    console.error('Save spot error:', err);
    res.status(500).json({ error: 'Failed to save spot' });
  }
});

export default router;
