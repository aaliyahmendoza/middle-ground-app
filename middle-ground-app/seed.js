import bcrypt from 'bcrypt';
import db from './server/db.js';

async function seed() {
  const passwordHash = await bcrypt.hash('password123', 12);
  const colors = ['#E07C5A', '#6B8F71', '#7B5EA7', '#D4622A', '#3D8B4B', '#C0541F'];

  // Delete previous test users to be clean
  // Using try/catch to gracefully handle if tables are locked, but let's just delete
  console.log('Cleaning up existing test data...');
  db.exec('DELETE FROM friends WHERE user_id IN (SELECT id FROM users WHERE email LIKE \'test%@test.com\') OR friend_id IN (SELECT id FROM users WHERE email LIKE \'test%@test.com\')');
  db.exec('DELETE FROM invites');
  db.exec('DELETE FROM itinerary_stops');
  db.exec('DELETE FROM itineraries');
  
  db.exec("DELETE FROM users WHERE email LIKE 'test%@test.com'");

  console.log('Creating users...');
  const userIds = [];
  for (let i = 1; i <= 11; i++) {
    const res = db.prepare(
      'INSERT INTO users (name, email, password_hash, avatar_letter, color) VALUES (?, ?, ?, ?, ?)'
    ).run(`TestUser${i}`, `test${i}@test.com`, passwordHash, 'T', colors[i % colors.length]);
    userIds.push(res.lastInsertRowid);
  }

  const primaryId = userIds[0];

  console.log('Making friends...');
  // Make friends
  for (let i = 1; i < 11; i++) {
    db.prepare('INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)').run(primaryId, userIds[i], 'accepted');
  }

  console.log('Creating spots...');
  // Create some spots
  db.exec(`INSERT OR IGNORE INTO saved_spots (id, google_place_id, name, category, emoji, lat, lng) VALUES (1, 'pl1', 'Boba Guys', 'Cafe', '🧋', 37.77, -122.41)`);
  db.exec(`INSERT OR IGNORE INTO saved_spots (id, google_place_id, name, category, emoji, lat, lng) VALUES (2, 'pl2', 'Sushi Taro', 'Restaurant', '🍣', 37.78, -122.40)`);

  console.log('Creating invites...');
  // Create 5 Received invites (friends sent to primary)
  for (let i = 1; i <= 5; i++) {
    const friendId = userIds[i]; // test2 .. test6
    const itin = db.prepare('INSERT INTO itineraries (user_id, friend_id, name) VALUES (?, ?, ?)').run(friendId, primaryId, `Plan from TestUser${i+1}`);
    const itinId = itin.lastInsertRowid;
    db.prepare('INSERT INTO itinerary_stops (itinerary_id, spot_id, stop_order, start_time, end_time) VALUES (?, 1, 0, ?, ?)').run(itinId, '12:00', '13:00');
    db.prepare('INSERT INTO itinerary_stops (itinerary_id, spot_id, stop_order, start_time, end_time) VALUES (?, 2, 1, ?, ?)').run(itinId, '13:30', '14:30');
    db.prepare('INSERT INTO invites (sender_id, receiver_id, itinerary_id, event_date, status) VALUES (?, ?, ?, ?, ?)').run(friendId, primaryId, itinId, '2026-05-01', 'pending');
  }

  // Create 5 Sent invites (primary sent to friends)
  for (let i = 6; i <= 10; i++) {
    const friendId = userIds[i]; // test7 .. test11
    const itin = db.prepare('INSERT INTO itineraries (user_id, friend_id, name) VALUES (?, ?, ?)').run(primaryId, friendId, `Plan with TestUser${i+1}`);
    const itinId = itin.lastInsertRowid;
    db.prepare('INSERT INTO itinerary_stops (itinerary_id, spot_id, stop_order, start_time, end_time) VALUES (?, 1, 0, ?, ?)').run(itinId, '10:00', '11:00');
    db.prepare('INSERT INTO invites (sender_id, receiver_id, itinerary_id, event_date, status) VALUES (?, ?, ?, ?, ?)').run(primaryId, friendId, itinId, '2026-05-02', 'pending');
  }
  
  console.log('Seeded successfully with 10 users, 5 received invites, and 5 sent invites for test1@test.com');
}

seed().catch(console.error);
