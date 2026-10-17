import React, { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { ToastContext } from '../../hooks/useToast';
import { cn } from '../../lib/cn';

const ICONS = { info: Info, error: AlertTriangle, success: CheckCircle2 };
const BARS = { info: 'bg-signal', error: 'bg-flare', success: 'bg-volt' };

// Short-lived notices stacked at the bottom of the screen, optionally with one action (e.g. Undo)
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setToasts(list => list.filter(t => t.id !== id)), []);

  const toast = useCallback(({ message, tone = 'info', action, duration = 4000 }) => {
    const id = ++nextId.current;
    setToasts(list => [...list.slice(-2), { id, message, tone, action }]);
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[200] flex flex-col items-center gap-2 px-4 sm:bottom-6" aria-live="polite">
        <AnimatePresence>
          {toasts.map(t => {
            const Icon = ICONS[t.tone];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="pointer-events-auto relative flex w-full max-w-sm items-center gap-3 overflow-hidden rounded-md border border-white/10 bg-ink-800 py-3 pl-4 pr-3 shadow-2xl"
              >
                <span className={cn('absolute inset-y-0 left-0 w-1', BARS[t.tone])} aria-hidden />
                <Icon size={16} className={t.tone === 'error' ? 'text-flare' : t.tone === 'success' ? 'text-volt' : 'text-signal'} />
                <span className="min-w-0 flex-1 text-sm text-snow">{t.message}</span>
                {t.action && (
                  <button
                    className="font-display text-sm font-bold uppercase tracking-wider text-signal hover:text-cyan-300 cursor-pointer"
                    onClick={() => {
                      t.action.onClick();
                      dismiss(t.id);
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
