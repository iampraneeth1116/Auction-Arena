import React from 'react';
import { House, RotateCcw, TriangleAlert } from 'lucide-react';
import Logo from './ui/Logo';
import Panel from './ui/Panel';
import Button from './ui/Button';
import Tag from './ui/Tag';
import { buttonClasses } from './ui/styles';

// Wraps the whole app (outside the router and every provider), so the fallback
// only uses plain building blocks and full page loads for navigation.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) {
      console.error('Uncaught error:', error, errorInfo);
    }
    this.setState({ error, errorInfo });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, errorInfo } = this.state;

    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-950 bg-grid px-4 py-10">
        <div className="w-full max-w-md">
          <a href="/" aria-label="Auction Arena home" className="mb-5 inline-block">
            <Logo size="sm" />
          </a>

          <Panel accent="flare" bodyClassName="space-y-4 p-5 sm:p-6">
            {/* Off-air strip, like a channel's fault caption */}
            <div className="-mx-5 -mt-5 mb-1 flex h-6 sm:-mx-6 sm:-mt-6" aria-hidden>
              <span className="flex-1 bg-stripes" />
            </div>

            <Tag tone="flare" icon={TriangleAlert}>Technical fault</Tag>

            <div className="space-y-2">
              <h1 className="font-display text-3xl font-bold uppercase tracking-wide">We&rsquo;ll be right back</h1>
              <p className="text-sm leading-relaxed text-mist">
                This screen hit an error it couldn&rsquo;t recover from. Live auctions run on the server, so
                reloading puts you back where you were.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button icon={RotateCcw} block onClick={() => window.location.reload()}>
                Reload
              </Button>
              <a href="/" className={buttonClasses({ variant: 'outline', block: true })}>
                <House size={16} strokeWidth={2.5} />
                Home
              </a>
            </div>

            {import.meta.env.DEV && error && (
              <details className="group rounded-md border border-white/8 bg-ink-900/70">
                <summary className="cursor-pointer select-none px-3 py-2 font-display text-xs font-semibold uppercase tracking-[0.14em] text-haze hover:text-mist">
                  Error details (dev only)
                </summary>
                <pre className="max-h-56 overflow-auto scrollbar-thin break-all border-t border-white/6 px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap text-flare/80">
                  {error.toString()}
                  {errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </Panel>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
