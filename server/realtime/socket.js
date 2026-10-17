import { Server } from 'socket.io';
import { ACCESS_COOKIE, readAccessToken } from '../auth/tokens.js';
import { parseCookieHeader } from '../auth/middleware.js';
import { HttpError } from '../validation.js';
import * as rooms from './roomManager.js';

export function createSocketServer(httpServer) {
  // The React app is served from the same origin, so no CORS configuration is needed
  const io = new Server(httpServer, { serveClient: false });
  rooms.attachIo(io);

  // Authenticate the handshake with the same httpOnly access-token cookie the API uses
  io.use((socket, next) => {
    const cookies = parseCookieHeader(socket.handshake.headers.cookie);
    const user = readAccessToken(cookies[ACCESS_COOKIE]);
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = user;
    socket.data.rooms = new Set();
    next();
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;
    socket.join(rooms.userChannel(user.id));

    // Every event replies through its ack: { ok: true, ...result } or { error, code }
    const handle = (event, handler) => {
      socket.on(event, async (payload, ack) => {
        const reply = typeof ack === 'function' ? ack : () => {};
        try {
          reply({ ok: true, ...(await handler(payload ?? {})) });
        } catch (err) {
          if (!err.status) console.error(`[socket] ${event} failed`, err);
          reply({ error: err.status ? err.message : 'Something went wrong', code: err.code });
        }
      });
    };

    const loadRoom = async (roomId) => {
      const rt = await rooms.getRuntime(String(roomId || '').trim().toUpperCase());
      if (!rt) throw new HttpError(404, 'Room not found!');
      return rt;
    };

    // Subscribes this connection to the room's live state
    handle('room:join', async ({ roomId }) => {
      const rt = await loadRoom(roomId);
      if (rt.room.bannedUserIds.includes(user.id)) {
        throw new HttpError(403, 'You have been kicked from this room and cannot rejoin.', 'kicked');
      }
      if (!socket.data.rooms.has(rt.room.id)) {
        socket.data.rooms.add(rt.room.id);
        socket.join(rooms.roomChannel(rt.room.id));
        rooms.addPresence(rt, user.id);
      }
      return { state: rooms.getSnapshot(rt) };
    });

    handle('room:leave', async ({ roomId }) => {
      const rt = await loadRoom(roomId);
      if (socket.data.rooms.delete(rt.room.id)) {
        socket.leave(rooms.roomChannel(rt.room.id));
        rooms.removePresence(rt, user.id);
      }
    });

    handle('team:select', async ({ roomId, teamId }) => rooms.selectTeam(await loadRoom(roomId), user.id, teamId));

    socket.on('disconnect', () => {
      for (const roomId of socket.data.rooms) {
        const rt = rooms.getCachedRuntime(roomId);
        if (rt) rooms.removePresence(rt, user.id);
      }
    });
  });

  return io;
}
