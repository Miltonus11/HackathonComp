import type {
  AnswerResponse,
  Answers,
  ChoiceResponse,
  Form,
  InstrumentCode,
  SessionDetail,
  SessionSummary,
} from '@/domain/screening';

export type ScreeningErrorCode =
  | 'CONSENT_REQUIRED'
  | 'PROFILE_REQUIRED'
  | 'WRONG_INSTRUMENT'
  | 'INVALID_RESPONSES'
  | 'SESSION_COMPLETE'
  | 'CHOICE_REQUIRED'
  | 'NO_CHOICE_PENDING'
  | 'NOT_SIGNED_IN'
  | 'NETWORK'
  | 'SERVER';

export class ScreeningError extends Error {
  constructor(
    public code: ScreeningErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ScreeningError';
  }
}

export interface ScreeningService {
  start(): Promise<{ sessionId: string; next: Form }>;
  /** Newest first */
  list(): Promise<SessionSummary[]>;
  get(sessionId: string): Promise<SessionDetail>;
  submit(sessionId: string, instrument: InstrumentCode, answers: Answers): Promise<AnswerResponse>;
  /** Accept (the longer mood questions follow) or decline (go straight to results). */
  chooseMoodQuestions(sessionId: string, accept: boolean): Promise<ChoiceResponse>;
}
