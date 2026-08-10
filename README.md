# Nexus Reviews — Static Demo Build

This is a **fully static, backend-free** version of the app. The original
project was a monorepo with a React frontend *plus* a Cloudflare Worker API
backed by Postgres (Neon) via Drizzle ORM. That backend has been removed
entirely — there is no database, no server, and no API keys anywhere in this
repo.

Every screen and feature still works exactly as before. Instead of calling
a real API, the app reads and writes to a small in-browser "database" that
lives in `localStorage` (see `src/lib/mockDb.ts`) and is pre-loaded with
realistic sample data the first time it loads (`src/lib/api.ts` is a
drop-in replacement for the original API client — same functions, same
return shapes, nothing else in the app had to change).

Because it's 100% static (`vite build` → plain HTML/CSS/JS), it can be
hosted anywhere: Cloudflare Pages, GitHub Pages, Netlify, Vercel, etc.

## What "demo mode" means in practice

- **Sign up** with any email/password to spin up a brand-new demo business,
  pre-seeded with sample reviews, competitors, posts, DMs, etc.
- **Log in** with the seeded demo account:
  - Email: `demo@example.com`
  - Password: `demo1234`
- **Admin console** (`/admin`) is available via a separate seeded login:
  - Email: `admin@example.com`
  - Password: `admin1234`
- AI features (review reply drafts, screening, the advisor chat, caption/
  post generation, image generation, DM auto-replies, etc.) return
  realistic templated output instead of calling a real LLM — no API key
  required, and every feature is fully clickable.
- "Publishing" to social platforms, sending SMS/email review requests, and
  Stripe billing are all simulated locally — nothing actually sends
  anywhere.
- Everything is stored per-browser in `localStorage`. Clearing site data
  (or opening a private window) resets the demo back to its seeded state.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm install
npm run build   # outputs static files to dist/
```

## Deploy to Cloudflare Pages

**Option A — connect the GitHub repo (recommended):**

1. Push this repo to GitHub.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages →
   Connect to Git**, and select this repo.
3. Build settings:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Deploy. No environment variables are required (the `VITE_BRAND_*`
   variables in `.env.example` are optional white-label overrides).

**Option B — deploy from the CLI:**

```bash
npm install
npm run build
npx wrangler pages deploy dist
```

A `public/_redirects` file is already included (`/* /index.html 200`) so
client-side routing works correctly on Cloudflare Pages.

## Project structure

```
src/
  lib/
    api.ts        # same function names/signatures as the original API client,
                   # but reads/writes the local mock database instead of fetch()
    mockDb.ts      # in-browser "database": seed data + localStorage persistence
  pages/           # unchanged — every dashboard/admin/kiosk/widget page
  components/
```

## Turning this back into a real backend later

If you ever want to reconnect a real backend, you only need to change one
file: `src/lib/api.ts`. Every page in the app imports from it by name
(`authApi`, `reviewsApi`, `kioskApi`, etc.), so swapping it for a real
`fetch()`-based client (like the original) restores full production
functionality without touching any page or component.
