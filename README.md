# Auction Arena

Run a live IPL auction with your friends: claim a franchise, bid in real time and build the best squad.

## Development

Requires Node.js 24.

A PostgreSQL database is needed. Locally, Docker is the quickest:

```bash
docker run -d --name auction-arena-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=auction_arena -p 55432:5432 postgres:16-alpine
```

```bash
npm install          # also generates the Prisma client
cp .env.example .env
npm run db:deploy    # create the tables
npm run dev:server   # API on http://localhost:3001
npm run dev          # React app on http://localhost:5173 (proxies /api to the server)
```

In production, `npm run build && npm start` serves the built app and the API from one Node process.
