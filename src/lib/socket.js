import { io } from 'socket.io-client';
import { refreshSession } from './api';

let socket = null;

export function getSocket() {
  if (socket) return socket;

  const created = io({ autoConnect: false, withCredentials: true });
  let refreshedForThisAttempt = false;

  created.on('connect', () => {
    refreshedForThisAttempt = false;
  });

  // A rejected handshake is not retried automatically: refresh the session once, then reconnect
  created.on('connect_error', async (err) => {
    if (err.message !== 'unauthorized' || refreshedForThisAttempt) return;
    refreshedForThisAttempt = true;
    if (await refreshSession()) created.connect();
  });

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
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

// Emits an event and resolves with the server's ack, or rejects with its error message
export function emitWithAck(event, payload = {}) {
  const activeSocket = connectSocket();
  return new Promise((resolve, reject) => {
    activeSocket.timeout(10000).emit(event, payload, (timeoutError, res) => {
      if (timeoutError) return reject(new Error('The server did not respond. Check your connection.'));
      if (res?.error) {
        const error = new Error(res.error);
        error.code = res.code;
        return reject(error);
      }
      resolve(res);
    });
  });
}
