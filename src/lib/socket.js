import { io } from 'socket.io-client';
import { renewSession } from './api';

// While connected, the app asks the server for the time every few seconds. The answers keep
// countdowns in step with the server, and an answer that never comes means the link died
// without closing (common on phones), so the app reconnects instead of freezing on old state.
const HEARTBEAT_MS = 3000;
const PROBE_TIMEOUT_MS = 3500;
const CLOCK_SAMPLES = 20;

let socket = null;
let teardown = null;
let clockOffset = 0;
let clockSamples = [];
// When anything last arrived from the server: a slow answer on a link that's still talking isn't a dead link
let lastHeardAt = 0;

// 'connecting' | 'connected' | 'reconnecting' | 'signed-out'
let status = 'connecting';
const statusListeners = new Set();

function setStatus(next) {
  if (status === next) return;
  status = next;
  statusListeners.forEach(listener => listener());
}

export const getConnectionStatus = () => status;

export function subscribeConnectionStatus(listener) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

// The server owns every deadline; this only keeps countdowns on screen in step with it
export const getServerTime = () => Date.now() + clockOffset;

function recordClockSample(sentAt, serverTime) {
  const receivedAt = Date.now();
  // Assume each trip took equally long both ways. The quickest trip leaves the least room for error.
  clockSamples = [...clockSamples, { roundTrip: receivedAt - sentAt, offset: serverTime - (sentAt + receivedAt) / 2 }]
    .slice(-CLOCK_SAMPLES);
  clockOffset = clockSamples.reduce((best, sample) => (sample.roundTrip < best.roundTrip ? sample : best)).offset;
}

// Drops a link that has stopped answering. Socket.IO then reconnects, and the room page
// rejoins and gets the room's current state.
function dropIfSilent(activeSocket) {
  if (socket === activeSocket && activeSocket.connected && Date.now() - lastHeardAt >= PROBE_TIMEOUT_MS) {
    activeSocket.io.engine?.close();
  }
}

export function getSocket() {
  if (socket) return socket;

  const created = io({
    autoConnect: false,
    withCredentials: true,
    // Straight onto a fresh WebSocket: after a dropped signal, polling can be handed one of the
    // browser's old pooled connections and hang. Networks that block WebSockets fall back to polling.
    transports: ['websocket', 'polling'],
    tryAllTransports: true,
    // A connection attempt that hangs is abandoned and tried again sooner than the default 20 s
    timeout: 8000,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
  });
  const heard = () => { lastHeardAt = Date.now(); };
  const timers = new Set();
  const later = (fn, ms) => {
    const timer = setTimeout(() => { timers.delete(timer); fn(); }, ms);
    timers.add(timer);
  };
  let heartbeat = null;

  const probe = () => {
    if (socket !== created || !created.connected) return;
    const sentAt = Date.now();
    created.timeout(PROBE_TIMEOUT_MS).emit('time:sync', {}, (err, res) => {
      if (err) return dropIfSilent(created);
      heard();
      if (res?.serverTime) recordClockSample(sentAt, res.serverTime);
    });
  };

  // A rejected handshake (the 15-minute login ran out) isn't retried by Socket.IO: renew the
  // login and connect again. While the network is still coming back, keep trying with growing gaps.
  let renewAttempts = 0;
  let renewPending = false;
  const renewThenConnect = () => {
    if (renewPending) return;
    renewPending = true;
    const wait = renewAttempts === 0 ? 0 : Math.min(1000 * 2 ** (renewAttempts - 1), 10000);
    renewAttempts++;
    later(async () => {
      const result = await renewSession();
      renewPending = false;
      if (socket !== created || created.connected) return;
      if (result === 'ok') created.connect();
      else if (result === 'invalid') setStatus('signed-out');
      else renewThenConnect();
    }, wait);
  };

  created.onAny(heard);
  created.io.on('ping', heard);

  created.on('connect', () => {
    heard();
    renewAttempts = 0;
    setStatus('connected');
    clearInterval(heartbeat);
    // A few quick samples first, so countdowns are right from the start
    probe();
    later(probe, 300);
    later(probe, 800);
    heartbeat = setInterval(probe, HEARTBEAT_MS);
  });

  created.on('disconnect', (reason) => {
    clearInterval(heartbeat);
    setStatus('reconnecting');
    // Socket.IO reconnects by itself after anything except a disconnect the server chose
    if (reason === 'io server disconnect') created.connect();
  });

  created.on('connect_error', (err) => {
    if (status === 'connected') setStatus('reconnecting');
    if (err.message === 'unauthorized') renewThenConnect();
  });

  // Back on the tab or the network: check the link now instead of at the next beat
  const recheck = () => {
    if (document.visibilityState === 'hidden') return;
    if (created.connected) probe();
    else if (status !== 'signed-out' && !created.active) {
      renewAttempts = 0;
      renewThenConnect();
    }
  };
  document.addEventListener('visibilitychange', recheck);
  window.addEventListener('online', recheck);

  teardown = () => {
    clearInterval(heartbeat);
    timers.forEach(clearTimeout);
    document.removeEventListener('visibilitychange', recheck);
    window.removeEventListener('online', recheck);
    created.io.off('ping', heard);
  };
  socket = created;
  return socket;
}

export function connectSocket() {
  const activeSocket = getSocket();
  if (!activeSocket.connected) activeSocket.connect();
  return activeSocket;
}

// Call after signing in or out so the next connection carries the new cookie
export function resetSocket() {
  if (!socket) return;
  teardown?.();
  teardown = null;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  setStatus('connecting');
}

// Emits an event and resolves with the server's ack, or rejects with its error message.
// Nothing is held back while offline: a bid that went out after a reconnect could reach a later player.
export function emitWithAck(event, payload = {}, { timeoutMs = 10000 } = {}) {
  const activeSocket = connectSocket();
  if (!activeSocket.connected) {
    return Promise.reject(new Error('Reconnecting to the auction. Try again in a moment.'));
  }
  return new Promise((resolve, reject) => {
    activeSocket.timeout(timeoutMs).emit(event, payload, (timeoutError, res) => {
      if (timeoutError) {
        dropIfSilent(activeSocket);
        return reject(new Error('The server did not respond. Check your connection.'));
      }
      if (res?.error) {
        const error = new Error(res.error);
        error.code = res.code;
        return reject(error);
      }
      resolve(res);
    });
  });
}
