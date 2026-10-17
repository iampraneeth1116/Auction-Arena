// Shared helpers for the end-to-end tests. Each test starts the real server on its
// own port against the database in DATABASE_URL and drives it over HTTP and Socket.IO.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import dotenv from 'dotenv';
import { io } from 'socket.io-client';

export const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));

dotenv.config({ path: `${PROJECT_ROOT}.env`, quiet: true });

// The tests create users, rooms and purchases. Never let them hit a hosted database by accident.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Point it at a local database to run the tests.');
  process.exit(1);
}
const databaseHost = new URL(databaseUrl).hostname;
if (!['localhost', '127.0.0.1', '::1'].includes(databaseHost) && process.env.ALLOW_REMOTE_TEST_DB !== '1') {
  console.error(`Refusing to run tests against ${databaseHost}: they write test data.`);
  console.error('Use a local database, or set ALLOW_REMOTE_TEST_DB=1 if this database is disposable.');
  process.exit(1);
}

// Collects PASS/FAIL lines instead of stopping at the first failure
export function createChecker() {
  const results = [];
  const check = (name, condition, detail = '') => {
    results.push(Boolean(condition));
    console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${!condition && detail ? `  —  ${detail}` : ''}`);
  };
  const failedCount = () => results.filter(ok => !ok).length;
  const printSummary = () => {
    console.log(`\n${results.length - failedCount()}/${results.length} checks passed`);
  };
  return { check, failedCount, printSummary };
}

export async function startServer({ port, env = {} }) {
  let log = '';
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { log += chunk; });
  child.stderr.on('data', chunk => { log += chunk; });

  const server = {
    url: `http://localhost:${port}`,
    logs: () => log,
    async stop() {
      if (child.exitCode !== null) return;
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill('SIGTERM');
      await exited;
    },
  };

  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      if ((await fetch(`${server.url}/api/health`)).ok) return server;
    } catch {
      // not listening yet
    }
    await delay(250);
  }
  await server.stop();
  throw new Error(`Server on port ${port} did not start:\n${log}`);
}

// A browser stand-in: keeps its own cookie jar and an optional Socket.IO connection
export class TestClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = new Map();
    this.events = [];
    this.state = null;
    this.socket = null;
  }

  cookieHeader() {
    return [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; ');
  }

  async req(method, path, body) {
    const res = await fetch(this.baseUrl + path, {
      method,
      headers: { 'content-type': 'application/json', cookie: this.cookieHeader() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookies = res.headers.getSetCookie();
    for (const header of setCookies) {
      const [pair] = header.split(';');
      const index = pair.indexOf('=');
      const key = pair.slice(0, index);
      const value = pair.slice(index + 1);
      if (!value || /Expires=Thu, 01 Jan 1970/i.test(header)) this.cookies.delete(key);
      else this.cookies.set(key, value);
    }
    return { status: res.status, data: await res.json().catch(() => null), setCookies };
  }

  async connect() {
    this.socket = io(this.baseUrl, {
      transports: ['websocket'],
      extraHeaders: { cookie: this.cookieHeader() },
      reconnection: false,
      forceNew: true,
    });
    this.socket.onAny((event, payload) => {
      this.events.push({ event, payload });
      if (event === 'room:state') this.state = payload;
    });
    await new Promise((resolve, reject) => {
      this.socket.once('connect', resolve);
      this.socket.once('connect_error', reject);
    });
  }

  emit(event, payload) {
    return this.socket.timeout(8000).emitWithAck(event, payload);
  }

  async join(roomId) {
    const res = await this.emit('room:join', { roomId });
    if (res.ok) this.state = res.state;
    return res;
  }

  // Messages pushed to this client since it connected
  messages() {
    return this.events.filter(e => e.event === 'chat:message').map(e => e.payload);
  }

  async waitFor(predicate, timeoutMs, label) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (predicate()) return;
      await delay(100);
    }
    throw new Error(`Timed out waiting for: ${label}`);
  }

  disconnect() {
    this.socket?.disconnect();
  }
}
