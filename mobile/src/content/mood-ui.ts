import type { MoodReason } from '@/domain/mood';
import type { LanguageCode } from '@/domain/profile';

/** Filipino is a draft, [VERIFY] with a native speaker. */
export type MoodUi = {
  title: string;
  subtitle: string;
  hint: string;
  /** Words under the slider: left end, middle, right end */
  scaleLow: string;
  scaleMid: string;
  scaleHigh: string;
  /** Emotion word for the chosen number */
  label: (score: number) => string;
  reasonTitle: string;
  reasons: Record<MoodReason, string>;
  save: string;
  retry: string;
  error: string;
  loadError: string;
  loadRetry: string;
  journal: { title: string; body: string };
  tabJournal: string;
};

const EN: MoodUi = {
  title: 'How are you feeling today?',
  subtitle: 'This is a quick mood tracker, not a test. There are no right or wrong answers.',
  hint: 'Slide to choose',
  scaleLow: 'Sad',
  scaleMid: 'Okay',
  scaleHigh: 'Happy',
  label: (s) => ['Awful', 'Very Sad', 'Sad', 'Down', 'Okay', 'Calm', 'Good', 'Happy', 'Very Happy', 'Joyful'][s - 1],
  reasonTitle: 'What is behind it? (optional)',
  reasons: {
    SLEEP: 'Sleep',
    WORK: 'Work',
    SCHOOL: 'School',
    FAMILY: 'Family',
    HEALTH: 'Health',
    RELATIONSHIP: 'Relationship',
    FINANCES: 'Finances',
    OTHER: 'Other',
  },
  save: 'Save',
  retry: 'Try again',
  error: 'We could not save that. Your answer is still here, so you can try again.',
  loadError: 'We could not load your daily check-in.',
  loadRetry: 'Try again',
  journal: {
    title: 'Journal',
    body: 'Your journal is coming soon. Soon you will get a gentle prompt each day and a place to write.',
  },
  tabJournal: 'Journal',
};

const FIL: MoodUi = {
  title: 'Kumusta ang pakiramdam mo ngayon?',
  subtitle: 'Ito ay mabilis na mood tracker, hindi pagsusulit. Walang tama o maling sagot.',
  hint: 'I-slide para pumili',
  scaleLow: 'Malungkot',
  scaleMid: 'Okay lang',
  scaleHigh: 'Masaya',
  label: (s) =>
    ['Napakasama', 'Napakalungkot', 'Malungkot', 'Matamlay', 'Okay lang', 'Kalmado', 'Maayos', 'Masaya', 'Napakasaya', 'Tuwang-tuwa'][s - 1],
  reasonTitle: 'Ano ang dahilan? (opsyonal)',
  reasons: {
    SLEEP: 'Tulog',
    WORK: 'Trabaho',
    SCHOOL: 'Paaralan',
    FAMILY: 'Pamilya',
    HEALTH: 'Kalusugan',
    RELATIONSHIP: 'Relasyon',
    FINANCES: 'Pera',
    OTHER: 'Iba pa',
  },
  save: 'I-save',
  retry: 'Subukan muli',
  error: 'Hindi namin ito na-save. Nandito pa rin ang sagot mo, subukan muli.',
  loadError: 'Hindi namin ma-load ang iyong daily check-in.',
  loadRetry: 'Subukan muli',
  journal: {
    title: 'Journal',
    body: 'Malapit na ang iyong journal. Magkakaroon ka ng banayad na prompt araw-araw at lugar para magsulat.',
  },
  tabJournal: 'Journal',
};

export const getMoodUi = (lang: LanguageCode): MoodUi => (lang === 'fil' ? FIL : EN);
