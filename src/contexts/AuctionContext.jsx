import React, { useCallback, useState } from 'react';
import { api } from '../lib/api';
import { connectSocket, emitWithAck, getServerTime, getSocket } from '../lib/socket';
import { AuctionContext } from '../hooks/useAuction';
import { useAuth } from '../hooks/useAuth';

// The server owns every room. This context mirrors the room state it pushes over
// Socket.IO and forwards the user's actions to it.
export const AuctionProvider = ({ children }) => {
  const { user } = useAuth();
  const [currentAuction, setCurrentAuction] = useState(null);
  const [roomTeams, setRoomTeams] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  // Why the last room subscription failed (e.g. "Room not found!"), or null
  const [roomError, setRoomError] = useState(null);
  // Every raise on the lot currently under the hammer, newest last
  const [bidTrail, setBidTrail] = useState([]);

  const team = user ? roomTeams.find(t => t.userId === user.uid) || null : null;

  const getSyncedTime = useCallback(() => getServerTime(), []);

  const createRoom = useCallback(async ({ teamId, auctionType = 'mega', isPublic = false, quickPool = false, rotateUnsold = true, hideUpcoming = false, bidTimer, overseasLimit }) => {
    const { id } = await api('/api/rooms', { method: 'POST', body: { teamId, auctionType, isPublic, quickPool, rotateUnsold, hideUpcoming, bidTimer, overseasLimit } });
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

      // The server sends whole states, so the trail is built from each new high bid
      const live = room.currentAuction;
      setBidTrail(trail => {
        if (!live) return [];
        const sameLot = trail.length > 0 && trail[0].playerId === live.playerId;
        const kept = sameLot ? trail : [];
        const last = kept[kept.length - 1];
        if (!live.currentBid || (last && last.amount >= live.currentBid)) return kept;
        const entry = {
          playerId: live.playerId,
          amount: live.currentBid,
          teamId: live.highBidderTeamId,
          bidderId: live.highBidderId,
          bidderName: live.highBidderName,
          at: Date.now(),
        };
        return [...kept, entry].slice(-30);
      });
    };

    const onMessage = (message) => {
      if (!active || message.roomId !== normalizedId) return;
      setMessages(prev => (prev.some(m => m.id === message.id) ? prev : [...prev, message]));
    };

    // The host removed this user: the room page shows why instead of the lobby
    const onKicked = ({ roomId: kickedFrom }) => {
      if (!active || kickedFrom !== normalizedId) return;
      setRoomError({ message: 'You were removed from this room.', code: 'kicked' });
      setCurrentAuction(null);
      setRoomTeams([]);
      setMessages([]);
    };

    // Runs on first connect and again after every reconnect
    const join = () => {
      socket.emit('room:join', { roomId: normalizedId }, (res) => {
        if (!active) return;
        if (res?.error) {
          setRoomError({ message: res.error, code: res.code });
        } else {
          applyState(res.state);
          // Keep any message that arrived while the history was loading
          setMessages(prev => {
            const historyIds = new Set(res.messages.map(m => m.id));
            return [...res.messages, ...prev.filter(m => !historyIds.has(m.id))];
          });
        }
        setLoading(false);
      });
    };

    socket.on('room:state', applyState);
    socket.on('chat:message', onMessage);
    socket.on('room:kicked', onKicked);
    socket.on('connect', join);
    if (socket.connected) join();
    else connectSocket();

    return () => {
      active = false;
      socket.off('room:state', applyState);
      socket.off('chat:message', onMessage);
      socket.off('room:kicked', onKicked);
      socket.off('connect', join);
      if (socket.connected) socket.emit('room:leave', { roomId: normalizedId });
      setCurrentAuction(null);
      setRoomTeams([]);
      setMessages([]);
      setBidTrail([]);
    };
  }, []);

  const selectTeam = useCallback(
    (roomId, teamId) => emitWithAck('team:select', { roomId, teamId }),
    []
  );

  // Without a teamId: a bot for every open franchise
  const addBots = useCallback(
    (roomId, teamId) => emitWithAck('bots:add', { roomId, teamId }),
    []
  );

  // Without a teamId: every bot leaves
  const removeBots = useCallback(
    (roomId, teamId) => emitWithAck('bots:remove', { roomId, teamId }),
    []
  );

  const startAuction = useCallback(
    (roomId) => emitWithAck('auction:start', { roomId }),
    []
  );

  // amount is the price shown on the bid button; the server rejects it if the price has moved
  const placeBid = useCallback(async (amount) => {
    if (!currentAuction) throw new Error('Auction not found!');
    await emitWithAck('bid:place', { roomId: currentAuction.id, amount });
  }, [currentAuction]);

  const pauseAuction = useCallback(
    (roomId) => emitWithAck('auction:pause', { roomId }),
    []
  );

  const resumeAuction = useCallback(
    (roomId) => emitWithAck('auction:resume', { roomId }),
    []
  );

  const endAuction = useCallback(
    (roomId) => emitWithAck('auction:end', { roomId }),
    []
  );

  // settings: { bidTimer?, isPublic?, quickPool?, rotateUnsold?, hideUpcoming?, overseasLimit? } — anything left out keeps its current value
  const updateRoomSettings = useCallback(
    (roomId, settings) => emitWithAck('settings:update', { roomId, ...settings }),
    []
  );

  const kickPlayer = useCallback(
    (roomId, player) => emitWithAck('member:kick', { roomId, userId: player.id }),
    []
  );

  const sendMessage = useCallback(
    (roomId, text, type = 'text') => emitWithAck('chat:send', { roomId, text, type }),
    []
  );

  const value = {
    currentAuction,
    team,
    roomTeams,
    loading,
    roomError,
    messages,
    bidTrail,
    getSyncedTime,
    createRoom,
    joinRoom,
    joinAuction,
    selectTeam,
    addBots,
    removeBots,
    startAuction,
    placeBid,
    pauseAuction,
    resumeAuction,
    endAuction,
    updateRoomSettings,
    kickPlayer,
    sendMessage,
  };

  return (
    <AuctionContext.Provider value={value}>
      {children}
    </AuctionContext.Provider>
  );
};
