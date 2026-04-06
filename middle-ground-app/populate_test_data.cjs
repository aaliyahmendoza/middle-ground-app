const Database = require('better-sqlite3');
const db = new Database('middleground.db');

// Enable foreign keys
db.pragma('foreign_keys = ON');

const ME = 24;
const friendIds = [25, 26, 27, 28, 29, 30, 31, 32, 33, 34];

console.log('Repopulating test data with Bay Area locations...');

try {
  // 1. Update existing spots with real SF/Bay Area coordinates and addresses
  // ID 1: Central Pizza LA -> Tony's Pizza SF
  db.prepare("UPDATE saved_spots SET name = ?, emoji = ?, address = ?, lat = ?, lng = ?, google_place_id = ? WHERE id = ?").run(
    "Tony's Pizza Napoletana", '🍕', '1570 Stockton St, San Francisco, CA 94133', 37.8017, -122.4081, 'ChIJ7_Wv8R-AhYARx7n9vj8A0_Y', 1
  );
  // ID 2: Sushi Taro LA -> San Tung SF
  db.prepare("UPDATE saved_spots SET name = ?, emoji = ?, address = ?, lat = ?, lng = ?, google_place_id = ? WHERE id = ?").run(
    "San Tung", '🍣', '1031 Irving St, San Francisco, CA 94122', 37.7637, -122.4690, 'ChIJW_Z8iA9-AhYRlV1Wvj8A0-o', 2
  );

  // 2. Clear existing to start clean
  db.prepare('DELETE FROM invites').run();
  db.prepare('DELETE FROM itinerary_stops').run();
  db.prepare('DELETE FROM itineraries').run();

  // 3. Create fresh invites with Bay Area routes (Mountain View -> SF)
  // SENT INVITES (ME -> Friends)
  for(let i=0; i<5; i++) {
    const fId = friendIds[i];
    const itResult = db.prepare('INSERT INTO itineraries (name, user_id, friend_id, user_location, friend_location) VALUES (?, ?, ?, ?, ?)').run(
      `SF City Trip ${i+1}`, ME, fId, '1600 Amphitheatre Pkwy, Mountain View, CA', 'Berkeley, CA'
    );
    const itId = itResult.lastInsertRowid;
    db.prepare('INSERT INTO itinerary_stops (itinerary_id, spot_id, stop_order, transport_mode, eta_seconds_user, eta_text_user, eta_text_friend) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      itId, 1, 0, 'DRIVING', 2800, '48 mins', '15 mins'
    );
    db.prepare('INSERT INTO invites (sender_id, receiver_id, itinerary_id, status, message, event_date) VALUES (?, ?, ?, ?, ?, ?)').run(
      ME, fId, itId, 'pending', `Let's go to Tony's in SF! Plan #${i+1}`, `2026-05-1${i}`
    );
  }

  // 4. RECEIVED INVITES (Friends -> ME)
  for(let i=5; i<10; i++) {
    const fId = friendIds[i];
    const itResult = db.prepare('INSERT INTO itineraries (name, user_id, friend_id, user_location, friend_location) VALUES (?, ?, ?, ?, ?)').run(
      `Irving St Market ${i+1}`, fId, ME, 'San Francisco, CA', '1600 Amphitheatre Pkwy, Mountain View, CA'
    );
    const itId = itResult.lastInsertRowid;
    db.prepare('INSERT INTO itinerary_stops (itinerary_id, spot_id, stop_order, transport_mode, eta_seconds_friend, eta_text_friend, eta_text_user) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      itId, 2, 0, 'DRIVING', 2900, '50 mins', '10 mins'
    );
    db.prepare('INSERT INTO invites (sender_id, receiver_id, itinerary_id, status, message, event_date) VALUES (?, ?, ?, ?, ?, ?)').run(
      fId, ME, itId, 'pending', `Sushi at San Tung? Invite #${i+1}`, `2026-06-2${i-5}`
    );
  }

  console.log('✓ Success: 10 friends and 10 Bay Area invites populated.');
} catch (err) {
  console.error('Failed to populate test data:', err);
}
