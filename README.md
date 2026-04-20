# CollectMarket — Social Marketplace

A hybrid server-rendered + client-side marketplace for rare collectibles. Buyers
and sellers can list items, negotiate prices via live chat, make and accept offers,
and complete secure checkout — all in one application.

---

## Project Overview

| Layer | Technology |
|---|---|
| Page shell | **EJS** (server-side rendered by Express) |
| Interactive components | **Lit 3** Web Components (TypeScript) |
| Styling | **Tailwind CSS** (Play CDN — no build step required) |
| State management | Custom Redux-like **AppStore** + **Zod** validation |
| Database | **MongoDB Atlas** (cloud) / in-memory JSON (local fallback) |
| Deployment | **Vercel** (serverless) |
| Language | **TypeScript** — strict mode throughout |

---

## Directory Structure

```
collectmarket-vercel-ready/
├── api/
│   └── index.ts              ← Vercel serverless entry point
├── src/
│   ├── client/               ← All TypeScript / Lit source
│   │   ├── components/       ← Lit Web Components
│   │   │   ├── auth-modal.ts
│   │   │   ├── header-auth.ts
│   │   │   ├── search-bar.ts
│   │   │   ├── item-card.ts
│   │   │   ├── item-grid.ts
│   │   │   ├── list-item-modal.ts
│   │   │   ├── chat-panel.ts
│   │   │   ├── checkout-modal.ts
│   │   │   ├── item-detail-modal.ts
│   │   │   └── toast-notification.ts
│   │   ├── store/
│   │   │   └── app-store.ts  ← Redux-like observable store
│   │   ├── types/
│   │   │   └── index.ts      ← All domain TypeScript types
│   │   ├── utils/
│   │   │   ├── api.ts        ← Typed API client
│   │   │   └── validators.ts ← Zod schemas
│   │   └── main.ts           ← Client entry point / event orchestrator
│   └── server/
│       ├── index.ts          ← Express server + all API routes
│       └── db.ts             ← MongoDB connection + seed logic
├── views/
│   └── index.ejs             ← EJS page shell (server-rendered)
├── public/
│   └── dist/
│       └── main.js           ← Vite-compiled Lit bundle (committed)
├── vercel.json               ← Vercel routing + function config
├── vite.config.ts            ← Vite build config
├── tsconfig.json             ← TypeScript config (client)
├── tsconfig.server.json      ← TypeScript config (server)
├── package.json
├── .env.example              ← Copy to .env and fill in MONGODB_URI
├── .gitignore
├── README.md
└── ADR.md                    ← Architecture Decision Records
```

---

## Prerequisites

Before running this project you need:

- **Node.js v20 or higher** — check with `node --version`
  Download from [nodejs.org](https://nodejs.org)
- **npm v9 or higher** — included with Node.js
- **MongoDB Atlas account** (free) — required for data persistence
  Sign up at [mongodb.com/atlas](https://www.mongodb.com/atlas)

> **Note:** If you only want to run locally without MongoDB, see the
> [Local Development Without MongoDB](#local-development-without-mongodb) section.

---

## Quick Start (Local Development)

### Step 1 — Install dependencies

```bash
cd collectmarket-vercel-ready
npm install
```

### Step 2 — Set up environment variables

```bash
# Copy the example file
cp .env.example .env
```

Open `.env` and replace the placeholder with your real MongoDB Atlas connection string:

```env
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/collectmarket?retryWrites=true&w=majority
```

See [Getting a MongoDB URI](#getting-a-mongodb-uri) below if you don't have one yet.

### Step 3 — Build the client bundle

The Lit Web Components must be compiled by Vite before the server can serve them:

```bash
npm run build
```

This produces `public/dist/main.js`. You only need to run this once, or whenever
you edit files inside `src/client/`.

### Step 4 — Start the server

```bash
npm start
```

The application runs at **http://localhost:4000**

To run in watch mode (auto-restarts on server file changes):

```bash
npm run dev
```

> **Note:** `npm run dev` restarts the server but does **not** rebuild the Lit
> bundle. If you edit client-side components, run `npm run build` separately or
> open a second terminal with `npx vite build --watch`.

---

## Getting a MongoDB URI

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) → **Try Free**
2. Create a free **M0** cluster (AWS, any region)
3. **Database Access** → Add user → Username + auto-generated password → Save it
4. **Network Access** → Add IP Address → **Allow Access From Anywhere** (`0.0.0.0/0`)
5. **Database** → Connect → Drivers → Node.js → Copy the connection string
6. Replace `<password>` with your password and append `/collectmarket` before `?`:

```
mongodb+srv://myuser:mypassword@cluster0.abc123.mongodb.net/collectmarket?retryWrites=true&w=majority
```

The database and all collections are created automatically on first run. Seed data
(6 sample listings + 3 demo user accounts) is inserted if the collections are empty.

---

## Demo Accounts

Three accounts are seeded automatically on first run:

| Username | Password | Role |
|---|---|---|
| `ComicCollector` | `123456` | Has 2 listings |
| `ToyTrader` | `123456` | Has 2 listings |
| `CardMaster` | `123456` | Has 2 listings |

You can also register any new account directly from the **Sign In → Create Account** tab.

---

## Deploying to Vercel

### Step 1 — Push to GitHub

```bash
git init
git add .
# IMPORTANT: remove public/dist/ from .gitignore first so the built bundle is included
# Edit .gitignore and delete the line: public/dist/
git add public/dist/main.js
git commit -m "Initial deployment"
git remote add origin https://github.com/YOUR_USERNAME/collectmarket.git
git branch -M main
git push -u origin main
```

### Step 2 — Import project on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import from GitHub
2. Select your `collectmarket` repository
3. Configure:
   - **Framework Preset:** Other
   - **Build Command:** `npm run build`
   - **Output Directory:** `public`
   - **Install Command:** `npm install`

### Step 3 — Add environment variable

In the Vercel project settings, under **Environment Variables**, add:

| Name | Value |
|---|---|
| `MONGODB_URI` | Your full Atlas connection string |

### Step 4 — Deploy

Click **Deploy**. Your app will be live at `https://your-project.vercel.app` within ~60 seconds.

---

## Local Development Without MongoDB

If you want to test locally without setting up MongoDB, you can temporarily switch
the server to use in-memory JSON storage by modifying `src/server/index.ts`.

Replace the top-level import:

```typescript
// Comment out MongoDB import:
// import { getDb, hash } from './db.js';

// Add this simple in-memory fallback at the top of index.ts:
import { createHash } from 'crypto';
const hash = (p: string) => createHash('sha256').update(p).digest('hex');
```

Then replace each `await getDb()` call with references to local JSON arrays. The
`backend/` folder in the repository root contains a reference implementation of this
JSON-file approach that works without any database.

---

## API Reference

All API routes are served from the same Express server on port 4000.

### Users

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/users/login` | Sign in (auto-registers if username is new) |
| `POST` | `/api/users/register` | Explicit registration with duplicate check |
| `GET` | `/api/users` | List all users (passwords excluded) |
| `GET` | `/api/users/:id` | Get single user by ID |

### Items

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/items` | List active items (supports `?search=keyword`) |
| `GET` | `/api/items/:id` | Get single item |
| `POST` | `/api/items` | Create a new listing |
| `PUT` | `/api/items/:id` | Update item fields |
| `DELETE` | `/api/items/:id` | Remove listing |
| `POST` | `/api/items/:id/checkout` | Buyer confirms payment |
| `POST` | `/api/items/:id/confirm-sale` | Seller confirms and removes item |

### Messages

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/messages/item/:itemId` | Get all messages for an item |
| `POST` | `/api/messages` | Send a message (text, offer, or system) |
| `PUT` | `/api/messages/:id/offer-response` | Accept or reject a price offer |
| `GET` | `/api/messages/item/:id/poll/:timestamp` | Long-poll for new messages |
| `GET` | `/api/messages/unread/:userId` | Get unread counts per item |
| `POST` | `/api/messages/read` | Mark messages as read |

---

## Features

| Feature | Details |
|---|---|
| 🔐 Authentication | Login + Create Account with password hashing (SHA-256). Auto-registers new usernames on first login |
| 🔍 Search | Debounced keyword search across item name and description |
| 📋 List Items | Validated form with image preview, instant grid update |
| 💬 Live Chat | HTTP adaptive polling every 2 seconds (open-panel only) with read receipts |
| 💲 Price Offers | Buyer sends offer → Seller accepts/rejects → negotiated price flows to checkout |
| 💳 Checkout | Buyer sees price breakdown + confirms payment → `paymentStatus: 'paid'` |
| ✅ Confirm Sale | Seller sees notification banner → confirms → item removed from marketplace |
| 🔔 Unread badges | Red badge on item cards showing count of unread messages |
| 📱 Responsive | Mobile-first: 1→2→3→4 column grid, bottom-sheet modals on mobile |
| 🎨 Hybrid SSR | EJS renders the page shell; Lit handles all interactive components |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | **Yes** | Full MongoDB Atlas connection string |
| `PORT` | No | Server port (default: `4000`) |
| `VERCEL` | No | Set automatically by Vercel; adjusts file path resolution |

---

## Scripts

| Script | Description |
|---|---|
| `npm run build` | Compile Lit components via Vite → `public/dist/main.js` |
| `npm start` | Start the Express server (production mode) |
| `npm run dev` | Start with `tsx watch` (auto-restart on server changes) |

---

## Known Issues & Notes

1. **Build must run before start** — Running `npm start` without first running
   `npm run build` will cause the page to load without any interactive components
   because `public/dist/main.js` will be missing or stale.

2. **MongoDB connection on cold start** — The first request after deployment may
   take 3–5 seconds while MongoDB Atlas establishes the connection. Subsequent
   requests reuse the connection pool and are fast.

3. **MONGODB_URI missing** — If the environment variable is not set, every API
   call returns `500: MONGODB_URI environment variable is not set`. Set it in
   `.env` locally or in Vercel's Environment Variables dashboard.

4. **Tailwind CDN in production** — The project uses the Tailwind Play CDN for
   simplicity. For a production-grade setup, replace the CDN script tag with a
   PostCSS build step and a generated `tailwind.css` file to improve load time.

5. **Session persistence** — The logged-in user is stored in `localStorage`.
   Clearing browser storage or opening in a private window will require
   signing in again.