import { useCallback, useEffect, useRef, useState } from 'react';
import { PLAYERS_BY_ID, TEAMS_BY_ID } from '../lib/catalog';
import { ROLE_META } from '../lib/format';
import { useLocalSetting } from './useLocalSetting';

const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

// "2 crore 40 lakh", "75 lakh"
export function priceForSpeech(crores) {
  const lakhsTotal = Math.round((crores || 0) * 100);
  const crore = Math.floor(lakhsTotal / 100);
  const lakh = lakhsTotal % 100;
  const parts = [];
  if (crore) parts.push(`${crore} crore`);
  if (lakh) parts.push(`${lakh} lakh`);
  return parts.join(' ') || 'zero';
}

// Natural-sounding English voices first; Indian English voices are preferred
const PREFERRED = ['rishi', 'neerja', 'heera', 'ravi', 'google uk english male', 'daniel', 'google us english', 'samantha', 'david'];

function pickVoices() {
  const english = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
  const ranked = [...english].sort((a, b) => {
    const rank = (v) => {
      const i = PREFERRED.findIndex(p => v.name.toLowerCase().includes(p));
      return i === -1 ? PREFERRED.length + (v.lang === 'en-IN' ? -0.5 : 0) : i;
    };
    return rank(a) - rank(b);
  });
  return ranked.slice(0, 8);
}

const shortVoiceName = (voice) =>
  voice.name.replace(/Microsoft|Google|Desktop|Online|\(Natural\)/g, '').replace(/\s+/g, ' ').trim() + ` (${voice.lang})`;

const BID_LINES = [
  (price, team) => `${price}, ${team}.`,
  (price, team) => `${team} go to ${price}.`,
  (price, team) => `${price} with ${team}.`,
  (price, team) => `${team}, ${price}. Any advance?`,
];

// The voice auctioneer: announces each lot, every raise, and the hammer.
// Settings live in this browser only.
export function useAuctioneer({ live, roomStatus }) {
  const [enabled, setEnabled] = useLocalSetting('voice.enabled', true);
  const [rate, setRate] = useLocalSetting('voice.rate', 1.1);
  const [pitch, setPitch] = useLocalSetting('voice.pitch', 1);
  const [voiceName, setVoiceName] = useLocalSetting('voice.name', '');
  // Some browsers have the voice list ready at once, others announce it later
  const [voices, setVoices] = useState(() => (speechSupported ? pickVoices() : []));
  const spoken = useRef({ playerId: null, bid: 0, status: null });

  useEffect(() => {
    if (!speechSupported) return;
    const load = () => setVoices(pickVoices());
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback((text) => {
    if (!speechSupported || !enabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = voices.find(v => v.name === voiceName) ?? voices[0];
    if (voice) utterance.voice = voice;
    utterance.rate = rate;
    utterance.pitch = pitch;
    window.speechSynthesis.speak(utterance);
  }, [enabled, voices, voiceName, rate, pitch]);

  useEffect(() => {
    if (roomStatus !== 'active' || !live) return;
    const player = PLAYERS_BY_ID.get(live.playerId);
    if (!player) return;
    const teamName = TEAMS_BY_ID.get(live.highBidderTeamId)?.name ?? 'the room';
    const last = spoken.current;

    if (live.status === 'bidding') {
      if (last.playerId !== live.playerId) {
        spoken.current = { playerId: live.playerId, bid: 0, status: 'bidding' };
        speak(`Next up, ${player.name}. ${ROLE_META[player.role]?.label ?? player.role}. Base price ${priceForSpeech(player.basePrice)}.`);
      } else if (live.currentBid > last.bid) {
        spoken.current = { ...last, bid: live.currentBid, status: 'bidding' };
        const line = BID_LINES[Math.floor(Math.random() * BID_LINES.length)];
        speak(line(priceForSpeech(live.currentBid), teamName));
      }
    } else if (live.status !== last.status) {
      spoken.current = { ...last, playerId: live.playerId, status: live.status };
      if (live.status === 'sold') speak(`Sold! ${player.name} to ${teamName} for ${priceForSpeech(live.currentBid)}.`);
      if (live.status === 'unsold') speak(`${player.name} goes unsold.`);
    }
  }, [live, roomStatus, speak]);

  return {
    supported: speechSupported,
    enabled, setEnabled,
    rate, setRate,
    pitch, setPitch,
    voiceName: voiceName || voices[0]?.name || '',
    setVoiceName,
    voices: voices.map(v => ({ name: v.name, label: shortVoiceName(v) })),
    preview: () => speak('Welcome to Auction Arena. Bidding opens at two crore.'),
  };
}
