import type {
  AnswerResponse,
  ChoiceResponse,
  Form,
  SessionDetail,
  SessionSummary,
} from '@/domain/screening';
import { ApiError, jsonInit } from '@/lib/api';
import type { AuthedClient } from '@/lib/authed-client';

import { ScreeningError, type ScreeningErrorCode, type ScreeningService } from './screening-service';

// Backend `code` values (backend/screening/views.py, services.py) -> our error codes
const CODES: Record<string, ScreeningErrorCode> = {
  consent_required: 'CONSENT_REQUIRED',
  profile_required: 'PROFILE_REQUIRED',
  wrong_instrument: 'WRONG_INSTRUMENT',
  invalid_responses: 'INVALID_RESPONSES',
  session_complete: 'SESSION_COMPLETE',
  choice_required: 'CHOICE_REQUIRED',
  no_choice_pending: 'NO_CHOICE_PENDING',
};

function toScreeningError(e: unknown): ScreeningError {
  if (e instanceof ScreeningError) return e;
  if (e instanceof TypeError) {
    return new ScreeningError('NETWORK', 'Could not reach the server. Check your connection and try again.');
  }
  if (e instanceof ApiError) {
    if (e.status === 401) return new ScreeningError('NOT_SIGNED_IN', 'Your session has expired. Please log in again.');
    const code = CODES[e.fields.code?.[0] ?? ''];
    if (code) return new ScreeningError(code, e.fields.detail?.[0] ?? e.message);
  }
  return new ScreeningError('SERVER', 'Something went wrong on our side. Please try again.');
}

export function createApiScreeningService(client: AuthedClient): ScreeningService {
  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    try {
      return await client.authed<T>(path, init);
    } catch (e) {
      throw toScreeningError(e);
    }
  }

  return {
    async start() {
      const res = await call<{ session_id: string; next: Form }>('/screening/sessions/', jsonInit('POST', {}));
      return { sessionId: res.session_id, next: res.next };
    },

    list: () => call<SessionSummary[]>('/screening/sessions/'),

    get: (sessionId) => call<SessionDetail>(`/screening/sessions/${sessionId}/`),

    submit(sessionId, instrument, answers) {
      const responses = Object.entries(answers)
        .map(([item, value]) => ({ item_no: Number(item), value }))
        .sort((a, b) => a.item_no - b.item_no);
      return call<AnswerResponse>(
        `/screening/sessions/${sessionId}/answers/`,
        jsonInit('POST', { instrument, responses }),
      );
    },

    chooseMoodQuestions: (sessionId, accept) =>
      call<ChoiceResponse>(`/screening/sessions/${sessionId}/choice/`, jsonInit('POST', { accept })),
  };
}
