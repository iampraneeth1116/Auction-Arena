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

## Testing

`npm test` starts the real server on its own port and plays through sign-in, rooms, the live lobby, chat, host controls and a short auction over HTTP and Socket.IO. It writes test users and rooms, so it only runs against a local database (the Docker one above); it refuses any other host unless `ALLOW_REMOTE_TEST_DB=1` is set.
