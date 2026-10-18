import React from 'react';
import { Volume2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Toggle from '../ui/Toggle';
import { inputClasses } from '../ui/styles';
import { cn } from '../../lib/cn';

const TIMER_PRESETS = [3, 5, 8, 10, 15, 20, 30];

const Slider = ({ label, value, min, max, step, onChange, format }) => (
  <label className="block">
    <span className="flex justify-between text-sm"><span className="text-mist">{label}</span><span className="tabular font-display font-semibold">{format(value)}</span></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="mt-1 w-full accent-signal" />
  </label>
);

// Room settings for the host, and sound/voice settings for this browser
const RoomSettingsModal = ({ open, onClose, isHost, bidTimer, onTimer, voice, sounds }) => (
  <Modal open={open} onClose={onClose} title="Settings">
    <div className="space-y-6">
      {isHost && (
        <section className="space-y-3">
          <h3 className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-haze">Room (host)</h3>
          <div>
            <div className="mb-1.5 text-sm text-mist">Bid timer — applies from the next bid</div>
            <div className="flex flex-wrap gap-1.5">
              {TIMER_PRESETS.map(s => (
                <button
                  key={s}
                  onClick={() => onTimer(s)}
                  className={cn('h-9 min-w-12 rounded-md border px-2 font-display font-semibold tabular cursor-pointer',
                    s === bidTimer ? 'border-signal bg-signal/15 text-signal' : 'border-ink-600 text-mist hover:border-ink-500')}
                >
                  {s}s
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-haze">Sound (this device)</h3>
        <Toggle checked={sounds.effects} onChange={sounds.setEffects} label="Countdown beeps" />
        <Toggle checked={sounds.anthems} onChange={sounds.setAnthems} label="Team anthems and stings" description="Plays the buying team's anthem on a sale." />
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-haze">Voice auctioneer (this device)</h3>
        {!voice.supported ? (
          <p className="text-sm text-haze">This browser can't speak. Try Chrome, Edge or Safari.</p>
        ) : (
          <>
            <Toggle checked={voice.enabled} onChange={voice.setEnabled} label="Announce lots and bids" />
            <div className={cn('space-y-3', !voice.enabled && 'pointer-events-none opacity-40')}>
              {voice.voices.length > 0 && (
                <label className="block">
                  <span className="mb-1.5 block text-sm text-mist">Voice</span>
                  <select className={inputClasses} value={voice.voiceName} onChange={e => voice.setVoiceName(e.target.value)}>
                    {voice.voices.map(v => <option key={v.name} value={v.name}>{v.label}</option>)}
                  </select>
                </label>
              )}
              <Slider label="Pace" value={voice.rate} min={0.7} max={1.8} step={0.05} onChange={voice.setRate} format={v => `${v.toFixed(2)}×`} />
              <Slider label="Pitch" value={voice.pitch} min={0.6} max={1.4} step={0.05} onChange={voice.setPitch} format={v => v.toFixed(2)} />
              <Button variant="outline" size="sm" icon={Volume2} onClick={voice.preview}>Test voice</Button>
            </div>
          </>
        )}
      </section>
    </div>
  </Modal>
);

export default RoomSettingsModal;
