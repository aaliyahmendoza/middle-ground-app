# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Middle Ground is a social coordination platform that calculates statistically fair meeting points between two or more locations. It provides live ETAs, vibe-based spot discovery, smart itinerary building, and collaborative invite system.

## Development Setup

### Running the Application

The application requires **two separate processes** running simultaneously:

```bash
cd middle-ground-app
npm run dev     # Terminal 1: Vite dev server (http://localhost:5173)
npm run server  # Terminal 2: Express API server (http://localhost:3001)
```

### Environment Configuration

Create `.env` file in `middle-ground-app/` directory from `.env.template`:
- `GOOGLE_MAPS_API_KEY` - Backend API key for Google Maps/Places
- `VITE_GOOGLE_MAPS_API_KEY` - Frontend API key (must be prefixed with `VITE_`)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` - SMS verification
- `SESSION_SECRET` - Express session secret
- `PORT` - Backend port (defaults to 3001)

### Other Commands

```bash
npm run build   # Production build (outputs to dist/)
npm run lint    # Run ESLint on all files
npm run preview # Preview production build locally
```

## Architecture

### Frontend (React 19 + Vite)

**Structure:**
- `src/main.jsx` - Application entry point
- `src/App.jsx` - Main application component with routing logic (~38k tokens, read selectively)
- `src/api.js` - Centralized API client for all backend endpoints
- `src/context/AuthContext.jsx` - Authentication state management
- `src/hooks/useGoogleMaps.jsx` - Google Maps API loading hook
- `src/components/MapExplorer.jsx` - Main map interface component
- `src/pages/` - Page components (Login, Register, VerifyPhone)

**Key Dependencies:**
- `@react-google-maps/api` - Google Maps integration
- `react-easy-crop` - Image cropping for profile pictures
- `browser-image-compression` - Client-side image optimization

**API Proxy:**
Vite proxies `/api/*` requests to `http://localhost:3001` (configured in `vite.config.js`)

### Backend (Express + SQLite)

**Structure:**
- `server/index.js` - Express app setup, middleware, route mounting
- `server/db.js` - SQLite database initialization with schema and migrations
- `server/middleware/requireAuth.js` - Session authentication middleware
- `server/routes/` - Modular route handlers:
  - `auth.js` - User registration, login, phone verification
  - `spots.js` - Google Places API integration, midpoint calculation
  - `friends.js` - Friend management and requests
  - `itineraries.js` - Itinerary and stop CRUD operations
  - `invites.js` - Invite creation and status updates
  - `sms.js` - Twilio SMS integration

**Database (better-sqlite3):**
- File: `middleground.db` (SQLite with WAL mode)
- Schema: `users`, `friends`, `saved_spots`, `itineraries`, `itinerary_stops`, `invites`
- Migrations run automatically on server startup (safe to re-run)
- Foreign keys enforced, cascading deletes configured

**Authentication:**
- Session-based with `express-session`
- 7-day cookie lifetime
- Phone verification via Twilio SMS codes
- Passwords hashed with bcrypt

## Important Technical Details

### Google Maps Integration

The app uses two separate API keys:
- Backend key (`GOOGLE_MAPS_API_KEY`) - For Places API and Directions API server-side requests
- Frontend key (`VITE_GOOGLE_MAPS_API_KEY`) - For `@react-google-maps/api` client-side rendering

Both keys must have appropriate restrictions and services enabled (Places API, Directions API, Maps JavaScript API).

### Database Migrations

Migrations in `server/db.js` use try-catch to safely add new columns. When adding schema changes:
1. Add the migration SQL to the `migrations` array
2. Migrations are idempotent (safe to run multiple times)
3. Failed migrations are silently caught (column already exists)

### CORS Configuration

Backend allows only `localhost` origins in development (see `server/index.js:21`). Update CORS config for production deployments.

### Production Build

When `NODE_ENV=production`, the Express server serves static files from `dist/` and handles client-side routing with a catch-all route.

## Code Conventions

- ES modules (`type: "module"` in package.json) - use `import/export`, not `require()`
- React functional components with hooks (no class components)
- Centralized API calls through `src/api.js` - never fetch directly from components
- Database queries use synchronous better-sqlite3 API (`.prepare()`, `.run()`, `.get()`, `.all()`)

## Testing

The repository includes several seed/test files in `middle-ground-app/`:
- `seed*.js` / `seed*.cjs` - Database population scripts
- `test_e2e.cjs` - End-to-end testing script
- `populate_test_data.cjs` - Test data generator

Run seed scripts with: `node seed.js` (or `.cjs` files with node)
