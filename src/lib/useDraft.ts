import { useEffect, useState } from 'react';

/**
 * Like useState, but also remembers the value in the browser's
 * localStorage. Handy on the New Pack screen: if you switch to the Claude
 * app and Android closes Brainer in the background, your typing is
 * still there when you come back.
 */
export function useDraft<T>(key: string, initial: T): [T, (value: T) => void] {
  const storageKey = `brainer-draft-${key}`;

  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved !== null ? (JSON.parse(saved) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Storage might be unavailable (e.g. private mode). That's fine.
    }
  }, [storageKey, value]);

  return [value, setValue];
}

/** Forget all saved drafts (called after a pack is saved). */
export function clearDrafts() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('brainer-draft-'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
