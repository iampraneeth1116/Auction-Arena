# Auction Arena

Run a live IPL auction with your friends: claim a franchise, bid in real time and build the best squad.

## Development

Requires Node.js 24.

```bash
npm install
cp .env.example .env
npm run dev:server   # API on http://localhost:3001
npm run dev          # React app on http://localhost:5173 (proxies /api to the server)
```

In production, `npm run build && npm start` serves the built app and the API from one Node process.
