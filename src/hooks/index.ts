import { useState, useEffect, useRef, useCallback } from "react";
import { LiveQuoteService } from "../services/liveQuoteService";
import { LiveQuote } from "../services/api/types";

/** Subscribe to live price updates for a symbol */
export const useLiveQuote = (symbol: string | null) => {
  const [quote, setQuote] = useState<LiveQuote | null>(null);

  useEffect(() => {
    if (!symbol) {
      setQuote(null);
      return;
    }
    return LiveQuoteService.getInstance().subscribe(symbol, setQuote);
  }, [symbol]);

  return quote;
};

/** Debounced value hook */
export const useDebounce = <T,>(value: T, delay: number): T => {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};

/** Click outside handler */
export const useClickOutside = (callback: () => void) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [callback]);

  return ref;
};

/** Local storage state persistence */
export const usePersistedState = <T,>(key: string, defaultValue: T): [T, (v: T | ((prev: T) => T)) => void] => {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch { /* quota exceeded, etc. */ }
  }, [key, state]);

  return [state, setState];
};

/** Async data fetcher with loading/error states */
export const useAsync = <T,>(
  fetcher: () => Promise<T>,
  deps: any[] = []
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, refetch: execute };
};
