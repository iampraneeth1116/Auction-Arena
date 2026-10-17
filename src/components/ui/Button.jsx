import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';
import { buttonClasses } from './styles';

const Button = ({ variant, size, slant, block, loading = false, icon: Icon, className, children, disabled, type = 'button', ...props }) => (
  <button type={type} className={cn(buttonClasses({ variant, size, slant, block }), className)} disabled={disabled || loading} {...props}>
    {loading ? <Loader2 className="animate-spin" size={16} /> : Icon && <Icon size={16} strokeWidth={2.5} />}
    {children}
  </button>
);

export default Button;
