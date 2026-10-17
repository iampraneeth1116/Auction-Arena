import { useCallback, useSyncExternalStore } from 'react';

// True while the media query matches, e.g. useMediaQuery('(min-width: 1280px)')
export function useMediaQuery(query) {
  const subscribe = useCallback((notify) => {
    const list = window.matchMedia(query);
    list.addEventListener('change', notify);
    return () => list.removeEventListener('change', notify);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
