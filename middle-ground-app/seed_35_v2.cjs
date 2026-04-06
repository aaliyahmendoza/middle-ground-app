// Seed script v2: Update existing invites to have proper locations and ETAs
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'middleground.db'));
const USER_ID = 35;

// Update user's location  
db.prepare(`UPDATE users SET location = 'San Jose, CA, USA' WHERE id = ?`).run(USER_ID);

// Update ALL test friend locations
for (let i = 1; i <= 10; i++) {
  const cities = [
    'Los Angeles, CA, USA',
    'San Francisco, CA, USA', 
    'Fremont, CA, USA',
    'Sacramento, CA, USA',
    'Oakland, CA, USA',
    'Santa Cruz, CA, USA',
    'Palo Alto, CA, USA',
    'Mountain View, CA, USA',
    'Sunnyvale, CA, USA',
    'Milpitas, CA, USA'
  ];
  const friendUser = db.prepare(`SELECT id FROM users WHERE name = ?`).get(`Friend_${i}`);
  if (friendUser) {
    db.prepare(`UPDATE users SET location = ? WHERE id = ?`).run(cities[i-1], friendUser.id);
    console.log(`Updated Friend_${i} location to ${cities[i-1]}`);
  }
}

// Update itineraries to include proper locations
const itineraries = db.prepare(`SELECT id FROM itineraries WHERE user_id = ?`).all(USER_ID);
for (const it of itineraries) {
  db.prepare(`UPDATE itineraries SET user_location = 'San Jose, CA, USA', friend_location = 'Fremont, CA, USA' WHERE id = ?`).run(it.id);
}

// Update all itinerary_stops to have sample ETAs where they're missing
const stops = db.prepare(`
  SELECT ist.id, ist.itinerary_id, ist.transport_mode, ist.eta_text_user, ist.eta_text_friend
  FROM itinerary_stops ist
  JOIN itineraries i ON ist.itinerary_id = i.id
  WHERE i.user_id = ?
`).all(USER_ID);

for (const stop of stops) {
  if (!stop.eta_text_user || stop.eta_text_user === '') {
    db.prepare(`UPDATE itinerary_stops SET eta_text_user = '25 mins', eta_seconds_user = 1500, eta_text_friend = '18 mins', eta_seconds_friend = 1080 WHERE id = ?`).run(stop.id);
    console.log(`Updated stop ${stop.id} with sample ETAs`);
  }
}

console.log('\n✅ All locations and ETAs updated!');
db.close();
