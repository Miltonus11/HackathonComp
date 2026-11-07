import { useCallback, useEffect, useState } from 'react';

import { API_URL } from '@/lib/api';
import { fetchBarangays, type BarangayOption } from '@/services/barangays';

export function useBarangays() {
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchBarangays()
      .then((list) => {
        if (cancelled) return;
        setBarangays(list);
        setError(list.length === 0 ? 'No barangays are available yet.' : null);
      })
      .catch(() => {
        if (!cancelled) setError(`Could not reach the server at ${API_URL}. Check the address and your connection. If Expo is in tunnel mode, set EXPO_PUBLIC_API_URL in mobile/.env.`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return { barangays, loading, error, reload };
}
