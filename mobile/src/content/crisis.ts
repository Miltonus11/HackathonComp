import type { LanguageCode } from '@/domain/profile';
import type { Crisis, Hotline } from '@/domain/screening';

/**
 * Used when the server's crisis block is unavailable (offline or failed request). The crisis
 * screen must never come up empty. Copied from the backend's CRISIS_HOTLINES setting.
 * [VERIFY] every number with the City Health Office before launch.
 */
export const FALLBACK_HOTLINES: Hotline[] = [
  { name: 'NCMH Crisis Hotline', number: '1553', note: 'National Center for Mental Health' },
  { name: 'NCMH Crisis Hotline (mobile)', number: '0917-899-8727', note: 'National Center for Mental Health' },
  { name: 'Hopeline PH', number: '0917-558-4673', note: 'Natasha Goulbourn Foundation' },
  { name: 'National Emergency Hotline', number: '911', note: 'Immediate danger' },
];

const TEXT: Record<LanguageCode, { headline: string; message: string }> = {
  en: {
    headline: 'You are not alone, and help is available',
    message:
      'Thank you for being honest. Your responses suggest you may be going through something very hard, and you deserve support right now. If you are in danger or thinking about hurting yourself, please call one of the numbers below or go to the nearest emergency room. You can also tell someone you trust.',
  },
  fil: {
    headline: 'Hindi ka nag-iisa, at may tulong na makukuha',
    message:
      'Salamat sa pagiging tapat. Maaaring dumaranas ka ng napakahirap na bagay, at karapat-dapat kang makatanggap ng suporta ngayon. Kung ikaw ay nasa panganib o may iniisip na saktan ang sarili, mangyaring tumawag sa isa sa mga numero sa ibaba o pumunta sa pinakamalapit na emergency room. Maaari ka ring magsabi sa taong pinagkakatiwalaan mo.',
  },
};

export function getFallbackCrisis(lang: LanguageCode): Crisis {
  return { ...TEXT[lang], hotlines: FALLBACK_HOTLINES, talk_to_a_person: true };
}

/** `tel:` link: digits and a leading plus only. */
export function telUrl(number: string): string {
  const plus = number.trim().startsWith('+') ? '+' : '';
  return `tel:${plus}${number.replace(/\D/g, '')}`;
}
