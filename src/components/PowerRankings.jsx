import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Sparkles, ThumbsDown, ThumbsUp, TriangleAlert } from 'lucide-react';
import { api } from '../lib/api';
import { TEAMS_BY_ID } from '../lib/catalog';
import { formatPrice } from '../lib/format';
import { cn } from '../lib/cn';
import Panel from './ui/Panel';
import Button from './ui/Button';
import EmptyState from './ui/EmptyState';
import Spinner from './ui/Spinner';
import TeamCrest from './ui/TeamCrest';

// Grade chip colours; the letter itself is always shown, so colour is only a hint
const gradeTone = (grade = '') => {
  if (grade.startsWith('A')) return 'bg-volt text-ink-950';
  if (grade.startsWith('B')) return 'bg-signal text-ink-950';
  if (grade.startsWith('C')) return 'bg-gold text-ink-950';
  return 'bg-flare text-white';
};

const Points = ({ title, items, icon: Icon, tone }) => (
  <div className="rounded-md border border-white/6 bg-ink-900/60 p-3">
    <div className={cn('mb-1.5 flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.14em]', tone)}>
      <Icon size={13} strokeWidth={2.4} aria-hidden /> {title}
    </div>
    {items.length ? (
      <ul className="space-y-1">
        {items.map(item => (
          <li key={item} className="flex gap-2 text-sm leading-snug text-mist">
            <span className={cn('mt-[7px] size-1 shrink-0 -skew-x-12', tone === 'text-volt' ? 'bg-volt' : 'bg-flare')} aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-haze">None noted.</p>
    )}
  </div>
);

// AI squad ratings for a completed auction, generated on the server with Groq
const PowerRankings = ({ auctionId, isHost }) => {
  const [ranking, setRanking] = useState(null);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const endpoint = `/api/rooms/${encodeURIComponent(auctionId)}/power-rankings`;

  useEffect(() => {
    let cancelled = false;
    api(endpoint)
      .then((data) => {
        if (cancelled) return;
        setRanking(data.ranking);
        setAiAvailable(data.aiAvailable);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [endpoint]);

  const generate = async (regenerate = false) => {
    setIsGenerating(true);
    setError('');
    try {
      const data = await api(endpoint, { method: 'POST', body: { regenerate } });
      setRanking(data.ranking);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel
        accent="signal"
        label="AI power rankings"
        actions={ranking && isHost && (
          <Button variant="outline" size="sm" icon={RefreshCw} loading={isGenerating} onClick={() => generate(true)}>
            Regenerate
          </Button>
        )}
        bodyClassName="px-4 py-3"
      >
        <p className="text-sm text-mist">
          An AI analyst grades every squad on balance, player quality, value for money and depth.
          {ranking && isHost && ' As host, you can ask for a fresh take.'}
        </p>
      </Panel>

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-md border border-flare/30 bg-flare/10 px-4 py-3 text-sm text-flare">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> {error}
        </div>
      )}

      {isLoading ? (
        <Spinner label="Loading rankings" />
      ) : !ranking ? (
        <Panel>
          {aiAvailable ? (
            <EmptyState icon={Sparkles} title="Who built the best squad?">
              <p>Ask the analyst to rank every franchise. It takes a few seconds, and everyone in the room sees the same result.</p>
              <Button className="mt-4" icon={Sparkles} loading={isGenerating} onClick={() => generate(false)}>
                {isGenerating ? 'Analysing squads…' : 'Generate rankings'}
              </Button>
            </EmptyState>
          ) : (
            <EmptyState icon={Sparkles} title="AI rankings are switched off">
              The server needs a Groq API key (GROQ_API_KEY) to generate them.
            </EmptyState>
          )}
        </Panel>
      ) : (
        <>
          <ol className="space-y-3">
            {ranking.rankings.map((entry, index) => {
              const primary = TEAMS_BY_ID.get(entry.teamId)?.colors.primary;
              const top = entry.rank === 1;
              return (
                <motion.li
                  key={entry.teamId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index, 8) * 0.05 }}
                  className="relative overflow-hidden rounded-lg border border-white/8 bg-ink-850/85 p-4 pl-5 sm:p-5 sm:pl-6"
                >
                  <span className="absolute inset-y-0 left-0 w-1" style={{ background: primary }} aria-hidden />

                  <div className="flex items-center gap-3">
                    <span className={cn('w-7 shrink-0 font-display text-3xl font-bold leading-none tabular', top ? 'text-gold' : 'text-haze')}>
                      {entry.rank}
                    </span>
                    <TeamCrest teamId={entry.teamId} size="md" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-bold uppercase leading-tight tracking-wide sm:truncate sm:text-xl">{entry.teamName}</h3>
                      <p className="truncate text-sm text-haze">Managed by {entry.manager}</p>
                    </div>
                    <span
                      className={cn('clip-notch inline-flex h-10 min-w-11 shrink-0 items-center justify-center px-2 font-display text-xl font-bold', gradeTone(entry.grade))}
                      title={`Grade ${entry.grade}`}
                    >
                      {entry.grade}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <div
                      className="h-1.5 flex-1 overflow-hidden rounded-sm bg-ink-700"
                      role="meter"
                      aria-label={`Squad score ${entry.score} out of 100`}
                      aria-valuenow={entry.score}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className={cn('h-full', top ? 'bg-gold' : 'bg-signal')} style={{ width: `${entry.score}%` }} />
                    </div>
                    <span className="shrink-0 font-display text-2xl font-bold leading-none tabular">
                      {entry.score}<span className="text-sm text-haze">/100</span>
                    </span>
                  </div>
                  {entry.aiScore !== undefined && (
                    <p className="mt-1 text-xs text-haze">
                      AI analyst {entry.aiScore} · Arena Strength {entry.arenaStrength}
                      {entry.playersBought < entry.squadLimit && ` · ${entry.playersBought} of ${entry.squadLimit} players`}
                    </p>
                  )}

                  <p className="mt-3 font-semibold text-snow">{entry.headline}</p>
                  <p className="mt-1 text-sm leading-relaxed text-mist">{entry.summary}</p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Points title="Strengths" items={entry.strengths} icon={ThumbsUp} tone="text-volt" />
                    <Points title="Weaknesses" items={entry.weaknesses} icon={ThumbsDown} tone="text-flare" />
                  </div>

                  {entry.bestBuy && (
                    <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm">
                      <span className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-haze">Best buy</span>
                      <span className="font-semibold text-snow">{entry.bestBuy.name}</span>
                      <span className="text-gold tabular">{formatPrice(entry.bestBuy.price)}</span>
                    </p>
                  )}
                </motion.li>
              );
            })}
          </ol>

          <p className="text-center text-xs leading-relaxed text-haze">
            Generated by {ranking.model} on {new Date(ranking.generatedAt).toLocaleString()}.
            It&apos;s an AI opinion based on prices and career stats, not a prediction.
          </p>
        </>
      )}
    </div>
  );
};

export default PowerRankings;
