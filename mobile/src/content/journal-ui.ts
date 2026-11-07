import type { BodyProblem } from '@/domain/journal';
import type { LanguageCode } from '@/domain/profile';

/** Journal screen text. Filipino is a draft, [VERIFY] with a native speaker. */
export type JournalUi = {
  title: string;
  today: string;
  pageOf: (page: number, total: number) => string;
  older: string;
  newer: string;
  loading: string;
  loadError: string;
  retry: string;
  moodFirst: string;

  promptLabel: string;
  freeWriting: string;
  inputLabel: string;
  placeholder: string;
  count: (n: number, max: number) => string;
  save: string;
  saving: string;
  bodyProblem: Record<BodyProblem, string>;
  unsure: string;
  saveFailed: string;
  signedOut: string;

  writtenAt: (time: string) => string;
  noEntry: string;
  unreadable: string;
  replyTitle: string;
  unavailable: string;
  recovered: string;

  delete: string;
  deleteConfirm: string;
  deleteYes: string;
  deleteNo: string;
  deleteError: string;

  helpLink: string;
  helpHide: string;

  weekdays: string[];
  months: string[];
};

const EN: JournalUi = {
  title: 'Journal',
  today: 'Today',
  pageOf: (p, t) => `Page ${p} of ${t}`,
  older: 'Older day',
  newer: 'Newer day',
  loading: 'Loading your journal…',
  loadError: 'We could not load your journal.',
  retry: 'Try again',
  moodFirst: 'Log how you feel today to open your journal.',

  promptLabel: "Today's question",
  freeWriting: 'Write about anything on your mind today.',
  inputLabel: 'Your journal entry',
  placeholder: 'Write as much or as little as you like.',
  count: (n, max) => `${n.toLocaleString('en-US')} / ${max.toLocaleString('en-US')}`,
  save: 'Save',
  saving: 'Saving your entry and preparing a reply. This can take a few seconds.',
  bodyProblem: {
    EMPTY: 'Write something first.',
    TOO_LONG: 'That is a bit long. Please keep it under 5,000 characters.',
  },
  unsure: 'We could not tell if your entry was saved. We will check before sending it again.',
  saveFailed: 'We could not save your entry. It is still here, so you can try again.',
  signedOut: 'Your session has expired. Please log in again. Copy your text first if you want to keep it.',

  writtenAt: (t) => `Written at ${t}`,
  noEntry: 'No entry for this day.',
  unreadable: 'This entry could not be opened.',
  replyTitle: 'A note for you',
  unavailable: 'Your entry is saved. A reply is not available right now.',
  recovered: 'Your entry is saved. We could not load a reply this time.',

  delete: 'Delete entry',
  deleteConfirm: 'Delete this entry? It is removed for good and cannot be brought back.',
  deleteYes: 'Delete',
  deleteNo: 'Keep it',
  deleteError: 'We could not delete it. Please try again.',

  helpLink: 'Need help right now?',
  helpHide: 'Hide help',

  weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

const FIL: JournalUi = {
  title: 'Journal',
  today: 'Ngayon',
  pageOf: (p, t) => `Pahina ${p} ng ${t}`,
  older: 'Naunang araw',
  newer: 'Mas bagong araw',
  loading: 'Nilo-load ang iyong journal…',
  loadError: 'Hindi namin ma-load ang iyong journal.',
  retry: 'Subukan muli',
  moodFirst: 'Itala muna kung ano ang pakiramdam mo ngayon para mabuksan ang journal.',

  promptLabel: 'Tanong para sa araw na ito',
  freeWriting: 'Isulat ang kahit anong nasa isip mo ngayon.',
  inputLabel: 'Ang iyong journal entry',
  placeholder: 'Magsulat nang marami o kaunti, ikaw ang bahala.',
  count: (n, max) => `${n.toLocaleString('en-US')} / ${max.toLocaleString('en-US')}`,
  save: 'I-save',
  saving: 'Sine-save ang iyong entry at inihahanda ang sagot. Maaaring tumagal ito nang ilang segundo.',
  bodyProblem: {
    EMPTY: 'Magsulat muna ng kahit ano.',
    TOO_LONG: 'Medyo mahaba ito. Panatilihin itong mas maikli sa 5,000 na karakter.',
  },
  unsure: 'Hindi namin matiyak kung na-save ang iyong entry. Titingnan muna namin bago ito ipadala muli.',
  saveFailed: 'Hindi namin na-save ang iyong entry. Nandito pa rin ito, kaya maaari mong subukan muli.',
  signedOut: 'Nag-expire na ang iyong session. Mag-log in muli. Kopyahin muna ang iyong isinulat kung gusto mo itong itago.',

  writtenAt: (t) => `Isinulat noong ${t}`,
  noEntry: 'Walang entry sa araw na ito.',
  unreadable: 'Hindi mabuksan ang entry na ito.',
  replyTitle: 'Isang mensahe para sa iyo',
  unavailable: 'Na-save ang iyong entry. Wala pang sagot sa ngayon.',
  recovered: 'Na-save ang iyong entry. Hindi namin na-load ang sagot ngayon.',

  delete: 'Burahin ang entry',
  deleteConfirm: 'Burahin ang entry na ito? Tuluyan itong mawawala at hindi na maibabalik.',
  deleteYes: 'Burahin',
  deleteNo: 'Huwag',
  deleteError: 'Hindi namin ito nabura. Subukan muli.',

  helpLink: 'Kailangan mo ba ng tulong ngayon?',
  helpHide: 'Itago ang tulong',

  weekdays: ['Lin', 'Lun', 'Mar', 'Miy', 'Huw', 'Biy', 'Sab'],
  months: ['Ene', 'Peb', 'Mar', 'Abr', 'May', 'Hun', 'Hul', 'Ago', 'Set', 'Okt', 'Nob', 'Dis'],
};

export const getJournalUi = (lang: LanguageCode): JournalUi => (lang === 'fil' ? FIL : EN);

/** 'Sat, Nov 7, 2026' from a 'YYYY-MM-DD' day. Done by hand: no reliance on device time zones. */
export function formatDay(ui: JournalUi, date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${ui.weekdays[weekday]}, ${ui.months[m - 1]} ${d}, ${y}`;
}

/** '3:05 PM' in Philippine time from a timestamp, or '' if it cannot be read. */
export function formatPhTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const ph = new Date(ms + 8 * 60 * 60 * 1000);
  const h = ph.getUTCHours();
  const mm = String(ph.getUTCMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
}
