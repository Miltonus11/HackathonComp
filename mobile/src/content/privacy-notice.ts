import type { ConsentType } from '@/domain/consent';
import type { LanguageCode } from '@/domain/profile';

/** Bump whenever the notice wording changes; stored with every consent decision. */
export const NOTICE_VERSION = '2026-11-draft-1';

export type Notice = {
  title: string;
  /** Shown as a banner until the DPO signs off. */
  draftBanner: string;
  intro: string;
  sections: { heading: string; body: string }[];
  consents: Record<ConsentType, { label: string; description: string; required: boolean }>;
  footer: string;
};

/**
 * DRAFT copy. [VERIFY with the city's DPO and legal counsel] before launch.
 * The Filipino text is a good-faith draft and needs review by a fluent human reviewer.
 */
const NOTICES: Record<LanguageCode, Notice> = {
  en: {
    title: 'Your privacy matters',
    draftBanner: 'Draft notice — pending review by the City Data Protection Officer.',
    intro:
      'This app helps you notice early signs of emotional distress and find support. It is a screening and support tool. It does not diagnose and does not replace a doctor or counselor. Under the Data Privacy Act of 2012 (RA 10173), mental health information is sensitive personal information, and we handle it with extra care.',
    sections: [
      {
        heading: 'What we collect',
        body: 'Your username, mobile number and real name (to create your account; only your username is shown in the app), your birth year, sex, sector and barangay (for support suggestions and anonymous reports), and what you choose to share later, such as screening answers, mood check-ins and journal entries.',
      },
      {
        heading: 'Why we collect it',
        body: 'To give you guidance that fits you, to point you to services near you, and to help the city understand where support is needed. We collect only what we need. We ask for your barangay, never your full address.',
      },
      {
        heading: 'Who can see it',
        body: 'Only you can see your personal records. City program staff see combined statistics only, and small groups are hidden so no one can be picked out. A trained responder may see your information only if you agree to share it, or in a high-risk situation where your safety is at stake.',
      },
      {
        heading: 'Your rights',
        body: 'You may ask to see, correct, export or delete your data, and you may withdraw any permission below at any time in the Privacy tab. Withdrawing does not affect what was done before you withdrew.',
      },
      {
        heading: 'Questions or concerns',
        body: 'Contact the City Data Protection Officer: [contact details to be added].',
      },
    ],
    consents: {
      APP_USE: {
        label: 'I have read this notice and agree to the use of my information to run this app.',
        description: 'Required to use the app.',
        required: true,
      },
      AI_ANALYSIS: {
        label: 'Allow AI to read my journal and chat messages.',
        description:
          'Optional. AI gives you reflections and information. It never diagnoses you. Names and contact details are not sent to the AI service.',
        required: false,
      },
      PROFESSIONAL_SHARING: {
        label: 'Allow sharing my results with a professional when I ask for a referral.',
        description:
          'Optional. Only shared when you choose to contact a service. You can turn this off anytime.',
        required: false,
      },
    },
    footer: 'If you are in immediate danger, call your local emergency number.',
  },
  fil: {
    title: 'Mahalaga ang iyong privacy',
    draftBanner: 'Draft na paunawa — hinihintay pa ang pagsusuri ng City Data Protection Officer.',
    intro:
      'Tinutulungan ka ng app na ito na mapansin ang maagang senyales ng emosyonal na paghihirap at makahanap ng suporta. Ito ay kasangkapan para sa screening at suporta. Hindi ito nagdidiyagnos at hindi pamalit sa doktor o counselor. Ayon sa Data Privacy Act of 2012 (RA 10173), sensitibong personal na impormasyon ang datos tungkol sa mental health, kaya mas maingat namin itong hinahawakan.',
    sections: [
      {
        heading: 'Anong impormasyon ang kinokolekta',
        body: 'Ang iyong username, mobile number at tunay na pangalan (para sa iyong account; username lang ang makikita sa app), taon ng kapanganakan, kasarian, sektor at barangay (para sa mga mungkahing suporta at hindi-nakikilalang ulat), at ang mga pipiliin mong ibahagi sa susunod, tulad ng sagot sa screening, mood check-in at journal.',
      },
      {
        heading: 'Bakit namin ito kinokolekta',
        body: 'Para makapagbigay ng gabay na angkop sa iyo, maituro ka sa mga serbisyong malapit sa iyo, at matulungan ang lungsod na malaman kung saan kailangan ang suporta. Kinokolekta lang namin ang kailangan. Barangay lang ang hinihingi namin, hindi ang buong tirahan mo.',
      },
      {
        heading: 'Sino ang makakakita',
        body: 'Ikaw lang ang nakakakita ng iyong personal na talaan. Pinagsama-samang estadistika lang ang nakikita ng mga tauhan ng programa ng lungsod, at itinatago ang maliliit na grupo para walang makilala. Maaaring makita ng sinanay na responder ang iyong impormasyon kung pumayag ka, o sa sitwasyong mataas ang panganib at nakataya ang iyong kaligtasan.',
      },
      {
        heading: 'Ang iyong mga karapatan',
        body: 'Maaari mong hilingin na makita, itama, i-export o burahin ang iyong datos, at maaari mong bawiin ang anumang pahintulot sa ibaba anumang oras sa tab na Privacy. Hindi nito binabago ang mga nagawa na bago ka nag-withdraw.',
      },
      {
        heading: 'Mga tanong o alalahanin',
        body: 'Makipag-ugnayan sa City Data Protection Officer: [idadagdag pa ang contact details].',
      },
    ],
    consents: {
      APP_USE: {
        label: 'Nabasa ko ang paunawang ito at pumapayag ako sa paggamit ng aking impormasyon para patakbuhin ang app.',
        description: 'Kailangan para magamit ang app.',
        required: true,
      },
      AI_ANALYSIS: {
        label: 'Payagan ang AI na basahin ang aking journal at mga mensahe sa chat.',
        description:
          'Opsyonal. Nagbibigay ang AI ng pagninilay at impormasyon. Hindi ito nagdidiyagnos. Hindi ipinapadala sa AI ang pangalan at contact details mo.',
        required: false,
      },
      PROFESSIONAL_SHARING: {
        label: 'Payagan ang pagbabahagi ng aking resulta sa isang propesyonal kapag humiling ako ng referral.',
        description:
          'Opsyonal. Ibabahagi lang kapag pinili mong kumontak ng serbisyo. Maaari mo itong patayin anumang oras.',
        required: false,
      },
    },
    footer: 'Kung nasa agarang panganib ka, tawagan ang lokal na emergency number.',
  },
};

export function getNotice(lang: LanguageCode): Notice {
  return NOTICES[lang];
}
