import React, { memo, useEffect, useState } from 'react';
import { History } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import SoldCard from './SoldCard';
import { timeAgo } from '../../lib/format';

// Sales, unsold lots and room events, newest first
const ActivityFeed = ({ messages }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  const events = messages.filter(m => m.type === 'log' || m.type === 'sold_card').slice(-80).reverse();
  if (events.length === 0) {
    return <EmptyState icon={History} title="Nothing yet">Sales and room events show up here.</EmptyState>;
  }

  return (
    <ol className="space-y-2 p-3">
      {events.map(event => (
        <li key={event.id}>
          {event.type === 'sold_card' ? (
            <SoldCard message={event} />
          ) : (
            <div className="flex items-baseline gap-2 border-l-2 border-ink-600 py-0.5 pl-2.5 text-sm">
              <span className={/UNSOLD/.test(event.text) ? 'text-haze' : 'text-mist'}>{event.text.replace('UNSOLD', 'went unsold')}</span>
              <span className="ml-auto shrink-0 text-[11px] text-haze">{timeAgo(event.timestamp, now)}</span>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
};

export default memo(ActivityFeed);
