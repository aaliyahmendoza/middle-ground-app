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

app.use(cors({ origin: (origin, cb) => { if (!origin || origin.startsWith('http://localhost')) cb(null, true); else cb(new Error('CORS')); }, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'middle-ground-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax' },
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
