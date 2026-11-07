import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { FALLBACK_HOTLINES } from '@/content/crisis';
import { FIL_ITEMS } from '@/content/screening-fil';
import type { AnswerResponse, Crisis, Form, InstrumentCode, SessionDetail } from '@/domain/screening';
import { AssessmentFlowProvider, useAssessmentFlow } from '@/lib/assessment-flow';
import { ScreeningError, type ScreeningService } from '@/services/screening-service';

let mockLang = 'en';
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ session: { profile: { language_code: mockLang } } }),
}));

const COUNTS: Record<InstrumentCode, number> = { WHO5: 5, GAD7: 7, PHQ9: 9, PHQ9_ITEM9: 1 };
const form = (code: InstrumentCode): Form => ({
  instrument: code,
  name: code,
  recall_period_days: 14,
  min_response: 0,
  max_response: code === 'WHO5' ? 5 : 3,
  options: code === 'WHO5' ? ['a', 'b', 'c', 'd', 'e', 'f'] : ['a', 'b', 'c', 'd'],
  items: Array.from({ length: COUNTS[code] }, (_, i) => ({ item_no: i + 1, text: `en ${code} ${i + 1}` })),
});
const result = (code: InstrumentCode) => ({
  instrument: code, raw_score: 1, scaled_score: null, severity_code: 'MILD', label: 'Mild', advice: null,
});
const SERVER_CRISIS: Crisis = {
  headline: 'server headline',
  message: 'server message',
  hotlines: [{ name: 'Server line', number: '111', note: '' }],
  talk_to_a_person: true,
};
const detail = (over: Partial<SessionDetail>): SessionDetail => ({
  session_id: 's1', started_at: 't', completed_at: null, completed: false, crisis_shown: false,
  crisis: null, results: [], next: form('WHO5'), choice: null, ...over,
});
const answerResponse = (over: Partial<AnswerResponse> & { code: InstrumentCode }): AnswerResponse => ({
  crisis: null, result: result(over.code), next: form('GAD7'), choice: null, completed: false, ...over,
});
const answers = (code: InstrumentCode, value: number) =>
  Object.fromEntries(Array.from({ length: COUNTS[code] }, (_, i) => [i + 1, value]));

function fakeService(over: Partial<ScreeningService> = {}): jest.Mocked<ScreeningService> {
  return {
    start: jest.fn(async () => ({ sessionId: 's1', next: form('WHO5') })),
    list: jest.fn(async () => []),
    get: jest.fn(async () => detail({})),
    submit: jest.fn(async (_id, code) => answerResponse({ code })),
    chooseMoodQuestions: jest.fn(async () => ({ next: form('PHQ9'), choice: null, completed: false })),
    ...over,
  } as jest.Mocked<ScreeningService>;
}

async function setup(service: ScreeningService) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AssessmentFlowProvider service={service}>{children}</AssessmentFlowProvider>
  );
  const { result: r } = await renderHook(() => useAssessmentFlow(), { wrapper });
  return r;
}

async function fillAndSubmit(r: Awaited<ReturnType<typeof setup>>, code: InstrumentCode, value: number) {
  let out: unknown;
  await act(async () => {
    for (const [n, v] of Object.entries(answers(code, value))) r.current.setAnswer(Number(n), v as number);
  });
  await act(async () => {
    try {
      out = await r.current.submit();
    } catch (e) {
      out = e;
    }
  });
  return out;
}

beforeEach(() => {
  mockLang = 'en';
});

describe('assessment flow state', () => {
  it('starts a new session when none is unfinished', async () => {
    const svc = fakeService();
    const r = await setup(svc);
    await act(async () => r.current.begin());
    expect(svc.start).toHaveBeenCalledTimes(1);
    expect(r.current.sessionId).toBe('s1');
    expect(r.current.form?.instrument).toBe('WHO5');
  });

  it('resumes an unfinished session instead of starting a second one', async () => {
    const svc = fakeService({
      list: jest.fn(async () => [
        { session_id: 'old', started_at: 't', completed_at: null, crisis_shown: false, results: [] },
      ]),
      get: jest.fn(async () => detail({ session_id: 'old', next: form('GAD7'), results: [result('WHO5')] })),
    });
    const r = await setup(svc);
    await act(async () => r.current.begin());
    expect(svc.start).not.toHaveBeenCalled();
    expect(r.current.sessionId).toBe('old');
    expect(r.current.form?.instrument).toBe('GAD7');
    expect(r.current.results).toHaveLength(1);
  });

  it('advances to the next questionnaire and clears the answers', async () => {
    const r = await setup(fakeService());
    await act(async () => r.current.begin());
    expect(await fillAndSubmit(r, 'WHO5', 4)).toBe('question');
    expect(r.current.form?.instrument).toBe('GAD7');
    expect(r.current.answers).toEqual({});
  });

  it('goes to results when the server says completed', async () => {
    const svc = fakeService({
      submit: jest.fn(async (_i, code) => answerResponse({ code, next: null, completed: true })),
    });
    const r = await setup(svc);
    await act(async () => r.current.begin());
    expect(await fillAndSubmit(r, 'WHO5', 4)).toBe('results');
    expect(r.current.completed).toBe(true);
  });

  it('shows the server crisis block before moving on, then continues to the next form', async () => {
    const svc = fakeService({
      submit: jest.fn(async (_i, code) => answerResponse({ code, crisis: SERVER_CRISIS })),
    });
    const r = await setup(svc);
    await act(async () => r.current.begin());
    expect(await fillAndSubmit(r, 'WHO5', 0)).toBe('crisis');
    expect(r.current.crisis?.headline).toBe('server headline');
    expect(r.current.form?.instrument).toBe('WHO5'); // not advanced yet
    let next: string | undefined;
    await act(async () => {
      next = r.current.dismissCrisis();
    });
    expect(next).toBe('question');
    expect(r.current.crisis).toBeNull();
    expect(r.current.form?.instrument).toBe('GAD7');
  });

  it('SAFETY: a critical answer reaches crisis help even when saving fails (offline)', async () => {
    const svc = fakeService({
      submit: jest.fn(async () => {
        throw new ScreeningError('NETWORK', 'down');
      }),
    });
    const r = await setup(svc);
    await act(async () => r.current.begin());
    expect(await fillAndSubmit(r, 'WHO5', 0)).toBe('crisis'); // raw 0 -> scaled 0 <= 28
    expect(r.current.crisis?.hotlines).toEqual(FALLBACK_HOTLINES);
    // answers are kept so the person can retry after reading the help
    expect(Object.keys(r.current.answers)).toHaveLength(5);
    let next: string | undefined;
    await act(async () => {
      next = r.current.dismissCrisis();
    });
    expect(next).toBe('question');
    expect(r.current.form?.instrument).toBe('WHO5');
    expect(Object.keys(r.current.answers)).toHaveLength(5);
  });

  it('SAFETY: item 9 asked alone and answered above 0 offline shows crisis help', async () => {
    const svc = fakeService({
      start: jest.fn(async () => ({ sessionId: 's1', next: form('PHQ9_ITEM9') })),
      submit: jest.fn(async () => {
        throw new ScreeningError('SERVER', 'boom');
      }),
    });
    const r = await setup(svc);
    await act(async () => r.current.begin());
    expect(await fillAndSubmit(r, 'PHQ9_ITEM9', 2)).toBe('crisis');
  });

  it('a non-critical answer that fails to save throws and keeps the answers', async () => {
    const svc = fakeService({
      submit: jest.fn(async () => {
        throw new ScreeningError('NETWORK', 'down');
      }),
    });
    const r = await setup(svc);
    await act(async () => r.current.begin());
    const out = await fillAndSubmit(r, 'WHO5', 5);
    expect(out).toBeInstanceOf(ScreeningError);
    expect((out as ScreeningError).code).toBe('NETWORK');
    expect(r.current.crisis).toBeNull();
    expect(Object.keys(r.current.answers)).toHaveLength(5);
  });

  it('SAFETY: if our rule says crisis but the server returned none, help is still shown', async () => {
    const r = await setup(fakeService()); // server returns crisis: null
    await act(async () => r.current.begin());
    expect(await fillAndSubmit(r, 'WHO5', 0)).toBe('crisis');
    expect(r.current.crisis?.hotlines).toEqual(FALLBACK_HOTLINES);
  });

  it('WRONG_INSTRUMENT (server already moved on) resyncs to the server state', async () => {
    const svc = fakeService({
      submit: jest.fn(async () => {
        throw new ScreeningError('WRONG_INSTRUMENT', 'Expected GAD7');
      }),
      get: jest.fn(async () => detail({ next: form('GAD7'), results: [result('WHO5')] })),
    });
    const r = await setup(svc);
    await act(async () => r.current.begin());
    expect(await fillAndSubmit(r, 'WHO5', 4)).toBe('question');
    expect(r.current.form?.instrument).toBe('GAD7');
    expect(r.current.answers).toEqual({});
  });

  it('SESSION_COMPLETE resyncs and goes to results', async () => {
    const svc = fakeService({
      submit: jest.fn(async () => {
        throw new ScreeningError('SESSION_COMPLETE', 'done');
      }),
      get: jest.fn(async () => detail({ completed: true, completed_at: 't', next: null, results: [result('WHO5')] })),
    });
    const r = await setup(svc);
    await act(async () => r.current.begin());
    expect(await fillAndSubmit(r, 'WHO5', 4)).toBe('results');
    expect(r.current.results).toHaveLength(1);
  });

  it('shows Filipino question text for a Filipino profile and leaves scoring fields alone', async () => {
    mockLang = 'fil';
    const r = await setup(fakeService());
    await act(async () => r.current.begin());
    expect(r.current.form?.items[0].text).toBe(FIL_ITEMS.WHO5[0]);
    expect(r.current.form?.items[0].item_no).toBe(1);
    expect(r.current.form?.max_response).toBe(5);
  });

  it('reset clears everything', async () => {
    const r = await setup(fakeService());
    await act(async () => r.current.begin());
    await act(async () => r.current.reset());
    expect(r.current.sessionId).toBeNull();
    expect(r.current.form).toBeNull();
    expect(r.current.results).toEqual([]);
  });
});

describe('viewResults', () => {
  it('opens a finished session so its results can be shown', async () => {
    const svc = fakeService({
      get: jest.fn(async () =>
        detail({ session_id: 'done-1', completed: true, completed_at: 't', next: null, results: [result('WHO5'), result('GAD7')] }),
      ),
    });
    const r = await setup(svc);
    await act(async () => r.current.viewResults('done-1'));
    expect(svc.get).toHaveBeenCalledWith('done-1');
    expect(r.current.sessionId).toBe('done-1');
    expect(r.current.results).toHaveLength(2);
    expect(r.current.completed).toBe(true);
  });
});

describe('the longer mood questions choice', () => {
  const lowWellbeingToChoice = () =>
    fakeService({
      submit: jest.fn(async (_i, code) =>
        code === 'GAD7'
          ? answerResponse({ code, next: null, choice: 'MOOD_QUESTIONS' })
          : answerResponse({ code, next: form('GAD7') }),
      ),
    });

  async function reachChoice(svc: ScreeningService) {
    const r = await setup(svc);
    await act(async () => r.current.begin());
    await fillAndSubmit(r, 'WHO5', 2);
    expect(await fillAndSubmit(r, 'GAD7', 1)).toBe('question');
    return r;
  }

  it('after GAD7 nothing is due and the flow waits for the choice (it is not "finished")', async () => {
    const r = await reachChoice(lowWellbeingToChoice());
    expect(r.current.choicePending).toBe(true);
    expect(r.current.form).toBeNull();
    expect(r.current.completed).toBe(false);
  });

  it('accepting continues with the next questions and clears the pending choice', async () => {
    const svc = lowWellbeingToChoice();
    const r = await reachChoice(svc);
    let where: string | undefined;
    await act(async () => {
      where = await r.current.chooseMoodQuestions(true);
    });
    expect(svc.chooseMoodQuestions).toHaveBeenCalledWith('s1', true);
    expect(where).toBe('question');
    expect(r.current.choicePending).toBe(false);
    expect(r.current.form?.instrument).toBe('PHQ9');
    expect(r.current.completed).toBe(false);
  });

  it('declining goes straight to the results with what has been answered', async () => {
    const svc = lowWellbeingToChoice();
    (svc.chooseMoodQuestions as jest.Mock).mockResolvedValue({ next: null, choice: null, completed: true });
    const r = await reachChoice(svc);
    let where: string | undefined;
    await act(async () => {
      where = await r.current.chooseMoodQuestions(false);
    });
    expect(where).toBe('results');
    expect(r.current.completed).toBe(true);
    expect(r.current.choicePending).toBe(false);
    expect(r.current.results.map((x) => x.instrument).sort()).toEqual(['GAD7', 'WHO5']);
  });

  it('resuming a session that is waiting on the choice lands on the choice', async () => {
    const svc = fakeService({
      list: jest.fn(async () => [
        { session_id: 'old', started_at: 't', completed_at: null, crisis_shown: false, results: [] },
      ]),
      get: jest.fn(async () => detail({ session_id: 'old', next: null, choice: 'MOOD_QUESTIONS', results: [result('WHO5'), result('GAD7')] })),
    });
    const r = await setup(svc);
    await act(async () => r.current.begin());
    expect(r.current.choicePending).toBe(true);
    expect(r.current.completed).toBe(false);
  });

  it('SAFETY: crisis help from the GAD7 answer is shown first, then the choice follows', async () => {
    const svc = fakeService({
      submit: jest.fn(async (_i, code) =>
        code === 'GAD7'
          ? answerResponse({ code, next: null, choice: 'MOOD_QUESTIONS', crisis: SERVER_CRISIS })
          : answerResponse({ code, next: form('GAD7') }),
      ),
    });
    const r = await setup(svc);
    await act(async () => r.current.begin());
    await fillAndSubmit(r, 'WHO5', 2);
    expect(await fillAndSubmit(r, 'GAD7', 1)).toBe('crisis');
    expect(r.current.choicePending).toBe(false); // not yet: crisis first
    let next: string | undefined;
    await act(async () => {
      next = r.current.dismissCrisis();
    });
    expect(next).toBe('question'); // the question screen sends them on to the choice
    expect(r.current.choicePending).toBe(true);
    expect(r.current.completed).toBe(false);
  });

  it('a failed save keeps the choice pending so it can be retried', async () => {
    const svc = lowWellbeingToChoice();
    (svc.chooseMoodQuestions as jest.Mock).mockRejectedValue(new ScreeningError('NETWORK', 'down'));
    const r = await reachChoice(svc);
    let error: unknown;
    await act(async () => {
      try {
        await r.current.chooseMoodQuestions(true);
      } catch (e) {
        error = e;
      }
    });
    expect((error as ScreeningError).code).toBe('NETWORK');
    expect(r.current.choicePending).toBe(true);
  });

  it('NO_CHOICE_PENDING (server already moved on) resyncs to the server state', async () => {
    const svc = lowWellbeingToChoice();
    (svc.chooseMoodQuestions as jest.Mock).mockRejectedValue(new ScreeningError('NO_CHOICE_PENDING', 'x'));
    (svc.get as jest.Mock).mockResolvedValue(detail({ next: form('PHQ9'), choice: null, results: [result('WHO5'), result('GAD7')] }));
    const r = await reachChoice(svc);
    let where: string | undefined;
    await act(async () => {
      where = await r.current.chooseMoodQuestions(true);
    });
    expect(where).toBe('question');
    expect(r.current.form?.instrument).toBe('PHQ9');
    expect(r.current.choicePending).toBe(false);
  });
});
