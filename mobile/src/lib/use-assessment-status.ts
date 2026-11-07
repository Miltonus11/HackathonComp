import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { assessmentStatus, type AssessmentStatus } from '@/domain/screening';

import { screeningService } from './screening';

type State =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'ready'; status: AssessmentStatus };

/** Loads the check-in status for the Home card, and again whenever Home regains focus. */
export function useAssessmentStatus() {
  const [state, setState] = useState<State>({ phase: 'loading' });

  const load = useCallback(() => {
    let cancelled = false;
    screeningService
      .list()
      .then((list) => {
        if (!cancelled) setState({ phase: 'ready', status: assessmentStatus(list) });
      })
      .catch(() => {
        if (!cancelled) setState({ phase: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Runs on focus; the returned function cancels a stale response on blur.
  useFocusEffect(load);

  const retry = useCallback(() => {
    setState({ phase: 'loading' });
    load();
  }, [load]);

  return { state, retry };
}
