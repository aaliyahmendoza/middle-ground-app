import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'middleground.db');
const db = new Database(dbPath);

async function seed() {
  try {
    const userEmail = 'tester_unique@example.com';
    let user = db.prepare('SELECT id FROM users WHERE email = ?').get(userEmail);
    if (!user) {
      console.log('User not found. Run dev server first or registration!');
      process.exit(1);
    }
    const userId = user.id;
    console.log('Seeding for user:', userId);

    // 2. Create 10 friends
    const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Ethan', 'Fiona', 'George', 'Hannah', 'Ian', 'Jenna'];
    const colors = ['#E07C5A', '#6B8F71', '#7B5EA7', '#D4622A', '#3D8B4B', '#C0541F', '#5A9BD5', '#EE82EE', '#FFD700', '#FF4500'];
    const friendIds = [];

    // Clear old friends
    db.prepare('DELETE FROM friends WHERE user_id = ? OR friend_id = ?').run(userId, userId);

    for (let i = 0; i < names.length; i++) {
        const email = names[i].toLowerCase() + '@example.com';
        let f = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (!f) {
            const res = db.prepare('INSERT INTO users (name, email, password_hash, avatar_letter, color) VALUES (?, ?, ?, ?, ?)').run(names[i], email, '$2b$12$dummyhash', names[i][0], colors[i]);
            f = { id: res.lastInsertRowid };
        }
        friendIds.push(f.id);

        // Friendship
        db.prepare('INSERT INTO friends (user_id, friend_id, status, is_pinned) VALUES (?, ?, ?, ?)').run(userId, f.id, 'accepted', i < 3 ? 1 : 0);
    }

    // 3. Create dummy itinerary & invites
    db.prepare('DELETE FROM invites WHERE sender_id = ? OR receiver_id = ?').run(userId, userId);
    
    // Create base spots
    db.exec(`INSERT OR IGNORE INTO saved_spots (id, name, google_place_id, lat, lng, emoji) VALUES (1, 'Central Pizza', 'cp1', 34.0522, -118.2437, 'í½•')`);

    for (let i = 0; i < 5; i++) {
        const res = db.prepare('INSERT INTO itineraries (user_id, friend_id, name, user_location, friend_location) VALUES (?, ?, ?, ?, ?)').run(userId, friendIds[i], 'Plan ' + (i+1), 'Mid-City', 'Hollywoord');
        const itId = res.lastInsertRowid;
        db.prepare('INSERT INTO itinerary_stops (itinerary_id, spot_id, stop_order) VALUES (?, ?, ?)').run(itId, 1, 0);

        const sStat = ['accepted', 'pending', 'declined', 'accepted', 'pending'][i];
        db.prepare('INSERT INTO invites (sender_id, receiver_id, itinerary_id, status, message, event_date) VALUES (?, ?, ?, ?, ?, ?)').run(userId, friendIds[i], itId, sStat, "SENT Invite " + i, '2026-04-10');
    }

    for (let i = 5; i < 10; i++) {
        const res = db.prepare('INSERT INTO itineraries (user_id, friend_id, name, user_location, friend_location) VALUES (?, ?, ?, ?, ?)').run(friendIds[i], userId, 'Plan ' + (i+1), 'Santa Monica', 'Downtown');
        const itId = res.lastInsertRowid;
        db.prepare('INSERT INTO itinerary_stops (itinerary_id, spot_id, stop_order) VALUES (?, ?, ?)').run(itId, 1, 0);

        const rStat = ['accepted', 'pending', 'declined', 'accepted', 'pending'][i-5];
        db.prepare('INSERT INTO invites (sender_id, receiver_id, itinerary_id, status, message, event_date) VALUES (?, ?, ?, ?, ?, ?)').run(friendIds[i], userId, itId, rStat, "RECEIVED Invite " + i, '2026-04-12');
    }

    console.log('Seeded successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Final seed fail:', err.message);
    process.exit(1);
  }
}
seed();
