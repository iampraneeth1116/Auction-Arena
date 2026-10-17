import React, { useCallback, useState } from 'react';
import { api } from '../lib/api';
import { connectSocket, emitWithAck, getSocket } from '../lib/socket';
import { AuctionContext } from '../hooks/useAuction';
import { useAuth } from '../hooks/useAuth';

// The server owns every room. This context mirrors the room state it pushes over
// Socket.IO and forwards the user's actions to it.
export const AuctionProvider = ({ children }) => {
  const { user } = useAuth();
  const [currentAuction, setCurrentAuction] = useState(null);
  const [roomTeams, setRoomTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  // Why the last room subscription failed (e.g. "Room not found!"), or null
  const [roomError, setRoomError] = useState(null);

  const team = user ? roomTeams.find(t => t.userId === user.uid) || null : null;

  const createRoom = useCallback(async ({ teamId, auctionType = 'mega' }) => {
    const { id } = await api('/api/rooms', { method: 'POST', body: { teamId, auctionType } });
    return id;
  }, []);

  // Becomes a member of the room, optionally claiming a franchise in the same step
  const joinRoom = useCallback(async (roomId, { teamId } = {}) => {
    const { id } = await api(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
      method: 'POST',
      body: teamId ? { teamId } : {},
    });
    return id;
  }, []);

  // Subscribe to a room's live state; returns the unsubscribe function
  const joinAuction = useCallback((roomId) => {
    if (!roomId) return () => {};
    const normalizedId = roomId.toUpperCase();
    const socket = getSocket();
    let active = true;
    setLoading(true);
    setRoomError(null);

    const applyState = (state) => {
      if (!active || state.id !== normalizedId) return;
      const { teams, ...room } = state;
      setCurrentAuction(room);
      setRoomTeams(teams);
    };

    // Runs on first connect and again after every reconnect
    const join = () => {
      socket.emit('room:join', { roomId: normalizedId }, (res) => {
        if (!active) return;
        if (res?.error) {
          setRoomError({ message: res.error, code: res.code });
        } else {
          applyState(res.state);
        }
        setLoading(false);
      });
    };

    socket.on('room:state', applyState);
    socket.on('connect', join);
    if (socket.connected) join();
    else connectSocket();

    return () => {
      active = false;
      socket.off('room:state', applyState);
      socket.off('connect', join);
      if (socket.connected) socket.emit('room:leave', { roomId: normalizedId });
      setCurrentAuction(null);
      setRoomTeams([]);
    };
  }, []);

  const selectTeam = useCallback(
    (roomId, teamId) => emitWithAck('team:select', { roomId, teamId }),
    []
  );

  const value = {
    currentAuction,
    team,
    roomTeams,
    loading,
    roomError,
    createRoom,
    joinRoom,
    joinAuction,
    selectTeam,
  };

  return (
    <AuctionContext.Provider value={value}>
      {children}
    </AuctionContext.Provider>
  );
};
