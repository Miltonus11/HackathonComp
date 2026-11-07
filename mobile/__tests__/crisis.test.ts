import { FALLBACK_HOTLINES, getFallbackCrisis, telUrl } from '@/content/crisis';

describe('crisis fallback content', () => {
  it('has hotlines with a name and a number', () => {
    expect(FALLBACK_HOTLINES.length).toBeGreaterThanOrEqual(3);
    for (const h of FALLBACK_HOTLINES) {
      expect(h.name).toBeTruthy();
      expect(h.number).toMatch(/\d/);
    }
  });
  it('telUrl keeps only digits and a leading plus', () => {
    expect(telUrl('0917-899-8727')).toBe('tel:09178998727');
    expect(telUrl('+63 917 899 8727')).toBe('tel:+639178998727');
    expect(telUrl('1553')).toBe('tel:1553');
  });
  it.each(['en', 'fil'] as const)('getFallbackCrisis(%s) is complete', (lang) => {
    const c = getFallbackCrisis(lang);
    expect(c.headline).toBeTruthy();
    expect(c.message).toBeTruthy();
    expect(c.hotlines).toEqual(FALLBACK_HOTLINES);
    expect(c.talk_to_a_person).toBe(true);
  });
  it('Filipino text differs from English', () => {
    expect(getFallbackCrisis('fil').message).not.toBe(getFallbackCrisis('en').message);
  });
});
