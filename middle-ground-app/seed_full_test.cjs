const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const db = new Database(path.join(__dirname, 'middleground.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

async function seed() {
  console.log('🌱 Starting full test seed...');

  const passwordHash = await bcrypt.hash('test123', 12);

  // ── Main test user ──
  const colors = ['#E07C5A', '#6B8F71', '#7B5EA7', '#D4622A', '#3D8B4B', '#C0541F'];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Delete any existing test user
  const existingUser = db.prepare("SELECT id FROM users WHERE email = 'demo@middleground.app'").get();
  if (existingUser) {
    db.prepare('DELETE FROM invites WHERE sender_id = ? OR receiver_id = ?').run(existingUser.id, existingUser.id);
    db.prepare('DELETE FROM itinerary_stops WHERE itinerary_id IN (SELECT id FROM itineraries WHERE user_id = ? OR friend_id = ?)').run(existingUser.id, existingUser.id);
    db.prepare('DELETE FROM itineraries WHERE user_id = ? OR friend_id = ?').run(existingUser.id, existingUser.id);
    db.prepare('DELETE FROM friends WHERE user_id = ? OR friend_id = ?').run(existingUser.id, existingUser.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(existingUser.id);
  }

  // Clean up old demo friends too
  for (let i = 1; i <= 12; i++) {
    const old = db.prepare(`SELECT id FROM users WHERE email = 'demofriend${i}@middleground.app'`).get();
    if (old) {
      db.prepare('DELETE FROM invites WHERE sender_id = ? OR receiver_id = ?').run(old.id, old.id);
      db.prepare('DELETE FROM itinerary_stops WHERE itinerary_id IN (SELECT id FROM itineraries WHERE user_id = ? OR friend_id = ?)').run(old.id, old.id);
      db.prepare('DELETE FROM itineraries WHERE user_id = ? OR friend_id = ?').run(old.id, old.id);
      db.prepare('DELETE FROM friends WHERE user_id = ? OR friend_id = ?').run(old.id, old.id);
      db.prepare('DELETE FROM users WHERE id = ?').run(old.id);
    }
  }

  // Create main user
  const mainUser = db.prepare(
    `INSERT INTO users (name, email, password_hash, avatar_letter, color, location, username) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run('Aaliyah', 'demo@middleground.app', passwordHash, 'A', '#D4622A', 'San Jose, CA, USA', 'aaliyah');
  const userId = mainUser.lastInsertRowid;
  console.log(`✅ Created main user: demo@middleground.app (id: ${userId})`);

  // ── Create 12 friends (10 accepted + 2 senders for invites) ──
  const friendData = [
    { name: 'Sophia', location: 'Fremont, CA, USA', color: '#6B8F71' },
    { name: 'Marco', location: 'Oakland, CA, USA', color: '#7B5EA7' },
    { name: 'Priya', location: 'Mountain View, CA, USA', color: '#E07C5A' },
    { name: 'Jordan', location: 'Palo Alto, CA, USA', color: '#3D8B4B' },
    { name: 'Lily', location: 'Santa Cruz, CA, USA', color: '#C0541F' },
    { name: 'Ethan', location: 'Milpitas, CA, USA', color: '#D4622A' },
    { name: 'Zara', location: 'Sunnyvale, CA, USA', color: '#6B8F71' },
    { name: 'Leo', location: 'San Francisco, CA, USA', color: '#7B5EA7' },
    { name: 'Maya', location: 'Sacramento, CA, USA', color: '#E07C5A' },
    { name: 'Kai', location: 'Berkeley, CA, USA', color: '#3D8B4B' },
    { name: 'Nina', location: 'Union City, CA, USA', color: '#C0541F' },
    { name: 'Tyler', location: 'San Mateo, CA, USA', color: '#D4622A' },
  ];

  const friendIds = [];
  for (let i = 0; i < friendData.length; i++) {
    const f = friendData[i];
    const email = `demofriend${i + 1}@middleground.app`;
    const result = db.prepare(
      `INSERT INTO users (name, email, password_hash, avatar_letter, color, location) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(f.name, email, passwordHash, f.name[0], f.color, f.location);
    friendIds.push(result.lastInsertRowid);
  }
  console.log(`✅ Created ${friendIds.length} friend users`);

  // ── Create friendships (all 10 accepted, 3 pinned) ──
  const pinnedFriends = [0, 2, 7]; // Sophia, Priya, Leo
  for (let i = 0; i < 10; i++) {
    const isPinned = pinnedFriends.includes(i) ? 1 : 0;
    db.prepare(
      `INSERT INTO friends (user_id, friend_id, status, is_pinned) VALUES (?, ?, 'accepted', ?)`
    ).run(userId, friendIds[i], isPinned);
  }
  // Friends 11 and 12 also accepted (they'll send invites)
  db.prepare(`INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, 'accepted')`).run(friendIds[10], userId);
  db.prepare(`INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, 'accepted')`).run(friendIds[11], userId);
  console.log(`✅ Created 12 friendships (3 pinned: Sophia, Priya, Leo)`);

  // ── Create spots for itineraries ──
  const spots = [
    { gid: 'demo_charleskennedy', name: 'Charles F Kennedy Park', cat: 'park', emoji: '🌳', addr: '1333 Decoto Rd, Union City, CA 94587', lat: 37.5917, lng: -122.0217 },
    { gid: 'demo_sanhonore', name: 'San Honore Panaderia', cat: 'bakery', emoji: '🥐', addr: '34660 Fremont Blvd, Fremont, CA 94555', lat: 37.5885, lng: -122.0691 },
    { gid: 'demo_grandlake', name: 'Grand Lake Theater', cat: 'movie_theater', emoji: '🎬', addr: '3200 Grand Ave, Oakland, CA 94610', lat: 37.8117, lng: -122.2461 },
    { gid: 'demo_philzcoffee', name: 'Philz Coffee', cat: 'cafe', emoji: '☕', addr: '3101 24th St, San Francisco, CA 94110', lat: 37.7526, lng: -122.4183 },
    { gid: 'demo_japantown', name: 'San Jose Japantown', cat: 'tourist_attraction', emoji: '⛩️', addr: 'Japantown, San Jose, CA 95112', lat: 37.3489, lng: -121.8949 },
    { gid: 'demo_ferrybuilding', name: 'Ferry Building Marketplace', cat: 'shopping_mall', emoji: '🛍️', addr: '1 Ferry Building, San Francisco, CA 94105', lat: 37.7955, lng: -122.3937 },
    { gid: 'demo_sfjapangarden', name: 'Japanese Tea Garden', cat: 'park', emoji: '🌸', addr: '75 Hagiwara Tea Garden Dr, San Francisco, CA 94118', lat: 37.7704, lng: -122.4700 },
    { gid: 'demo_sanjosemuseum', name: 'Tech Interactive', cat: 'museum', emoji: '🏛️', addr: '201 S Market St, San Jose, CA 95113', lat: 37.3318, lng: -121.8901 },
    { gid: 'demo_santanarow', name: 'Santana Row', cat: 'shopping_mall', emoji: '🛍️', addr: '377 Santana Row, San Jose, CA 95128', lat: 37.3210, lng: -121.9477 },
    { gid: 'demo_laketahoe', name: 'Lake Merritt', cat: 'park', emoji: '🌊', addr: 'Lake Merritt, Oakland, CA 94612', lat: 37.8025, lng: -122.2602 },
  ];

  const spotIds = [];
  for (const s of spots) {
    const existing = db.prepare('SELECT id FROM saved_spots WHERE google_place_id = ?').get(s.gid);
    if (existing) {
      spotIds.push(existing.id);
    } else {
      const r = db.prepare(
        `INSERT INTO saved_spots (google_place_id, name, category, emoji, rating, address, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(s.gid, s.name, s.cat, s.emoji, (4.0 + Math.random()).toFixed(1), s.addr, s.lat, s.lng);
      spotIds.push(r.lastInsertRowid);
    }
  }
  console.log(`✅ Created ${spotIds.length} spots`);

  // ── INVITE 1: Sophia → Aaliyah (2 stops: park + bakery, DRIVING) ──
  const it1 = db.prepare(
    `INSERT INTO itineraries (user_id, friend_id, name, user_location, friend_location) VALUES (?, ?, ?, ?, ?)`
  ).run(friendIds[0], userId, 'Weekend Hangout with Aaliyah', 'Fremont, CA, USA', 'San Jose, CA, USA');
  db.prepare(
    `INSERT INTO itinerary_stops (itinerary_id, spot_id, stop_order, transport_mode, eta_text_user, eta_seconds_user, eta_text_friend, eta_seconds_friend, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(it1.lastInsertRowid, spotIds[0], 0, 'DRIVING', '15 mins', 900, '31 mins', 1860, '10:00', '11:30');
  db.prepare(
    `INSERT INTO itinerary_stops (itinerary_id, spot_id, stop_order, transport_mode, eta_text_user, eta_seconds_user, eta_text_friend, eta_seconds_friend, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(it1.lastInsertRowid, spotIds[1], 1, 'WALKING', '18 mins', 1080, '18 mins', 1080, '12:00', '13:00');
  db.prepare(
    `INSERT INTO invites (sender_id, receiver_id, itinerary_id, event_date, message, status) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(friendIds[0], userId, it1.lastInsertRowid, '2026-04-12', 'Let\'s hit up the park and grab some pastries! 🥐', 'pending');
  console.log('✅ Invite 1: Sophia → Aaliyah (2 stops, DRIVE+WALK)');

  // ── INVITE 2: Marco → Aaliyah (3 stops: theater + coffee + ferry, mix of transport) ──
  const it2 = db.prepare(
    `INSERT INTO itineraries (user_id, friend_id, name, user_location, friend_location) VALUES (?, ?, ?, ?, ?)`
  ).run(friendIds[1], userId, 'Oakland + SF Day Trip', 'Oakland, CA, USA', 'San Jose, CA, USA');
  db.prepare(
    `INSERT INTO itinerary_stops (itinerary_id, spot_id, stop_order, transport_mode, eta_text_user, eta_seconds_user, eta_text_friend, eta_seconds_friend, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(it2.lastInsertRowid, spotIds[2], 0, 'DRIVING', '12 mins', 720, '55 mins', 3300, '09:00', '11:00');
  db.prepare(
    `INSERT INTO itinerary_stops (itinerary_id, spot_id, stop_order, transport_mode, eta_text_user, eta_seconds_user, eta_text_friend, eta_seconds_friend, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(it2.lastInsertRowid, spotIds[3], 1, 'TRANSIT', '25 mins', 1500, '25 mins', 1500, '11:30', '12:30');
  db.prepare(
    `INSERT INTO itinerary_stops (itinerary_id, spot_id, stop_order, transport_mode, eta_text_user, eta_seconds_user, eta_text_friend, eta_seconds_friend, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(it2.lastInsertRowid, spotIds[5], 2, 'WALKING', '20 mins', 1200, '20 mins', 1200, '13:00', '15:00');
  db.prepare(
    `INSERT INTO invites (sender_id, receiver_id, itinerary_id, event_date, message, status) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(friendIds[1], userId, it2.lastInsertRowid, '2026-04-19', 'Oakland + SF day! Movie, coffee, then Ferry Building 🎬☕', 'pending');
  console.log('✅ Invite 2: Marco → Aaliyah (3 stops, DRIVE+TRANSIT+WALK)');

  // ── INVITE 3: Priya → Aaliyah (1 stop: Japanese Tea Garden, BICYCLING) ──
  const it3 = db.prepare(
    `INSERT INTO itineraries (user_id, friend_id, name, user_location, friend_location) VALUES (?, ?, ?, ?, ?)`
  ).run(friendIds[2], userId, 'Chill Day at Tea Garden', 'Mountain View, CA, USA', 'San Jose, CA, USA');
  db.prepare(
    `INSERT INTO itinerary_stops (itinerary_id, spot_id, stop_order, transport_mode, eta_text_user, eta_seconds_user, eta_text_friend, eta_seconds_friend, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(it3.lastInsertRowid, spotIds[6], 0, 'BICYCLING', '45 mins', 2700, '1 hour 10 mins', 4200, '14:00', '17:00');
  db.prepare(
    `INSERT INTO invites (sender_id, receiver_id, itinerary_id, event_date, message, status) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(friendIds[2], userId, it3.lastInsertRowid, '2026-04-15', 'Bike ride to the tea garden? 🌸🚲', 'pending');
  console.log('✅ Invite 3: Priya → Aaliyah (1 stop, BICYCLING)');

  // ── INVITE 4: Nina → Aaliyah (2 stops: Tech Museum + Santana Row, DRIVING) ──
  const it4 = db.prepare(
    `INSERT INTO itineraries (user_id, friend_id, name, user_location, friend_location) VALUES (?, ?, ?, ?, ?)`
  ).run(friendIds[10], userId, 'San Jose Explorer', 'Union City, CA, USA', 'San Jose, CA, USA');
  db.prepare(
    `INSERT INTO itinerary_stops (itinerary_id, spot_id, stop_order, transport_mode, eta_text_user, eta_seconds_user, eta_text_friend, eta_seconds_friend, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(it4.lastInsertRowid, spotIds[7], 0, 'DRIVING', '25 mins', 1500, '8 mins', 480, '10:00', '12:00');
  db.prepare(
    `INSERT INTO itinerary_stops (itinerary_id, spot_id, stop_order, transport_mode, eta_text_user, eta_seconds_user, eta_text_friend, eta_seconds_friend, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(it4.lastInsertRowid, spotIds[8], 1, 'DRIVING', '10 mins', 600, '10 mins', 600, '12:30', '16:00');
  db.prepare(
    `INSERT INTO invites (sender_id, receiver_id, itinerary_id, event_date, message, status) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(friendIds[10], userId, it4.lastInsertRowid, '2026-04-20', 'Tech museum then shopping at Santana Row! 🏛️🛍️', 'pending');
  console.log('✅ Invite 4: Nina → Aaliyah (2 stops, San Jose area)');

  // ── INVITE 5: Tyler → Aaliyah (GROUP invite - 4 stops involving many locations) ──
  const it5 = db.prepare(
    `INSERT INTO itineraries (user_id, friend_id, name, user_location, friend_location) VALUES (?, ?, ?, ?, ?)`
  ).run(friendIds[11], userId, 'Big Group Bay Area Tour', 'San Mateo, CA, USA', 'San Jose, CA, USA');
  // Stop 1: Japantown
  db.prepare(
    `INSERT INTO itinerary_stops (itinerary_id, spot_id, stop_order, transport_mode, eta_text_user, eta_seconds_user, eta_text_friend, eta_seconds_friend, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(it5.lastInsertRowid, spotIds[4], 0, 'DRIVING', '30 mins', 1800, '10 mins', 600, '09:00', '10:00');
  // Stop 2: Lake Merritt
  db.prepare(
    `INSERT INTO itinerary_stops (itinerary_id, spot_id, stop_order, transport_mode, eta_text_user, eta_seconds_user, eta_text_friend, eta_seconds_friend, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(it5.lastInsertRowid, spotIds[9], 1, 'DRIVING', '40 mins', 2400, '40 mins', 2400, '10:30', '12:00');
  // Stop 3: Grand Lake Theater
  db.prepare(
    `INSERT INTO itinerary_stops (itinerary_id, spot_id, stop_order, transport_mode, eta_text_user, eta_seconds_user, eta_text_friend, eta_seconds_friend, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(it5.lastInsertRowid, spotIds[2], 2, 'WALKING', '8 mins', 480, '8 mins', 480, '12:30', '15:00');
  // Stop 4: Ferry Building
  db.prepare(
    `INSERT INTO itinerary_stops (itinerary_id, spot_id, stop_order, transport_mode, eta_text_user, eta_seconds_user, eta_text_friend, eta_seconds_friend, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(it5.lastInsertRowid, spotIds[5], 3, 'TRANSIT', '22 mins', 1320, '22 mins', 1320, '15:30', '18:00');
  // Create invite - this is the group one
  db.prepare(
    `INSERT INTO invites (sender_id, receiver_id, itinerary_id, event_date, message, status) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(friendIds[11], userId, it5.lastInsertRowid, '2026-04-26', '🎉 BIG GROUP TRIP! Japantown → Lake Merritt → Movie → Ferry Building. Everyone is coming - Sophia, Marco, Priya, Jordan, Lily, Ethan, Zara, Leo, Maya, and Kai! Let\'s gooo!', 'pending');
  console.log('✅ Invite 5: Tyler → Aaliyah (GROUP - 4 stops, Bay Area tour)');

  console.log('\n🎉 SEED COMPLETE!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 Login:    demo@middleground.app');
  console.log('🔑 Password: test123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👥 10 friends (3 pinned: Sophia 📌, Priya 📌, Leo 📌)');
  console.log('💌 5 received invites:');
  console.log('   1. Sophia: Park + Bakery (DRIVE → WALK)');
  console.log('   2. Marco:  Movie + Coffee + Ferry (DRIVE → TRANSIT → WALK)');
  console.log('   3. Priya:  Tea Garden (BIKE)');
  console.log('   4. Nina:   Tech Museum + Santana Row (DRIVE)');
  console.log('   5. Tyler:  GROUP (Japantown → Lake Merritt → Theater → Ferry, 10 people)');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
