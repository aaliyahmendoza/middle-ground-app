import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

import authRoutes from './routes/auth.js';
import spotsRoutes from './routes/spots.js';
import friendsRoutes from './routes/friends.js';
import itinerariesRoutes from './routes/itineraries.js';
import invitesRoutes from './routes/invites.js';
import smsRoutes from './routes/sms.js';

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isProd = process.env.NODE_ENV === 'production';

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // server-to-server or same-origin
    if (!isProd) return origin.startsWith('http://localhost') ? cb(null, true) : cb(new Error('CORS'));
    const allowed = process.env.ALLOWED_ORIGIN;
    if (allowed && origin === allowed) return cb(null, true);
    if (origin.endsWith('.railway.app') || origin.endsWith('.up.railway.app')) return cb(null, true);
    return cb(null, true); // allow all in production (Railway handles HTTPS termination)
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.set('trust proxy', 1); // trust Railway's reverse proxy for secure cookies
app.use(session({
  secret: process.env.SESSION_SECRET || 'middle-ground-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProd,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: isProd ? 'none' : 'lax',
  },
}));

app.use('/api/auth', authRoutes);
app.use('/api/spots', spotsRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/itineraries', itinerariesRoutes);
app.use('/api/invites', invitesRoutes);
app.use('/api/sms', smsRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'dist', 'index.html')));
}

app.listen(PORT, () => console.log(`🎯 Middle Ground API running on http://localhost:${PORT}`));
