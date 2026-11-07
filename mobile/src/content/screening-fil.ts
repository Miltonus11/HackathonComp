import type { LanguageCode } from '@/domain/profile';
import type { Form, InstrumentCode } from '@/domain/screening';

/*
 * Filipino question and answer text for the pre-assessment. The server scores by item number
 * and value only, so translating text never changes scoring.
 *
 * DRAFT translations written by the assistant. [VERIFY] against the validated Filipino
 * versions of the WHO-5, GAD-7 and PHQ-9 and have a fluent reviewer check them before launch.
 * Keep the order and counts identical to backend/screening/seed_data.py and content.py.
 */

const FREQ_4 = ['Hindi kailanman', 'Ilang araw', 'Higit sa kalahati ng mga araw', 'Halos araw-araw'];

export const FIL_OPTIONS: Record<InstrumentCode, string[]> = {
  WHO5: [
    'Hindi kailanman',
    'Sa ilang pagkakataon',
    'Mas kaunti sa kalahati ng panahon',
    'Higit sa kalahati ng panahon',
    'Sa halos lahat ng panahon',
    'Sa lahat ng panahon',
  ],
  GAD7: FREQ_4,
  PHQ9: FREQ_4,
  PHQ9_ITEM9: FREQ_4,
};

export const FIL_ITEMS: Record<InstrumentCode, string[]> = {
  WHO5: [
    'Naging masaya ako at maganda ang aking pakiramdam',
    'Naging kalmado at relaks ako',
    'Naging masigla at aktibo ako',
    'Gumising akong presko at nakapagpahinga nang mabuti',
    'Ang pang-araw-araw kong buhay ay puno ng mga bagay na kinagigiliwan ko',
  ],
  GAD7: [
    'Pakiramdam na kinakabahan, balisa, o hindi mapakali',
    'Hindi mapigilan o makontrol ang pag-aalala',
    "Sobrang pag-aalala sa iba't ibang bagay",
    'Hirap magrelaks',
    'Sobrang hindi mapakali kaya mahirap umupo nang tahimik',
    'Madaling mairita o mainis',
    'Pakiramdam na takot, na para bang may kakila-kilabot na mangyayari',
  ],
  PHQ9: [
    'Kaunting interes o kasiyahan sa paggawa ng mga bagay',
    'Pakiramdam na malungkot, nanlulumo, o walang pag-asa',
    'Hirap makatulog o manatiling tulog, o sobrang pagtulog',
    'Pakiramdam na pagod o kaunti ang lakas',
    'Walang gana kumain o sobrang pagkain',
    'Masama ang pakiramdam sa sarili, o pakiramdam na ikaw ay pumalpak o nabigo mo ang sarili o ang pamilya mo',
    'Hirap mag-concentrate sa mga bagay, tulad ng pagbabasa o panonood ng telebisyon',
    'Napakabagal kumilos o magsalita na napansin ng ibang tao, o kabaligtaran: sobrang hindi mapakali kaya mas madalas kang gumagalaw kaysa karaniwan',
    'Mga kaisipang mas mabuti pang mamatay ka na, o ang saktan ang sarili sa anumang paraan',
  ],
  PHQ9_ITEM9: ['Mga kaisipang mas mabuti pang mamatay ka na, o ang saktan ang sarili sa anumang paraan'],
};

/**
 * Returns the form with Filipino text when available. Items and options are replaced
 * independently and only when the counts match the server's form, so a mismatch can never
 * pair a question with the wrong item number.
 */
export function localizeForm(form: Form, lang: LanguageCode): Form {
  if (lang !== 'fil') return form;
  const items = FIL_ITEMS[form.instrument];
  const options = FIL_OPTIONS[form.instrument];
  return {
    ...form,
    items:
      items && items.length === form.items.length
        ? form.items.map((item, i) => ({ ...item, text: items[i] }))
        : form.items,
    options: options && options.length === form.options.length ? options : form.options,
  };
}
