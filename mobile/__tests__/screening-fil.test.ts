import { FIL_ITEMS, FIL_OPTIONS, localizeForm } from '@/content/screening-fil';
import type { Form, InstrumentCode } from '@/domain/screening';

// Item and option counts the backend seeds (backend/screening/seed_data.py, content.py).
const ITEMS: Record<InstrumentCode, number> = { WHO5: 5, GAD7: 7, PHQ9: 9, PHQ9_ITEM9: 1 };
const OPTIONS: Record<InstrumentCode, number> = { WHO5: 6, GAD7: 4, PHQ9: 4, PHQ9_ITEM9: 4 };

const english = (code: InstrumentCode): Form => ({
  instrument: code,
  name: code,
  recall_period_days: 14,
  min_response: 0,
  max_response: OPTIONS[code] - 1,
  options: Array.from({ length: OPTIONS[code] }, (_, i) => `opt ${i}`),
  items: Array.from({ length: ITEMS[code] }, (_, i) => ({ item_no: i + 1, text: `item ${i + 1}` })),
});

describe('Filipino screening content', () => {
  it.each(Object.keys(ITEMS) as InstrumentCode[])('%s has the right item and option counts', (code) => {
    expect(FIL_ITEMS[code]).toHaveLength(ITEMS[code]);
    expect(FIL_OPTIONS[code]).toHaveLength(OPTIONS[code]);
    for (const text of [...FIL_ITEMS[code], ...FIL_OPTIONS[code]]) expect(text.trim()).not.toBe('');
  });

  it('English is returned unchanged', () => {
    const f = english('GAD7');
    expect(localizeForm(f, 'en')).toEqual(f);
  });

  it('Filipino replaces only the text, never the scoring fields', () => {
    const f = english('PHQ9');
    const out = localizeForm(f, 'fil');
    expect(out.items.map((i) => i.item_no)).toEqual(f.items.map((i) => i.item_no));
    expect(out.min_response).toBe(f.min_response);
    expect(out.max_response).toBe(f.max_response);
    expect(out.recall_period_days).toBe(f.recall_period_days);
    expect(out.items[0].text).toBe(FIL_ITEMS.PHQ9[0]);
    expect(out.options).toEqual(FIL_OPTIONS.PHQ9);
  });

  it('falls back to the server text when the item count does not match (never mis-pairs)', () => {
    const odd = { ...english('GAD7'), items: english('GAD7').items.slice(0, 3) };
    expect(localizeForm(odd, 'fil').items).toEqual(odd.items);
  });
});
