import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

const Spinner = ({ label, className }) => (
  <div className={cn('flex items-center justify-center gap-2 py-8 text-sm text-haze', className)} role="status">
    <Loader2 size={18} className="animate-spin text-signal" />
    {label}
  </div>
);

export default Spinner;
