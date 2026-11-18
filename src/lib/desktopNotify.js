// Native notifications in the desktop app, sent to its main process, which shows them only
// while the window isn't in front. It shows one at a time (each replaces the last), so chat
// waits its turn: at most one chat notification every few seconds, gathering what arrives in
// between, and never covering an outbid notification still being read.
export const chatTiming = {
  gapMs: 5000, // between chat notifications
  holdMs: 8000, // chat stays quiet this long after an outbid notification
};

const desktopApp = () => (typeof window === 'undefined' ? undefined : window.auctionArenaDesktop);

let importantAt = -Infinity;
let chatAt = -Infinity;
let chatTimer = null;
let waiting = [];

// Something to act on, like being outbid: shown straight away
export function notifyDesktop(title, body) {
  if (typeof desktopApp()?.notify !== 'function') return;
  importantAt = Date.now();
  desktopApp().notify(title, body);
}

function showChat() {
  chatTimer = null;
  const held = Math.max(importantAt + chatTiming.holdMs, chatAt + chatTiming.gapMs) - Date.now();
  if (held > 0) {
    chatTimer = setTimeout(showChat, held); // an outbid came in while this waited
    return;
  }
  const batch = waiting;
  waiting = [];
  if (batch.length === 0) return;
  chatAt = Date.now();
  const latest = batch[batch.length - 1];
  const line = latest.type === 'gif' ? 'sent a GIF' : latest.text;
  if (batch.length === 1) desktopApp().notify(`${latest.userName} in the room chat`, line);
  else desktopApp().notify(`${batch.length} new messages in the room chat`, `${latest.userName}: ${line}`);
}

// Someone else's chat message (text or GIF) arrived
export function notifyChat({ userName, text, type }) {
  if (typeof desktopApp()?.notify !== 'function') return;
  waiting.push({ userName, text, type });
  if (!chatTimer) chatTimer = setTimeout(showChat, 0);
}

// Leaving the room: messages still waiting are no longer news
export function clearChatNotifications() {
  clearTimeout(chatTimer);
  chatTimer = null;
  waiting = [];
}
