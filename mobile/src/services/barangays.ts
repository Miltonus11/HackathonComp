import { BARANGAYS } from '@/content/options';
import { apiFetch } from '@/lib/api';

import { USE_MOCK } from './config';

export type BarangayOption = { barangay_id: number; name: string };

/** GET /api/barangays/ (public). In mock mode, returns the bundled placeholder list. */
export async function fetchBarangays(): Promise<BarangayOption[]> {
  if (USE_MOCK) return BARANGAYS;
  const rows = await apiFetch<{ id: number; name: string }[]>('/barangays/');
  return rows.map((r) => ({ barangay_id: r.id, name: r.name }));
}
