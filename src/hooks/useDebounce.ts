import { useState, useEffect } from 'react';

/**
 * Debounce Hook (Criterion 22: Debounce Search & Autocomplete)
 * Delays updating the debounced value until after the specified delay (default 300ms).
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
