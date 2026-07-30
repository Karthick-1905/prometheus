import { useCallback, useEffect, useRef, useState } from 'react';

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function useAsync<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await loader();
      if (mounted.current) setData(next);
      return next;
    } catch (reason) {
      if (mounted.current) setError(getErrorMessage(reason));
      throw reason;
    } finally {
      if (mounted.current) setLoading(false);
    }
    // Callers control revalidation with the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  useEffect(() => {
    mounted.current = true;
    void reload().catch(() => undefined);
  }, [reload]);

  return { data, setData, loading, error, setError, reload };
}
