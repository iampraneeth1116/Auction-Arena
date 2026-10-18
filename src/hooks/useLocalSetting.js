import { useCallback, useState } from 'react';

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback; // storage blocked or bad JSON
  }
};

// A per-browser preference that survives reloads (voice, sound, view choices)
export function useLocalSetting(key, fallback) {
  const [value, setValue] = useState(() => read(`arena:${key}`, fallback));
  const update = useCallback((next) => {
    setValue(next);
    try {
      localStorage.setItem(`arena:${key}`, JSON.stringify(next));
    } catch {
      // not saved; the setting still applies for this visit
    }
  }, [key]);
  return [value, update];
}
