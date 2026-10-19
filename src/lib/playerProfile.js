import { PLAYER_PROFILES } from '../data/playerProfiles.js';

// A player's playing profile (see data/playerProfiles.js). Fields we don't know
// are null. Where the profile doesn't say, the auction set still tells pace from
// spin (FA sets are fast bowlers, SP sets spinners) and a long enough career
// strike rate tells the batting style.
const PACE = ['RF', 'LF'];
const SPIN = ['OB', 'LB', 'SLA', 'LWS'];
const BAT_STYLES = { agg: 'aggressive', bal: 'balanced', anc: 'anchor' };
const known = (field) => (field === '?' || field === undefined ? null : field);

function styleFromStats(player, order) {
  const { runs, sr } = player.stats || {};
  if (player.role === 'Bowler' || order === 'tail' || typeof sr !== 'number' || !(runs >= 500)) return null;
  return sr >= 150 ? 'aggressive' : sr < 133 ? 'anchor' : 'balanced';
}

export function profileOf(player) {
  const [bat, order, bowl, phases, batStyle] = (PLAYER_PROFILES[player.id] || '').split(' ').map(known);
  const style = bowl === '-' ? null : bowl;
  const setKind = player.set.match(/^U?(FA|SP)\d/)?.[1];
  const kind = PACE.includes(style) || setKind === 'FA' ? 'pace' : SPIN.includes(style) || setKind === 'SP' ? 'spin' : null;
  return {
    bat,
    order: order ?? (player.role === 'Bowler' ? 'tail' : null),
    // aggressive | balanced | anchor | null
    batStyle: BAT_STYLES[batStyle] ?? styleFromStats(player, order),
    style,
    // pace | spin | null; 'none' when we know the player doesn't bowl
    bowling: bowl === '-' ? 'none' : kind,
    leftArm: style ? ['LF', 'SLA', 'LWS'].includes(style) : null,
    phases: phases === '-' ? [] : phases ? phases.split(',') : null,
  };
}

const STYLE_LABELS = {
  RF: 'Right-arm pace',
  LF: 'Left-arm pace',
  OB: 'Off-spin',
  LB: 'Leg-spin',
  SLA: 'Left-arm spin',
  LWS: 'Left-arm wrist spin',
};
const ORDER_LABELS = { open: 'Opener', top: 'Top order', middle: 'Middle order', finish: 'Finisher' };
const PHASE_LABELS = { pp: 'Powerplay', mid: 'Middle overs', death: 'Death' };

// Short lines for the player card, e.g. ['Left-hand bat · Opener · Aggressive', 'Left-arm spin · Middle overs']
export function profileLines(player) {
  const p = profileOf(player);
  const lines = [];
  const batting = [
    p.bat && `${p.bat === 'L' ? 'Left' : 'Right'}-hand bat`,
    ORDER_LABELS[p.order],
    p.batStyle && p.batStyle[0].toUpperCase() + p.batStyle.slice(1),
  ].filter(Boolean);
  if (batting.length && player.role !== 'Bowler') lines.push(batting.join(' · '));
  if (p.style && player.role !== 'Batsman' && player.role !== 'Wicket-Keeper') {
    const phases = (p.phases || []).map(ph => PHASE_LABELS[ph]).join(', ');
    lines.push([STYLE_LABELS[p.style], phases].filter(Boolean).join(' · '));
  }
  return lines;
}

const ORDER_WORDS = { open: 'opener', top: 'top order', middle: 'middle order', finish: 'finisher', tail: 'tail' };
const PHASE_WORDS = { pp: 'powerplay', mid: 'middle overs', death: 'death' };

// The profile in plain words for the AI rankings; null means unknown
export function profileFacts(player) {
  const p = profileOf(player);
  return {
    battingHand: p.bat === 'L' ? 'left' : p.bat === 'R' ? 'right' : null,
    battingPosition: ORDER_WORDS[p.order] ?? null,
    battingStyle: p.batStyle,
    bowlingStyle: p.bowling === 'none' ? 'does not bowl' : p.style ? STYLE_LABELS[p.style].toLowerCase() : p.bowling,
    bowlingPhases: p.phases ? p.phases.map(ph => PHASE_WORDS[ph]) : null,
  };
}
