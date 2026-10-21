import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Eye, ImagePlay, Loader2, MessageSquare, Search, Send, X } from 'lucide-react';
import { useAuction } from '../hooks/useAuction';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { TEAMS_BY_ID } from '../lib/catalog';
import { cn } from '../lib/cn';
import { buttonClasses } from './ui/styles';
import Spinner from './ui/Spinner';

const GIPHY_KEY = import.meta.env.VITE_GIPHY_API_KEY;
const MAX_LENGTH = 150;
// Messages from the same person closer together than this share one name line
const GROUP_GAP_MS = 3 * 60 * 1000;

// 16px on phones so iOS doesn't zoom into the field on focus
const fieldClasses =
  'w-full rounded-md border border-ink-500 bg-ink-900/70 text-base text-snow placeholder:text-haze transition-colors focus:border-signal focus:outline-none sm:text-sm';

const isChatMessage = (message) => !message.type || message.type === 'text' || message.type === 'gif';

const clockTime = (timestamp) =>
  timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';

const giphyEndpoint = (query) => {
  const params = new URLSearchParams({ api_key: GIPHY_KEY, limit: '24', rating: 'g' });
  if (query) params.set('q', query);
  return `https://api.giphy.com/v1/gifs/${query ? 'search' : 'trending'}?${params}`;
};

const toGif = (item) => {
  const url = item.images?.fixed_height?.url || item.images?.original?.url;
  const preview = item.images?.fixed_width_small?.url || item.images?.fixed_height_small?.url || url;
  return url ? { id: item.id, title: item.title || 'GIF', url, preview } : null;
};

// GIPHY search tray. It covers the message list while open and loads trending GIFs first.
const GifTray = ({ onPick, onClose, sendingId }) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState({ status: 'loading', query: '', gifs: [] });
  const latestRequest = useRef(null);
  const searchId = useId();

  const load = useCallback((search) => {
    latestRequest.current?.abort();
    const controller = new AbortController();
    latestRequest.current = controller;
    fetch(giphyEndpoint(search), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('GIPHY request failed');
        return res.json();
      })
      .then((json) => {
        setResult({ status: 'ready', query: search, gifs: (json?.data ?? []).map(toGif).filter(Boolean) });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setResult({ status: 'error', query: search, gifs: [] });
      });
    return controller;
  }, []);

  useEffect(() => {
    const controller = load('');
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const search = (e) => {
    e.preventDefault();
    setResult((prev) => ({ ...prev, status: 'loading' }));
    load(query.trim());
  };

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-ink-900/95 backdrop-blur-sm" role="dialog" aria-label="Send a GIF">
      <div className="flex items-center gap-1.5 border-b border-white/6 p-2">
        <form onSubmit={search} role="search" className="flex min-w-0 flex-1 items-center gap-1.5">
          <label htmlFor={searchId} className="sr-only">Search GIFs</label>
          <div className="relative min-w-0 flex-1">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-haze" aria-hidden />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search GIPHY"
              autoComplete="off"
              enterKeyHint="search"
              className={cn(fieldClasses, 'h-9 pl-8 pr-2')}
            />
          </div>
          <button type="submit" className={buttonClasses({ variant: 'outline', size: 'sm' })}>Search</button>
        </form>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close GIF picker"
          className="rounded-md p-2 text-haze transition-colors hover:bg-white/5 hover:text-snow cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin p-2">
        {result.status === 'loading' ? (
          <Spinner label="Loading GIFs" />
        ) : result.status === 'error' ? (
          <p className="px-2 py-8 text-center text-sm text-haze">GIPHY isn't answering right now. Try again in a moment.</p>
        ) : result.gifs.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-haze">No GIFs for “{result.query}”. Try another word.</p>
        ) : (
          <>
            <p className="mb-1.5 px-0.5 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-haze">
              {result.query ? `Results for “${result.query}”` : 'Trending now'}
            </p>
            <ul className="grid grid-cols-3 gap-1.5">
              {result.gifs.map((gif) => (
                <li key={gif.id}>
                  <button
                    type="button"
                    onClick={() => onPick(gif)}
                    disabled={Boolean(sendingId)}
                    aria-label={`Send GIF: ${gif.title}`}
                    className="relative block aspect-[4/3] w-full overflow-hidden rounded-md border border-white/6 bg-ink-800 transition-colors hover:border-signal disabled:cursor-default cursor-pointer"
                  >
                    <img src={gif.preview} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                    {sendingId === gif.id && (
                      <span className="absolute inset-0 flex items-center justify-center bg-ink-950/60">
                        <Loader2 size={18} className="animate-spin text-signal" />
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <p className="border-t border-white/6 px-3 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-haze">
        Powered by GIPHY
      </p>
    </div>
  );
};

// Room chat: a scrolling message list over a composer. Fills its parent's height.
const RoomChat = ({ roomId, canChat = true, className }) => {
  const { messages, sendMessage, currentAuction } = useAuction();
  const { user } = useAuth();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const [sendingGifId, setSendingGifId] = useState(null);
  const listRef = useRef(null);
  // Follow new messages only while the reader is at (or near) the bottom
  const followRef = useRef(true);
  const inputId = useId();

  const chat = messages.filter(isChatMessage);
  const teamByUser = new Map((currentAuction?.players ?? []).map((p) => [p.id, p.team]));
  const last = chat[chat.length - 1];
  const lastKey = last ? last.id ?? `${last.timestamp}:${chat.length}` : null;
  const lastIsMine = Boolean(last && user && last.userId === user.uid);

  // Scroll the list itself, never the page
  useEffect(() => {
    const list = listRef.current;
    if (!list || !lastKey) return;
    if (followRef.current || lastIsMine) {
      list.scrollTop = list.scrollHeight;
      followRef.current = true;
    }
  }, [lastKey, lastIsMine]);

  const handleScroll = (e) => {
    const list = e.currentTarget;
    followRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 64;
  };

  // A GIF changes the list height once it loads
  const keepFollowing = () => {
    const list = listRef.current;
    if (list && followRef.current) list.scrollTop = list.scrollHeight;
  };

  const closeTray = useCallback(() => setTrayOpen(false), []);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending || !roomId) return;
    setSending(true);
    try {
      await sendMessage(roomId, body, 'text');
      setText('');
    } catch (err) {
      // Keep the text so it can be sent again
      toast({ message: err.message || 'Message not sent. Try again.', tone: 'error' });
    } finally {
      setSending(false);
    }
  };

  const sendGif = async (gif) => {
    if (sendingGifId || !roomId) return;
    setSendingGifId(gif.id);
    try {
      await sendMessage(roomId, gif.url, 'gif');
      setTrayOpen(false);
    } catch (err) {
      toast({ message: err.message || 'GIF not sent. Try again.', tone: 'error' });
    } finally {
      setSendingGifId(null);
    }
  };

  const remaining = MAX_LENGTH - text.length;

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={handleScroll}
          role="log"
          aria-label="Room chat"
          className="h-full overflow-y-auto overscroll-contain scrollbar-thin px-3 py-3"
        >
          {chat.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <span className="flex size-10 items-center justify-center rounded-md border border-white/8 bg-ink-800 text-haze">
                <MessageSquare size={18} />
              </span>
              <p className="font-display text-sm font-semibold uppercase tracking-wider text-mist">No messages yet</p>
              <p className="text-xs text-haze">{canChat ? 'Say hello to the room.' : 'Messages from managers show up here.'}</p>
            </div>
          ) : (
            <ol className="flex flex-col">
              {chat.map((msg, index) => {
                const prev = chat[index - 1];
                const mine = Boolean(user && msg.userId === user.uid);
                const startsGroup = !prev || prev.userId !== msg.userId || msg.timestamp - prev.timestamp > GROUP_GAP_MS;
                const team = TEAMS_BY_ID.get(teamByUser.get(msg.userId));
                const isGif = msg.type === 'gif';

                return (
                  <li
                    key={msg.id ?? `${msg.timestamp}:${index}`}
                    className={cn('flex flex-col', mine ? 'items-end' : 'items-start', index > 0 && (startsGroup ? 'mt-3' : 'mt-1'))}
                  >
                    {startsGroup && (
                      <div className={cn('mb-1 flex max-w-full items-center gap-1.5 px-0.5 text-[11px]', mine && 'flex-row-reverse')}>
                        <span className="truncate font-semibold text-mist">{mine ? 'You' : msg.userName}</span>
                        {!mine && team && (
                          <span className="inline-flex h-4 shrink-0 items-center gap-1 rounded-sm bg-white/6 px-1 font-display text-[10px] font-semibold uppercase tracking-wider text-mist">
                            <span className="size-1.5 rounded-full" style={{ background: team.colors.primary }} aria-hidden />
                            {team.id}
                          </span>
                        )}
                        <span className="shrink-0 tabular text-haze">{clockTime(msg.timestamp)}</span>
                      </div>
                    )}
                    {isGif ? (
                      <img
                        src={msg.text}
                        alt={mine ? 'GIF you sent' : `GIF from ${msg.userName}`}
                        loading="lazy"
                        decoding="async"
                        onLoad={keepFollowing}
                        className="h-auto max-h-44 max-w-[80%] rounded-md border border-white/10 bg-ink-800"
                      />
                    ) : (
                      <p
                        className={cn(
                          'max-w-[85%] whitespace-pre-wrap break-words rounded-md px-3 py-1.5 text-sm leading-snug text-snow',
                          mine ? 'bg-signal/15 ring-1 ring-inset ring-signal/25' : 'border-l-2 border-ink-500 bg-ink-800',
                        )}
                        style={!mine && team ? { borderLeftColor: team.colors.primary } : undefined}
                      >
                        {msg.text}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {canChat && trayOpen && GIPHY_KEY && <GifTray onPick={sendGif} onClose={closeTray} sendingId={sendingGifId} />}
      </div>

      {canChat ? (
        <form onSubmit={send} className="flex items-center gap-1.5 border-t border-white/6 bg-ink-900/70 p-2">
          {GIPHY_KEY && (
            <button
              type="button"
              onClick={() => setTrayOpen((open) => !open)}
              aria-label={trayOpen ? 'Close GIF picker' : 'Send a GIF'}
              aria-expanded={trayOpen}
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer',
                trayOpen ? 'border-signal bg-signal/15 text-signal' : 'border-ink-500 text-haze hover:border-signal hover:text-signal',
              )}
            >
              <ImagePlay size={17} />
            </button>
          )}
          <label htmlFor={inputId} className="sr-only">Message</label>
          <div className="relative min-w-0 flex-1">
            <input
              id={inputId}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX_LENGTH}
              placeholder="Message the room"
              autoComplete="off"
              enterKeyHint="send"
              className={cn(fieldClasses, 'h-10 pl-3 pr-10')}
            />
            {remaining <= 30 && (
              <span
                className={cn('pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 tabular text-[11px]', remaining <= 10 ? 'text-flare' : 'text-haze')}
                aria-hidden
              >
                {remaining}
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={!text.trim() || sending || !roomId}
            aria-label="Send message"
            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-signal text-ink-950 transition-colors hover:bg-cyan-300 disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      ) : (
        <p className="flex items-center gap-2 border-t border-white/6 bg-ink-900/70 px-3 py-3 text-xs text-haze">
          <Eye size={14} className="shrink-0 text-signal" aria-hidden />
          Spectators can read the chat. Join as a manager to talk.
        </p>
      )}
    </div>
  );
};

export default RoomChat;
