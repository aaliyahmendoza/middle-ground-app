import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';

const db = new Database('middleground.db');

async function seed() {
  try {
    const userEmail = 'tester_unique@example.com';
    let user = db.prepare('SELECT id FROM users WHERE email = ?').get(userEmail);
    if (!user) {
      console.log('User not found, creating...');
      const hash = await bcrypt.hash('password', 12);
      const res = db.prepare('INSERT INTO users (name, email, password_hash, avatar_letter, color) VALUES (?, ?, ?, ?, ?)').run('Tester', userEmail, hash, 'T', '#C0541F');
      user = { id: res.lastInsertRowid };
    }
    const userId = user.id;

    // 2. Create 10 friends
    const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Ethan', 'Fiona', 'George', 'Hannah', 'Ian', 'Jenna'];
    const colors = ['#E07C5A', '#6B8F71', '#7B5EA7', '#D4622A', '#3D8B4B', '#C0541F', '#5A9BD5', '#EE82EE', '#FFD700', '#FF4500'];
    const friendIds = [];

    for (let i = 0; i < names.length; i++) {
        const email = names[i].toLowerCase() + '@example.com';
        let f = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (!f) {
            const res = db.prepare('INSERT INTO users (name, email, password_hash, avatar_letter, color) VALUES (?, ?, ?, ?, ?)').run(names[i], email, '$2b$12$dummyhash', names[i][0], colors[i]);
            f = { id: res.lastInsertRowid };
        }
        friendIds.push(f.id);

        // Friendship
        try {
           db.prepare('INSERT INTO friends (user_id, friend_id, status, is_pinned) VALUES (?, ?, ?, ?)').all(userId, f.id, 'accepted', i < 3 ? 1 : 0);
           // Try both ways as friends table is bi-directional but often stored as single record
           // But our friends.js does SELECT u.id FROM friends f JOIN users u ON (f.friend_id = u.id AND f.user_id = ?) OR (f.user_id = u.id AND f.friend_id = ?)
           // So one record is enough.
        } catch(e) {
            db.prepare('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').run(userId, f.id, f.id, userId);
            db.prepare('INSERT INTO friends (user_id, friend_id, status, is_pinned) VALUES (?, ?, ?, ?)').run(userId, f.id, 'accepted', i < 3 ? 1 : 0);
        }
    }

    // 3. Create 5 dummy itineraries
    const itNames = ['Pizza Night', 'Park Hangout', 'Coffee Date', 'Brunch Party', 'Movie Marathon'];
    for (let i = 0; i < itNames.length; i++) {
        const res = db.prepare('INSERT INTO itineraries (user_id, friend_id, name, user_location, friend_location) VALUES (?, ?, ?, ?, ?)').run(userId, friendIds[i], itNames[i], 'Downtown LA', 'Santa Monica');
        const itId = res.lastInsertRowid;
        
        // Add a stop to each itinerary
        db.prepare('INSERT INTO itinerary_stops (itinerary_id, spot_id, stop_order, transport_mode) VALUES (?, ?, ?, ?)').run(itId, 1, 0, 'DRIVING');

        // Create SENT invite
        const sentStatuses = ['accepted', 'pending', 'declined', 'accepted', 'pending'];
        db.prepare('INSERT INTO invites (sender_id, receiver_id, itinerary_id, status, message, event_date) VALUES (?, ?, ?, ?, ?, ?)').run(userId, friendIds[i], itId, sentStatuses[i], "Check out our plan!", '2026-04-10');

        // Create RECEIVED invite (from friends 6-10)
        const recStatuses = ['accepted', 'pending', 'declined', 'accepted', 'pending'];
        db.prepare('INSERT INTO invites (sender_id, receiver_id, itinerary_id, status, message, event_date) VALUES (?, ?, ?, ?, ?, ?)').run(friendIds[i+5 < friendIds.length ? i+5 : i], userId, itId, recStatuses[i], "What do you think of this?", '2026-04-15');
    }

    console.log('Seed successful for user:', userEmail);
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
