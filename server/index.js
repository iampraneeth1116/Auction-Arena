import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './config.js';
import { prisma } from './db.js';

const app = express();
// Hosts like Render put one proxy in front: needed for real client IPs
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// Also confirms the database answers, so a host's health check catches a bad DATABASE_URL
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false, error: 'Database unavailable' });
  }
});
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// In production this same server hosts the built React app (one origin for everything)
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false }));
  // Client-side routes (/lobby/ABC123 …) all load the app
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// eslint-disable-next-line no-unused-vars -- Express only treats 4-argument middleware as an error handler
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  const status = err.status || 500;
  // Deliberate errors explain themselves; anything else could leak internals
  const isExpected = err.expose === true || status < 500;
  if (!isExpected) console.error(err);
  res.status(status).json({ error: isExpected ? err.message : 'Something went wrong', code: err.code });
});

const server = http.createServer(app);
server.listen(config.port, () => {
  console.log(`[server] listening on http://localhost:${config.port}`);
});
