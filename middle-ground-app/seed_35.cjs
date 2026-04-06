const Database = require('better-sqlite3');
const db = new Database('middleground.db');

db.pragma('foreign_keys = ON');

const ME = 35;
const friends = [25, 26, 27, 28, 29, 30, 31, 32, 33, 34];

console.log('Populating data for User 35...');

try {
  db.transaction(() => {
    // 1. Clear existing data for user 35
    db.prepare('DELETE FROM invites WHERE sender_id = ? OR receiver_id = ?').run(ME, ME);
    db.prepare('DELETE FROM itinerary_stops WHERE itinerary_id IN (SELECT id FROM itineraries WHERE user_id = ? OR friend_id = ?)').run(ME, ME);
    db.prepare('DELETE FROM itineraries WHERE user_id = ? OR friend_id = ?').run(ME, ME);
    db.prepare('DELETE FROM friends WHERE user_id = ? OR friend_id = ?').run(ME, ME);

    // 2. Add 10 friends
    for (const fId of friends) {
      db.prepare('INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)').run(ME, fId, 'accepted');
      db.prepare('INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)').run(fId, ME, 'accepted');
    }

    // 3. 5 Sent Invites (35 -> [25,26,27,28,29])
    for (let i = 0; i < 5; i++) {
        const fId = friends[i];
        const it = db.prepare('INSERT INTO itineraries (name, user_id, friend_id, user_location, friend_location) VALUES (?, ?, ?, ?, ?)').run(
            `Adventure with Friend ${i+1}`, ME, fId, 'San Jose, CA', 'San Francisco, CA'
        );
        const itId = it.lastInsertRowid;
        db.prepare('INSERT INTO invites (sender_id, receiver_id, itinerary_id, status, message, event_date) VALUES (?, ?, ?, ?, ?, ?)').run(
            ME, fId, itId, 'pending', `Hey! Join me for an adventure! #${i+1}`, '2026-05-15'
        );
    }

    // 4. 5 Received Invites ([30,31,32,33,34] -> 35)
    for (let i = 5; i < 10; i++) {
        const fId = friends[i];
        const it = db.prepare('INSERT INTO itineraries (name, user_id, friend_id, user_location, friend_location) VALUES (?, ?, ?, ?, ?)').run(
            `Meetup from Friend ${i+1}`, fId, ME, 'Oakland, CA', 'San Jose, CA'
        );
        const itId = it.lastInsertRowid;
        db.prepare('INSERT INTO invites (sender_id, receiver_id, itinerary_id, status, message, event_date) VALUES (?, ?, ?, ?, ?, ?)').run(
            fId, ME, itId, 'pending', `Wanna meet up in the middle? Plan #${i+1}`, '2026-06-20'
        );
    }
  })();

  console.log('Successfully populated 10 friends, 5 sent invites, and 5 received invites for User 35.');
} catch (err) {
  console.error('Error populating data:', err);
}
