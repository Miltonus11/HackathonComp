/**
 * "Maybe later" on the first-time assessment prompt. Kept in memory only, so the prompt comes
 * back the next time the person signs in (until the assessment is completed).
 */
let dismissed = false;

export const dismissAssessmentPrompt = () => {
  dismissed = true;
};
export const isAssessmentPromptDismissed = () => dismissed;
export const resetAssessmentPrompt = () => {
  dismissed = false;
};
