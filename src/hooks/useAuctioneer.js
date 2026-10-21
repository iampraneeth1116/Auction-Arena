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

// A bid is said the way an auctioneer calls it, "16 crore 25, Bengaluru": price first and
// short, because people can raise every second and a long line falls behind the room
export function bidPriceForSpeech(crores) {
  const lakhsTotal = Math.round((crores || 0) * 100);
  const crore = Math.floor(lakhsTotal / 100);
  const lakh = lakhsTotal % 100;
  if (!crore) return `${lakh} lakh`;
  return lakh ? `${crore} crore ${lakh}` : `${crore} crore`;
}

const SPOKEN_TEAMS = {
  MI: 'Mumbai', CSK: 'Chennai', RCB: 'Bengaluru', KKR: 'Kolkata', DC: 'Delhi',
  PBKS: 'Punjab', RR: 'Rajasthan', SRH: 'Hyderabad', GT: 'Gujarat', LSG: 'Lucknow',
};

// Bids are said a little faster than other lines
const BID_PACE = 1.15;

// Where the word at the end of `part` starts in `text`: once the voice reaches that
// word, the part that matters (the price, the player's name) has been heard
const lastWordOf = (text, part) => text.lastIndexOf(' ', text.indexOf(part) + part.length - 1) + 1;

// Says lines one at a time. A newer bid replaces a bid still waiting its turn, so the voice
// jumps to the latest price, and the next lot, sold and unsold are always said. A line may
// be cut short by a newer one, but only after its key part has been said (cancelling every
// line outright left only fragments; never cancelling let the voice fall seconds behind).
function createSpeechQueue() {
  let current = null;
  let waiting = [];
  let voiceOptions = {};

  function playNext() {
    current = null;
    const line = waiting.shift();
    if (!line) return;
    const rate = voiceOptions.rate * (line.bid ? BID_PACE : 1);
    const utterance = new SpeechSynthesisUtterance(line.text);
    if (voiceOptions.voice) utterance.voice = voiceOptions.voice;
    utterance.rate = rate;
    utterance.pitch = voiceOptions.pitch;
    const state = { utterance, cuttable: false };
    let cutTimer;
    const allowCut = () => {
      state.cuttable = true;
      if (waiting.length) window.speechSynthesis.cancel();
    };
    if (line.keyEndsAt != null) {
      // Most voices report each word as they reach it: the line can be cut a moment after
      // the key part's last word starts. A voice that reports nothing gets a timed guess.
      cutTimer = setTimeout(allowCut, 1800 / rate);
      utterance.onboundary = (event) => {
        clearTimeout(cutTimer);
        if (event.charIndex < line.keyEndsAt) {
          cutTimer = setTimeout(allowCut, 2500 / rate);
          return;
        }
        utterance.onboundary = null;
        cutTimer = setTimeout(allowCut, 700 / rate);
      };
    }
    const finish = () => {
      clearTimeout(watchdog);
      clearTimeout(cutTimer);
      if (current === state) playNext();
    };
    // If the browser never reports the end, move on rather than going quiet for good
    const watchdog = setTimeout(() => {
      if (current !== state) return;
      window.speechSynthesis.cancel();
      finish();
    }, 5000 + line.text.length * 120);
    utterance.onend = finish;
    utterance.onerror = finish;
    current = state;
    window.speechSynthesis.speak(utterance);
  }

  return {
    setVoiceOptions(next) {
      voiceOptions = next;
    },
    // keyEndsAt: where the last word of the part that must be heard starts; leave it out
    // for a line that's never cut short
    say(text, { bid = false, keyEndsAt = null } = {}) {
      if (bid) waiting = waiting.filter(line => !line.bid);
      waiting.push({ text, bid, keyEndsAt });
      if (!current) playNext();
      else if (current.cuttable) window.speechSynthesis.cancel();
    },
    stop() {
      waiting = [];
      current = null;
      window.speechSynthesis.cancel();
    },
  };
}

// The voice auctioneer: announces each lot, every raise, and the hammer.
// Settings live in this browser only.
export function useAuctioneer({ live, roomStatus }) {
  const [enabled, setEnabled] = useLocalSetting('voice.enabled', true);
  const [rate, setRate] = useLocalSetting('voice.rate', 1.1);
  const [pitch, setPitch] = useLocalSetting('voice.pitch', 1);
  const [voiceName, setVoiceName] = useLocalSetting('voice.name', '');
  // Some browsers have the voice list ready at once, others announce it later
  const [voices, setVoices] = useState(() => (speechSupported ? pickVoices() : []));
  const [queue] = useState(() => (speechSupported ? createSpeechQueue() : null));
  const spoken = useRef({ playerId: null, bid: 0, status: null });

  useEffect(() => {
    queue?.setVoiceOptions({ voice: voices.find(v => v.name === voiceName) ?? voices[0], rate, pitch });
  }, [queue, voices, voiceName, rate, pitch]);

  useEffect(() => {
    if (!queue) return;
    const load = () => setVoices(pickVoices());
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      queue.stop();
    };
  }, [queue]);

  // Turning the voice off stops it at once, not after the lines already waiting
  useEffect(() => {
    if (!enabled) queue?.stop();
  }, [enabled, queue]);

  const speak = useCallback((text, options) => {
    if (queue && enabled) queue.say(text, options);
  }, [queue, enabled]);

  useEffect(() => {
    if (roomStatus !== 'active' || !live) return;
    const player = PLAYERS_BY_ID.get(live.playerId);
    if (!player) return;
    const teamName = TEAMS_BY_ID.get(live.highBidderTeamId)?.name ?? 'the room';
    const last = spoken.current;

    if (live.status === 'bidding') {
      if (last.playerId !== live.playerId) {
        spoken.current = { playerId: live.playerId, bid: 0, status: 'bidding' };
        // An early bid may cut the role and base price, never the name
        const text = `Next up, ${player.name}. ${ROLE_META[player.role]?.label ?? player.role}. Base price ${priceForSpeech(player.basePrice)}.`;
        speak(text, { keyEndsAt: lastWordOf(text, player.name) });
      } else if (live.currentBid > last.bid) {
        spoken.current = { ...last, bid: live.currentBid, status: 'bidding' };
        const price = bidPriceForSpeech(live.currentBid);
        const team = SPOKEN_TEAMS[live.highBidderTeamId] ?? teamName;
        speak(`${price}, ${team}.`, { bid: true, keyEndsAt: lastWordOf(`${price}, ${team}.`, price) });
      }
    } else if (live.status !== last.status) {
      spoken.current = { ...last, playerId: live.playerId, status: live.status };
      if (live.status === 'sold') speak(`Sold! ${player.name} to ${teamName} for ${priceForSpeech(live.currentBid)}.`);
      if (live.status === 'unsold') speak(`${player.name} goes unsold.`);
      if (live.status === 'paused') speak('The auction is paused.');
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
    preview: () => {
      if (!queue || !enabled) return;
      queue.stop();
      queue.say('Welcome to Auction Arena. Bidding opens at two crore.');
    },
  };
}
