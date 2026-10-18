import { useCallback, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { TEAMS_BY_ID } from '../lib/catalog';
import { useLocalSetting } from './useLocalSetting';

const ANTHEMS = {
  MI: '/MI.mpeg', CSK: '/CSK.mpeg', RCB: '/RCB.mpeg', KKR: '/KKR.mpeg', DC: '/DC.mpeg',
  PBKS: '/PBKS.mpeg', RR: '/RR.mpeg', SRH: '/SRH.mpeg', GT: '/GT.mp3', LSG: '/LSG.mp3',
};
const UNSOLD_STINGS = ['/unsold-boom.mpeg', '/unsold-brass.mp3', '/unsold-chant.mp3', '/unsold-sting.mp3'];

// Countdown beeps, the buying team's anthem and confetti in its colours, and an
// unsold sting. One AudioContext and one <audio> element are reused for the visit.
export function useRoomSounds({ live, timeLeft }) {
  const [effects, setEffects] = useLocalSetting('sound.effects', true);
  const [anthems, setAnthems] = useLocalSetting('sound.anthems', true);
  const audioCtx = useRef(null);
  const player = useRef(null);
  const lastBeep = useRef(null);

  // Browsers only allow sound after the first tap or click
  useEffect(() => {
    const unlock = () => {
      audioCtx.current ??= new (window.AudioContext || window.webkitAudioContext)();
      player.current ??= new Audio();
      audioCtx.current.resume?.();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      player.current?.pause();
      audioCtx.current?.close?.();
    };
  }, []);

  const beep = useCallback((freq = 520, duration = 0.09, volume = 0.08) => {
    const ctx = audioCtx.current;
    if (!effects || !ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }, [effects]);

  // Last five seconds tick, the final one higher
  useEffect(() => {
    if (live?.status !== 'bidding' || timeLeft > 5 || timeLeft <= 0) return;
    const key = `${live.timerEndsAt}:${timeLeft}`;
    if (lastBeep.current === key) return;
    lastBeep.current = key;
    beep(timeLeft === 1 ? 940 : 560);
  }, [live?.status, live?.timerEndsAt, timeLeft, beep]);

  // The hammer: anthem + confetti for a sale, a sting for unsold
  const status = live?.status;
  const buyer = live?.highBidderTeamId;
  useEffect(() => {
    const audio = player.current;
    let frame;
    if (status === 'sold') {
      const team = TEAMS_BY_ID.get(buyer);
      const colors = team ? [team.colors.primary, team.colors.secondary, '#ffffff'] : ['#22d3ee', '#a3e635', '#ffffff'];
      const until = Date.now() + 2200;
      const burst = () => {
        confetti({ particleCount: 3, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors, ticks: 220 });
        confetti({ particleCount: 3, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors, ticks: 220 });
        if (Date.now() < until) frame = requestAnimationFrame(burst);
      };
      burst();
      if (anthems && audio && ANTHEMS[buyer]) {
        audio.src = ANTHEMS[buyer];
        audio.volume = 0.4;
        audio.play().catch(() => {});
      }
    } else if (status === 'unsold' && anthems && audio) {
      audio.src = UNSOLD_STINGS[Math.floor(Math.random() * UNSOLD_STINGS.length)];
      audio.volume = 0.45;
      audio.play().catch(() => {});
    }
    return () => {
      if (frame) cancelAnimationFrame(frame);
      audio?.pause();
    };
  }, [status, buyer, anthems]);

  return { effects, setEffects, anthems, setAnthems, beep };
}
