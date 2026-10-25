import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

// Centered dialog on desktop, bottom sheet on phones. Escape or the backdrop closes it.
const Modal = ({ open, onClose, title, subtitle, wide = false, children, footer }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-ink-950/80 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              'relative flex max-h-[88dvh] w-full flex-col overflow-hidden border border-white/10 bg-ink-850 shadow-2xl',
              'rounded-t-xl sm:rounded-xl',
              wide ? 'sm:max-w-3xl' : 'sm:max-w-md',
            )}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <span className="absolute inset-x-0 top-0 h-0.5 bg-signal" aria-hidden />
            <header className="flex items-start justify-between gap-4 border-b border-white/6 px-5 py-4">
              <div className="min-w-0">
                <h2 className="font-display text-xl font-bold uppercase tracking-wide">{title}</h2>
                {subtitle && <p className="mt-0.5 text-sm text-haze">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="rounded-md p-1.5 text-haze hover:bg-white/5 hover:text-snow cursor-pointer" aria-label="Close">
                <X size={18} />
              </button>
            </header>
            {/* layoutScroll keeps drag-to-reorder lists lined up once the body has scrolled */}
            <motion.div layoutScroll className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-5 py-4">{children}</motion.div>
            {footer && <footer className="border-t border-white/6 px-5 py-3">{footer}</footer>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
