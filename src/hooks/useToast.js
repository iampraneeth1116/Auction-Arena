import { createContext, useContext } from 'react';

// Kept apart from ToastProvider so that file only exports a component (needed for Fast Refresh)
export const ToastContext = createContext({ toast: () => {} });

// toast({ message, tone: 'info' | 'error' | 'success', action: { label, onClick } })
export const useToast = () => useContext(ToastContext);
