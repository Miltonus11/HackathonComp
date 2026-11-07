import type { LanguageCode } from '@/domain/profile';
import type { Advice } from '@/domain/screening';

/**
 * Result messages shown after the check-in. They are warm and encouraging and never show a
 * severity label, band, or score. Which one is used comes from the server's `suggested_action`
 * (rule-based), so the app still decides nothing clinical: it only chooses the wording.
 * Filipino is a draft, [VERIFY] with a native speaker / the clinician reviewer.
 */
type Message = { headline: string; message: string };

const MESSAGES: Record<LanguageCode, Record<string, Message>> = {
  en: {
    MONITOR: {
      headline: 'You are doing okay',
      message:
        'Thank you for checking in. Keep doing the things that help you feel well, and check in again in a couple of weeks.',
    },
    SELF_CARE: {
      headline: 'Small steps can help',
      message:
        'Thank you for being honest about how you have been feeling. Rest, moving your body, and talking with someone you trust can make a real difference. Support is here whenever you want it.',
    },
    CONSIDER_PROFESSIONAL: {
      headline: 'Talking to someone could help',
      message:
        'Thank you for sharing how you have been. It may help to talk with someone, such as a health professional or a person you trust. You do not have to figure this out alone.',
    },
    PRIORITY_REFERRAL: {
      headline: 'You deserve support',
      message:
        'Thank you for sharing this. Reaching out to a health professional or someone you trust is a good next step, and we can help you find support nearby.',
    },
  },
  fil: {
    MONITOR: {
      headline: 'Maayos ang lagay mo',
      message:
        'Salamat sa pag-check in. Ipagpatuloy ang mga bagay na nakakatulong sa iyo, at mag-check in ulit pagkatapos ng ilang linggo.',
    },
    SELF_CARE: {
      headline: 'Makakatulong ang maliliit na hakbang',
      message:
        'Salamat sa pagiging tapat sa nararamdaman mo. Malaking tulong ang pahinga, paggalaw ng katawan, at pakikipag-usap sa taong pinagkakatiwalaan mo. Narito ang suporta kapag kailangan mo.',
    },
    CONSIDER_PROFESSIONAL: {
      headline: 'Makakatulong ang pakikipag-usap sa iba',
      message:
        'Salamat sa pagbabahagi. Maaaring makatulong na makipag-usap sa propesyonal sa kalusugan o sa taong pinagkakatiwalaan mo. Hindi mo kailangang mag-isa.',
    },
    PRIORITY_REFERRAL: {
      headline: 'Karapat-dapat kang suportahan',
      message:
        'Salamat sa pagbabahagi nito. Magandang susunod na hakbang ang makipag-ugnayan sa propesyonal sa kalusugan o sa taong pinagkakatiwalaan mo, at matutulungan ka naming humanap ng suporta sa malapit.',
    },
  },
};

/**
 * The text to show for a result. Safety-related advice (crisis support, the item-9 answer) keeps
 * the server's wording, which is already supportive; everything else uses the gentle messages.
 */
export function gentleAdvice(advice: Advice | null, lang: LanguageCode): Message | null {
  if (!advice) return null;
  const mapped = MESSAGES[lang]?.[advice.suggested_action] ?? MESSAGES.en[advice.suggested_action];
  return mapped ?? { headline: advice.headline, message: advice.message };
}