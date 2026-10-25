<p align="center">
  <img src="./docs/logo.svg" width="360" alt="Auction Arena">
</p>

<p align="center"><b>Run a live IPL auction with your friends.</b><br>
Claim a franchise, bid against each other on 500+ real players, let bots fill the empty teams, then see who built the best side.</p>

<p align="center">
  <a href="https://auction-arena-g1ot.onrender.com"><b>▶ Play it live: auction-arena-g1ot.onrender.com</b></a><br>
  <sub>Free hosting: if nobody has played for a while, the first visit takes 30–60 seconds while the server wakes up.</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-20232A?logo=react&logoColor=61DAFB" alt="React 19">
  <img src="https://img.shields.io/badge/Node.js-24_LTS-339933?logo=node.js&logoColor=white" alt="Node.js 24">
  <img src="https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io&logoColor=white" alt="Socket.IO 4">
  <img src="https://img.shields.io/badge/PostgreSQL-Prisma_7-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL with Prisma 7">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwind-css&logoColor=white" alt="Tailwind CSS 4">
</p>

---

## ✨ Features

**The auction**
- **Server-run bidding** — the Node server owns the clock, checks every bid (purse, squad size, overseas quota) and sells players, so nobody can cheat from the browser and the auction carries on if the host closes their tab or the server restarts.
- **Four formats** — Mega (25-player squads, ₹120 Cr, the full list), Classic 11 (11, ₹90 Cr, a 150-player pool), Sprint 5 (5, ₹60 Cr, an 80-player pool) and Blitz 5 (5, ₹30 Cr, 80 players, 3 seconds per bid). Any mode can use a **quick pool**: only (franchises taking part × squad size) + 10 players go under the hammer. **Unsold players come back** in later rounds until a round sells nobody, and the host can set **any overseas limit**, or none. Shorter pools are drawn at random from the top-rated players, with an Indian keeper for every franchise and enough Indians for every squad, so each room gets a different set of stars.
- **Bots** — fill empty franchises with AI managers. Each plans its squad by role and by the jobs a T20 XI needs, values players by rating and the purse it has left, and has its own leaning. Friends can take a franchise over from its bot before the start.
- **Broadcast-style room** — the player on the block with role-aware stats, a segmented countdown, a bid trail, the next four lots (tap one for its full player card, or the host can hide them so every lot is a surprise), a SOLD moment in the buyer's colours with their anthem, and a running ticker of sales.
- **Bidding help** — a max-bid hint that keeps enough purse to fill your squad, live purse/squad/overseas read-outs, an "outbid" alert, and the **B** key to bid.
- **Voice auctioneer** — announces each lot, every raise and the hammer; voice, pace and pitch are saved per device.

**Rooms**
- **Open rooms** — list your room publicly; anyone signed in can find it, join an open franchise or watch.
- **Spectating** — watch any room with `?watch=1`. Arrive after the start and you can claim any franchise nobody holds.
- **Host controls** — bid timer, visibility, quick pool, unsold rounds, overseas limit, hiding upcoming players, pause/resume/end, removing people.
- **Chat with GIFs**, presence, and a history of every auction you've played (remove one, with undo).

**After the hammer**
- **Arena Rating** — every player gets a 1–99 rating. Their auction tier (marquee, Set 1 … uncapped) sets the band and their T20 career places them inside it, compared with others in the same role, so the best bowler rates as highly as the best batter. A curated next-IPL outlook (`src/data/playerOutlook.js`) then moves about a hundred players up or down for recent IPL and T20I form, retirements, injuries and bans, and their player card shows why.
- **Arena Strength** — every squad is scored on the best legal playing XI it can field (an empty place counts as zero) and its depth. The XI's combination counts too: a keeper, openers and a finisher, a left/right mix and an anchor up top, power hitters, pace and spin, and powerplay and death bowling, using a playing profile for each player.
- **AI power rankings** — an AI analyst (Groq) previews how each franchise would do in the next IPL, grading XI quality, balance, depth and value. The final score is half the AI's view and half Arena Strength, and an unfinished squad loses points either way.
- **Your XI and batting order** — after the auction, each manager can pick their playing XI from their squad and drag it into their batting order (it starts from the best XI, openers first). The whole room sees it on the squad cards and posters; Arena Strength still judges the best XI.
- **Squad posters** — share any squad as an image, with the XI numbered in batting order.
- **Fantasy league** — pick an XI, captain (2×), vice-captain (1.5×) and impact player from the players you bought; a daily job scores real IPL matches from CricAPI.

## 🛠 Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite 8, Tailwind CSS 4, Framer Motion, React Router (pages load on demand) |
| Backend | Node.js 24 LTS, Express 5, Socket.IO 4 |
| Database | PostgreSQL with Prisma 7 (`@prisma/adapter-pg`) |
| Auth | JWT access tokens + rotating refresh tokens in httpOnly cookies; Google OAuth; bcrypt passwords |
| AI | Groq (`openai/gpt-oss-120b`) with strict JSON schema output, called only from the server |
| Data jobs | CricAPI scorecards, GitHub Actions |

### How login works

- Signing in (Google, email or guest) sets two **httpOnly cookies**: a 15-minute JWT access token and a 7-day refresh token. JavaScript on the page can never read either.
- The refresh token is random, stored only as a SHA-256 hash, and **rotated on every use**. An old refresh token that comes back later ends all of that user's sessions.
- Google sign-in uses the popup code flow: the server exchanges the code and verifies Google's ID token.
- The fantasy admin page is limited to the Google account set in `ADMIN_EMAIL`.

### How bots bid

- Bots run inside the server's auction engine and bid under exactly the same checks as people.
- Each bot works out what a player is worth to it: the purse it has per open slot, scaled by the player's Arena Rating against the pool's average, its need for that role and for the XI's jobs (openers, a finisher, pace, spin, death bowling…), its franchise's leaning and a per-player mood. It always keeps enough to fill the rest of its squad.
- They raise quickly while a player is a bargain, slow down near their limit (sometimes dropping out), and never bid in the last 600 ms, so a person always gets the final word.

### How AI power rankings work

- Available on the results page once an auction is complete. Any manager in the room can generate them; the result is saved, so the AI runs once per room. The host can regenerate.
- The server sends Groq only data from the game's own player list: each franchise's best XI with ratings, prices, playing profiles and next-IPL outlook notes, the gaps found in it, and a summary of its bench. Manager names are never sent, so nobody can slip instructions into the prompt through their display name.
- The model must answer in a strict JSON schema, and the server still validates the reply: unknown teams are dropped, scores are clamped to 0–100, text is trimmed, and a "best buy" is only shown if that team really bought the player.

## 🚀 Getting Started

### Prerequisites

- **Node.js 24 LTS** (the repo includes `.node-version`; with fnm run `fnm use`)
- **PostgreSQL** — a free [Neon](https://neon.tech) database, or Docker locally
- A **Google OAuth client** for Google sign-in (optional; email and guest sign-in work without it)
- A **Groq API key** for AI power rankings (optional)

### 1. Install

```bash
npm install          # also generates the Prisma client
cp .env.example .env
```

### 2. Database

**Local Docker** (matches the default `DATABASE_URL` in `.env.example`):

```bash
docker run -d --name auction-arena-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=auction_arena -p 55432:5432 postgres:16-alpine
```

**Or Neon:** create a project → **Connect** → copy the connection string into `DATABASE_URL`.
If the connection fails, remove `&channel_binding=require` from the end of the URL.

Then create the tables:

```bash
npm run db:deploy
```

### 3. Secrets

```bash
openssl rand -hex 48   # paste the output into JWT_SECRET
```

For Google sign-in: [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **Create credentials → OAuth client ID → Web application**. Add `http://localhost:5173` under **Authorized JavaScript origins**, then copy the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

For AI power rankings: [console.groq.com](https://console.groq.com/keys) → **API Keys → Create API Key**, and paste it into `GROQ_API_KEY`. `GROQ_MODEL` is optional; the default is `openai/gpt-oss-120b`.

For GIFs in chat: [developers.giphy.com](https://developers.giphy.com/) → **Create an App → API**, and paste the key into `VITE_GIPHY_API_KEY`.

### 4. Run

Two terminals:

```bash
npm run dev:server   # API + Socket.IO on http://localhost:3001
npm run dev          # React app on http://localhost:5173 (proxies /api and /socket.io)
```

Open http://localhost:5173.

## ⚙️ Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `npm run dev:server` | Frontend and backend in development |
| `npm run build` / `npm start` | Build the React app, then serve everything from one Node process |
| `npm run lint` | ESLint over the app, server, scripts and tests |
| `npm run db:migrate` | Create a migration after editing `prisma/schema.prisma` |
| `npm run db:deploy` | Apply migrations to the database in `DATABASE_URL` |
| `npm run fantasy:update` | Score IPL matches finished since the last run (daily job) |
| `npm run fantasy:backfill` | Score every finished IPL 2026 match not yet processed |
| `npm run fantasy:upload` | Seed player totals from the table in `scripts/fantasy/seedTotals.js` |
| `npm test` | The three end-to-end suites below |

## 🧪 Testing

`npm test` starts the real server on spare ports and drives it like browsers would, over HTTP and Socket.IO:

- **`tests/auction.e2e.mjs`** — sign-up and sessions, rooms and the live lobby, chat, host controls, spectators and latecomers, bidding, pause/resume, a server restart mid-auction, squad/overseas/purse rules, the fantasy league and its admin, and fantasy scoring.
- **`tests/arena.e2e.mjs`** — modes and player pools, room options, open rooms, history and the Just sold strip, best-XI judging, and a full auction run by bots.
- **`tests/power-rankings.e2e.mjs`** — AI power rankings against a fake Groq server, including deliberately messy model output.

No Google, Groq or Giphy keys are needed. The tests write users, rooms and purchases to the database in `DATABASE_URL`, so run them against a local database (the Docker setup above) after `npm run db:deploy`. They refuse to run against a non-local database unless you set `ALLOW_REMOTE_TEST_DB=1`.

GitHub Actions runs lint, the tests (against a throwaway Postgres) and a production build on every push and pull request.

## 🌐 Deployment

The Node server serves the built React app, the API and Socket.IO from one domain, so the auth cookies are same-site. Use a host that keeps a long-running process with WebSockets, such as **Render** or **Railway**. Vercel's serverless functions can't hold Socket.IO connections.

**Render (Blueprint):** the repo includes `render.yaml`. In Render choose **New → Blueprint**, pick this repo, and fill in the secrets it asks for. Or set up a **Web Service** by hand:

- **Build command:** `npm ci --include=dev && npm run build && npm run db:deploy` (`--include=dev` matters: with `NODE_ENV=production` npm would otherwise skip Vite and Prisma)
- **Start command:** `npm start`
- **Health check path:** `/api/health` (it also checks the database answers)
- **Environment:** `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET` (new random value), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAIL`, `GROQ_API_KEY`, `VITE_GIPHY_API_KEY`, and optionally `VITE_CONTACT_EMAIL` (shown on the privacy page)
- Add your Render URL to the Google OAuth client's **Authorized JavaScript origins**.

Run a single instance: live auction state is held in the server's memory (and saved to Postgres after every change).

**Daily fantasy job:** add `DATABASE_URL` and `CRICKET_API_KEY` under the repo's **Settings → Secrets and variables → Actions**. Without them the job skips quietly.

## 📂 Project Structure

```
auction-arena/
├── prisma/
│   ├── schema.prisma          # Users, rooms, members (people and bots), purchases, messages, fantasy, power rankings
│   └── migrations/
├── server/
│   ├── index.js               # Express app, static hosting, Socket.IO
│   ├── auctionRules.js        # Modes, bid increments, player pools, ratings
│   ├── bots.js                # How bots value players and pace their bids
│   ├── realtime/
│   │   ├── roomManager.js     # Auction engine: timers, bid checks, sales, bots, spectators, open rooms
│   │   └── socket.js          # Socket.IO events
│   ├── routes/                # /api/auth, rooms & history, fantasy & admin, power rankings, activity
│   ├── auth/                  # JWT + refresh-token sessions, cookie auth middleware
│   └── ai/groq.js             # Groq client (structured JSON output)
├── scripts/                   # Fantasy-points jobs in scripts/fantasy (daily update, season backfill, seeding totals); shared scoring in scripts/lib
├── src/
│   ├── pages/                 # Home, Lobby, AuctionRoom, Results, HowToPlay, PrivacyPolicy, FantasyAdmin, NotFound
│   ├── components/
│   │   ├── ui/                # Design system: panels, buttons, tags, crests, ratings, modals, ticker, toasts
│   │   ├── auction/           # The live room: lot card, price board, bid console, team board, feed
│   │   └── fantasy/           # Fantasy XI picker and leaderboard
│   ├── hooks/                 # useAuth, useAuction, voice auctioneer, room sounds, local settings
│   ├── lib/                   # API and socket clients, Arena Rating, best-XI judging, batting orders, formatting, image sharing
│   └── data/                  # Players, playing profiles, next-IPL outlook and teams
├── tests/                     # End-to-end tests (npm test)
└── .github/workflows/         # CI, and the daily fantasy update
```

## 📄 Licence

Copyright © 2026 Praneeth. All rights reserved. This is proprietary software: no permission is granted to copy, modify, distribute or use it. See [LICENSE](LICENSE).
