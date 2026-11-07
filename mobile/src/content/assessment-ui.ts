import type { LanguageCode } from '@/domain/profile';
import type { InstrumentCode } from '@/domain/screening';
import type { ScreeningErrorCode } from '@/services/screening-service';

export type AssessmentUi = {
  intro: {
    title: string;
    lead: string;
    points: string[];
    notDiagnosis: string;
    needHelp: string;
    start: string;
    later: string;
  };
  question: {
    of: (i: number, n: number) => string;
    recall: (weeks: number) => string;
    howOften: string;
    next: string;
    finish: string;
    back: string;
    saveExit: string;
    sending: string;
  };
  instrumentIntro: Record<InstrumentCode, string>;
  choice: {
    title: string;
    body: string;
    yes: string;
    no: string;
    skipNote: string;
    needHelp: string;
  };
  crisis: {
    call: string;
    talk: string;
    talkNote: string;
    continue: string;
    back: string;
  };
  results: {
    title: string;
    lead: string;
    safetyCheck: string;
    disclaimer: string;
    needHelp: string;
    done: string;
    loading: string;
  };
  instrumentTitle: Record<InstrumentCode, string>;
  home: {
    title: string;
    none: string;
    unfinished: string;
    lastDone: (date: string) => string;
    start: string;
    continue: string;
    again: string;
    viewResults: string;
    loading: string;
    loadError: string;
    retry: string;
  };
  errors: Record<ScreeningErrorCode, string>;
};

/** UI text for the assessment. Filipino is a draft. [VERIFY] with a fluent reviewer. */
const UI: Record<LanguageCode, AssessmentUi> = {
  en: {
    intro: {
      title: 'A quick check-in',
      lead: 'A few short questions about how you have been feeling lately.',
      points: [
        'It takes about 5 minutes.',
        'There are no right or wrong answers.',
        'Your answers are private.',
      ],
      notDiagnosis: 'This is a screening, not a diagnosis. It does not replace a doctor or counselor.',
      needHelp: 'Need help right now?',
      start: 'Start',
      later: 'Maybe later',
    },
    question: {
      of: (i, n) => `Question ${i} of ${n}`,
      recall: (w) => `Over the last ${w} ${w === 1 ? 'week' : 'weeks'}:`,
      howOften: 'How often have you been bothered by this?',
      next: 'Next',
      finish: 'Finish',
      back: 'Back',
      saveExit: 'Save and exit',
      sending: 'Saving your answers…',
    },
    instrumentIntro: {
      WHO5: 'How you have been feeling',
      GAD7: 'Worry and nervousness',
      PHQ9: 'Mood and energy',
      PHQ9_ITEM9: 'One more important question',
    },
    choice: {
      title: 'A few more questions?',
      body: 'Based on your answers so far, a few more questions about your mood and energy can help us understand how you have been doing. It takes about 2 minutes.',
      yes: 'Yes, ask me',
      no: 'No, show my results',
      skipNote: 'Skipping is okay. You can still see your results.',
      needHelp: 'Need help right now?',
    },
    crisis: {
      call: 'Call',
      talk: 'Talk to a person',
      talkNote: 'Calling a hotline connects you with a trained person.',
      continue: 'I am OK to continue',
      back: 'Back',
    },
    results: {
      title: 'Your results',
      lead: 'Thank you for checking in. Here are a few thoughts based on your answers.',
      safetyCheck: 'Safety check',
      disclaimer:
        'These results are a screening, not a diagnosis. If something feels wrong, please talk to a health professional.',
      needHelp: 'Need help right now?',
      done: 'Done',
      loading: 'Loading your results…',
    },
    instrumentTitle: {
      WHO5: 'Wellbeing',
      GAD7: 'Anxiety',
      PHQ9: 'Mood',
      PHQ9_ITEM9: 'Safety check',
    },
    home: {
      title: 'Check-in',
      none: 'A quick check-in about how you have been feeling. It takes about 5 minutes.',
      unfinished: 'You have an unfinished check-in. Pick up where you left off.',
      lastDone: (date) => `Your last check-in was on ${date}.`,
      start: 'Start check-in',
      continue: 'Continue',
      again: 'Take it again',
      viewResults: 'View results',
      loading: 'Checking your check-in status…',
      loadError: 'Could not load your check-in status.',
      retry: 'Try again',
    },
    errors: {
      CONSENT_REQUIRED: 'Please agree to the privacy notice in the Privacy tab to continue.',
      PROFILE_REQUIRED: 'Please finish registration before taking the check-in.',
      WRONG_INSTRUMENT: 'We updated where you are. Please continue.',
      INVALID_RESPONSES: 'Some answers are missing or not valid. Please check and try again.',
      SESSION_COMPLETE: 'This check-in is already finished.',
      CHOICE_REQUIRED: 'Please answer the question on screen first.',
      NO_CHOICE_PENDING: 'We updated where you are. Please continue.',
      NOT_SIGNED_IN: 'Your session has expired. Please log in again.',
      NETWORK: 'Could not reach the server. Your answers are kept. Check your connection and try again.',
      SERVER: 'Something went wrong on our side. Your answers are kept. Please try again.',
    },
  },
  fil: {
    intro: {
      title: 'Isang mabilis na check-in',
      lead: 'Ilang maiikling tanong tungkol sa kung ano ang nararamdaman mo nitong mga nakaraan.',
      points: [
        'Mga 5 minuto lang ito.',
        'Walang tama o maling sagot.',
        'Pribado ang iyong mga sagot.',
      ],
      notDiagnosis:
        'Ito ay screening, hindi diyagnosis. Hindi ito kapalit ng doktor o counselor.',
      needHelp: 'Kailangan mo ba ng tulong ngayon?',
      start: 'Magsimula',
      later: 'Mamaya na lang',
    },
    question: {
      of: (i, n) => `Tanong ${i} sa ${n}`,
      recall: (w) => `Sa nakalipas na ${w} linggo:`,
      howOften: 'Gaano kadalas ka nabagabag nito?',
      next: 'Susunod',
      finish: 'Tapusin',
      back: 'Bumalik',
      saveExit: 'I-save at lumabas',
      sending: 'Sine-save ang iyong mga sagot…',
    },
    instrumentIntro: {
      WHO5: 'Kung ano ang nararamdaman mo',
      GAD7: 'Pag-aalala at pagkabalisa',
      PHQ9: 'Mood at lakas',
      PHQ9_ITEM9: 'Isa pang mahalagang tanong',
    },
    choice: {
      title: 'May ilan pang tanong?',
      body: 'Batay sa mga sagot mo sa ngayon, makakatulong ang ilan pang tanong tungkol sa mood at lakas mo para maintindihan namin kung kumusta ka. Mga 2 minuto lang ito.',
      yes: 'Oo, tanungin mo ako',
      no: 'Hindi, ipakita ang mga resulta',
      skipNote: 'Okay lang na laktawan. Makikita mo pa rin ang iyong mga resulta.',
      needHelp: 'Kailangan mo ba ng tulong ngayon?',
    },
    crisis: {
      call: 'Tumawag',
      talk: 'Makipag-usap sa tao',
      talkNote: 'Ang pagtawag sa hotline ay ikokonekta ka sa isang sinanay na tao.',
      continue: 'Okay lang akong magpatuloy',
      back: 'Bumalik',
    },
    results: {
      title: 'Ang iyong mga resulta',
      lead: 'Salamat sa pag-check in. Narito ang ilang kaisipan batay sa iyong mga sagot.',
      safetyCheck: 'Safety check',
      disclaimer:
        'Ang mga resultang ito ay screening, hindi diyagnosis. Kung may pakiramdam kang hindi tama, makipag-usap sa propesyonal sa kalusugan.',
      needHelp: 'Kailangan mo ba ng tulong ngayon?',
      done: 'Tapos na',
      loading: 'Kinukuha ang iyong mga resulta…',
    },
    instrumentTitle: {
      WHO5: 'Kagalingan',
      GAD7: 'Pagkabalisa',
      PHQ9: 'Mood',
      PHQ9_ITEM9: 'Safety check',
    },
    home: {
      title: 'Check-in',
      none: 'Isang mabilis na check-in tungkol sa nararamdaman mo. Mga 5 minuto lang ito.',
      unfinished: 'May hindi pa tapos na check-in. Ituloy kung saan ka huminto.',
      lastDone: (date) => `Ang huli mong check-in ay noong ${date}.`,
      start: 'Simulan ang check-in',
      continue: 'Ituloy',
      again: 'Ulitin',
      viewResults: 'Tingnan ang mga resulta',
      loading: 'Sinusuri ang status ng iyong check-in…',
      loadError: 'Hindi makuha ang status ng iyong check-in.',
      retry: 'Subukan ulit',
    },
    errors: {
      CONSENT_REQUIRED: 'Pakisang-ayunan ang paunawa sa privacy sa tab na Privacy para magpatuloy.',
      PROFILE_REQUIRED: 'Pakitapos muna ang pagpaparehistro bago ang check-in.',
      WRONG_INSTRUMENT: 'In-update namin kung nasaan ka na. Magpatuloy lang.',
      INVALID_RESPONSES: 'May mga sagot na kulang o hindi wasto. Pakisuri at subukan ulit.',
      SESSION_COMPLETE: 'Tapos na ang check-in na ito.',
      CHOICE_REQUIRED: 'Pakisagot muna ang tanong sa screen.',
      NO_CHOICE_PENDING: 'In-update namin kung nasaan ka na. Magpatuloy lang.',
      NOT_SIGNED_IN: 'Nag-expire na ang iyong session. Mag-log in ulit.',
      NETWORK: 'Hindi maabot ang server. Nakatago ang iyong mga sagot. Suriin ang koneksyon at subukan ulit.',
      SERVER: 'May problema sa aming panig. Nakatago ang iyong mga sagot. Subukan ulit.',
    },
  },
};

export const getAssessmentUi = (lang: LanguageCode): AssessmentUi => UI[lang];