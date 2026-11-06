import { useEffect, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { apiFetch } from '@/lib/api';

type Health = { status: string; database: string; postgres: string };

export function ApiStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Health>('/health/')
      .then(setHealth)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <ThemedText type="small">Backend unreachable: {error}</ThemedText>;
  if (!health) return <ThemedText type="small">Checking backend…</ThemedText>;
  return (
    <ThemedText type="small">
      Backend {health.status}, database {health.database}
    </ThemedText>
  );
}
