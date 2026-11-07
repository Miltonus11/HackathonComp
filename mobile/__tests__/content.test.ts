import { CONSENT_TYPES } from '@/domain/consent';
import { SECTORS, SEXES } from '@/domain/profile';
import { BARANGAYS, SECTOR_LABELS, SEX_LABELS } from '@/content/options';
import { NOTICE_VERSION, getNotice } from '@/content/privacy-notice';

describe('privacy notice', () => {
  it.each(['en', 'fil'] as const)('%s has all consent types and only APP_USE required', (lang) => {
    const n = getNotice(lang);
    expect(Object.keys(n.consents).sort()).toEqual([...CONSENT_TYPES].sort());
    for (const t of CONSENT_TYPES) {
      expect(n.consents[t].label).toBeTruthy();
      expect(n.consents[t].description).toBeTruthy();
      expect(n.consents[t].required).toBe(t === 'APP_USE');
    }
    expect(n.sections.length).toBeGreaterThan(0);
    expect(JSON.stringify(n)).toContain('10173');
  });

  it('has a version string', () => {
    expect(NOTICE_VERSION).toMatch(/\S/);
  });
});

describe('option lists', () => {
  it('labels every sex and sector in both languages', () => {
    for (const s of SEXES) {
      expect(SEX_LABELS[s].en).toBeTruthy();
      expect(SEX_LABELS[s].fil).toBeTruthy();
    }
    for (const s of SECTORS) {
      expect(SECTOR_LABELS[s].en).toBeTruthy();
      expect(SECTOR_LABELS[s].fil).toBeTruthy();
    }
  });

  it('has unique barangay ids and names', () => {
    const ids = BARANGAYS.map((b) => b.barangay_id);
    const names = BARANGAYS.map((b) => b.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
    expect(BARANGAYS.length).toBeGreaterThan(0);
  });
});
