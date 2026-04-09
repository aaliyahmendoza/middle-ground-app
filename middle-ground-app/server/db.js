import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '..', 'middleground.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT UNIQUE,
    phone_verified INTEGER DEFAULT 0,
    verification_code TEXT,
    code_expires_at TEXT,
    location TEXT DEFAULT '',
    avatar_letter TEXT DEFAULT '',
    color TEXT DEFAULT '#D4622A',
    profile_picture TEXT,
    username TEXT UNIQUE,
    username_last_changed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  
  CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (friend_id) REFERENCES users(id),
    UNIQUE(user_id, friend_id)
  );

  CREATE TABLE IF NOT EXISTS saved_spots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_place_id TEXT UNIQUE,
    name TEXT NOT NULL,
    category TEXT DEFAULT '',
    emoji TEXT DEFAULT '📍',
    rating REAL DEFAULT 0,
    price_level TEXT DEFAULT '',
    vibe TEXT DEFAULT '',
    address TEXT DEFAULT '',
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    photo_url TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS itineraries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_id INTEGER,
    name TEXT DEFAULT 'Untitled Plan',
    user_location TEXT DEFAULT '',
    friend_location TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (friend_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS itinerary_stops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    itinerary_id INTEGER NOT NULL,
    spot_id INTEGER NOT NULL,
    stop_order INTEGER DEFAULT 0,
    transport_mode TEXT DEFAULT 'DRIVING',
    eta_seconds_user INTEGER DEFAULT 0,
    eta_seconds_friend INTEGER DEFAULT 0,
    eta_text_user TEXT DEFAULT '',
    eta_text_friend TEXT DEFAULT '',
    start_time TEXT DEFAULT '',
    end_time TEXT DEFAULT '',
    FOREIGN KEY (itinerary_id) REFERENCES itineraries(id) ON DELETE CASCADE,
    FOREIGN KEY (spot_id) REFERENCES saved_spots(id)
  );

  CREATE TABLE IF NOT EXISTS invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    itinerary_id INTEGER NOT NULL,
    date_label TEXT DEFAULT '',
    time_label TEXT DEFAULT '',
    event_date TEXT DEFAULT '',
    message TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id),
    FOREIGN KEY (itinerary_id) REFERENCES itineraries(id)
  );
`);

// Migrations for existing databases - add new columns safely
const migrations = [
  `ALTER TABLE itinerary_stops ADD COLUMN start_time TEXT DEFAULT ''`,
  `ALTER TABLE itinerary_stops ADD COLUMN end_time TEXT DEFAULT ''`,
  `ALTER TABLE invites ADD COLUMN event_date TEXT DEFAULT ''`,
  `ALTER TABLE invites ADD COLUMN status TEXT DEFAULT 'pending'`,
  `ALTER TABLE friends ADD COLUMN is_pinned INTEGER DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN profile_picture TEXT`,
  `ALTER TABLE users ADD COLUMN username TEXT`,
  `ALTER TABLE users ADD COLUMN username_last_changed_at TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
  `ALTER TABLE invites ADD COLUMN show_guest_list INTEGER DEFAULT 1`,
];
for (const sql of migrations) {
  try { db.exec(sql); } catch (e) { /* column already exists */ }
}

export default db;
