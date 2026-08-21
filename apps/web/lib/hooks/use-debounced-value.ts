import { useEffect, useState } from 'react';

// Delays reflecting a fast-changing value (e.g. a text input) until it's
// stopped changing for `delayMs` — used to avoid firing a network request on
// every keystroke (see use-cooperative-slug-preview.ts).
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
