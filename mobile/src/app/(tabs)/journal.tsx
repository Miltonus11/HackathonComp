import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { CrisisHelp, type CrisisHelpLabels } from '@/components/crisis-help';
import { MoodGate } from '@/components/mood-gate';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { getAssessmentUi } from '@/content/assessment-ui';
import { getFallbackCrisis } from '@/content/crisis';
import { formatDay, formatPhTime, getJournalUi, type JournalUi } from '@/content/journal-ui';
import {
  buildDays,
  canWriteToday,
  checkBody,
  MAX_JOURNAL_CHARS,
  phDate,
  phToday,
  type BodyProblem,
  type JournalDay,
  type JournalEntry,
  type JournalPrompt,
} from '@/domain/journal';
import type { LanguageCode } from '@/domain/profile';
import { useAuth } from '@/lib/auth';
import { journalService } from '@/lib/journal';
import { useMood } from '@/lib/mood-context';
import { useJournal, type ReplyState } from '@/lib/use-journal';

/**
 * Journal. One page per Philippine day: page 1 is today, older pages go back to the registration day.
 * Today: the day's question, a writing box, Save. After saving, the entry and the reply (or fixed
 * crisis help, never AI-written) replace the box; deleting today's entry brings the box back.
 */
export default function Journal() {
  const { session } = useAuth();
  const lang: LanguageCode = session?.profile.language_code ?? 'en';
  const ui = getJournalUi(lang);
  const crisisLabels = getAssessmentUi(lang).crisis;

  const mood = useMood();
  const today = mood.date ?? (mood.logged ? phToday() : null);
  const enabled = mood.logged === true && !!today;
  const journal = useJournal({ today, enabled, service: journalService });
  const { reload } = journal;

  // Quietly re-check when the tab comes back into view (another device may have changed things).
  useFocusEffect(
    useCallback(() => {
      reload(true);
    }, [reload]),
  );

  const registeredOn = phDate(session?.identity.created_at);
  const days = useMemo(
    () => (today ? buildDays({ today, registeredOn, entries: journal.entries }) : []),
    [today, registeredOn, journal.entries],
  );

  // Keyed by day: when the day changes, the screen goes back to today's page.
  const [paging, setPaging] = useState<{ day: string | null; page: number }>({ day: today, page: 0 });
  const page = paging.day === today ? paging.page : 0;
  const setPage = (p: number) => setPaging({ day: today, page: p });
  const index = Math.min(page, Math.max(days.length - 1, 0));
  const day = days[index];

  // The draft lives here (memory only) so flipping pages does not lose it.
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState<BodyProblem | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const writing = !!day?.isToday && canWriteToday(days);

  const promptState = journal.prompt;
  const prompt: JournalPrompt | null = promptState.status === 'ready' ? promptState.prompt : null;

  const onSave = async () => {
    const p = checkBody(draft);
    setProblem(p);
    if (p || saving) return;
    setSaving(true);
    setSaveError(null);
    const outcome = await journal.save(draft, prompt?.prompt_id ?? null, prompt?.text ?? null);
    setSaving(false);
    if (outcome.kind === 'failed') {
      // The text is checked before sending, so a 400 here is rare (e.g. the prompt was retired).
      const signedOut = outcome.error.code === 'NOT_SIGNED_IN';
      setSaveError(outcome.unsure ? ui.unsure : signedOut ? ui.signedOut : ui.saveFailed);
      return;
    }
    setDraft('');
  };

  return (
    <Screen
      footer={
        enabled && journal.phase === 'ready' && writing ? (
          <Button title={ui.save} onPress={onSave} loading={saving} />
        ) : undefined
      }>
      <MoodGate where="journal" />

      <Text className="pt-6 text-3xl font-bold text-foreground" accessibilityRole="header">
        {ui.title}
      </Text>

      {!enabled ? (
        <Text className="text-base text-muted-foreground">{ui.moodFirst}</Text>
      ) : journal.phase === 'loading' ? (
        <Text className="text-base text-muted-foreground">{ui.loading}</Text>
      ) : journal.phase === 'error' ? (
        <View className="gap-3 rounded-3xl border border-border bg-card p-5">
          <Text className="text-base text-foreground">{ui.loadError}</Text>
          <Button title={ui.retry} variant="secondary" onPress={journal.retry} />
        </View>
      ) : day ? (
        <>
          <DayNav ui={ui} day={day} index={index} total={days.length} onPage={setPage} />

          {writing ? (
            <WriteBox
              ui={ui}
              prompt={prompt}
              promptLoading={promptState.status === 'loading'}
              draft={draft}
              onChange={(t) => {
                setDraft(t);
                if (problem) setProblem(null);
              }}
              saving={saving}
              problem={problem}
              error={saveError}
            />
          ) : day.entries.length === 0 ? (
            <Text className="text-base text-muted-foreground">{ui.noEntry}</Text>
          ) : (
            day.entries.map((e) => (
              <EntryCard
                key={e.entry_id}
                ui={ui}
                crisisLabels={crisisLabels}
                lang={lang}
                entry={e}
                reply={journal.replies[e.entry_id]}
                onDelete={() => journal.remove(e.entry_id)}
              />
            ))
          )}
        </>
      ) : null}

      <HelpToggle ui={ui} lang={lang} labels={crisisLabels} />
    </Screen>
  );
}

function DayNav({
  ui,
  day,
  index,
  total,
  onPage,
}: {
  ui: JournalUi;
  day: JournalDay;
  index: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const hasOlder = index < total - 1;
  const hasNewer = index > 0;
  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between gap-2">
        <Arrow label={ui.older} glyph="‹" enabled={hasOlder} onPress={() => onPage(index + 1)} />
        <View className="flex-1 items-center">
          <Text className="text-lg font-semibold text-foreground">{day.isToday ? ui.today : formatDay(ui, day.date)}</Text>
          <Text className="text-sm text-muted-foreground">
            {day.isToday ? `${formatDay(ui, day.date)} · ` : ''}
            {ui.pageOf(index + 1, total)}
          </Text>
        </View>
        <Arrow label={ui.newer} glyph="›" enabled={hasNewer} onPress={() => onPage(index - 1)} />
      </View>
    </View>
  );
}

function Arrow({ label, glyph, enabled, onPress }: { label: string; glyph: string; enabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      hitSlop={8}
      onPress={onPress}
      className="h-12 w-12 items-center justify-center rounded-xl bg-secondary active:opacity-80"
      style={enabled ? undefined : { opacity: 0.3 }}>
      <Text className="text-2xl font-bold text-secondary-foreground">{glyph}</Text>
    </Pressable>
  );
}

function WriteBox({
  ui,
  prompt,
  promptLoading,
  draft,
  onChange,
  saving,
  problem,
  error,
}: {
  ui: JournalUi;
  prompt: JournalPrompt | null;
  promptLoading: boolean;
  draft: string;
  onChange: (text: string) => void;
  saving: boolean;
  problem: BodyProblem | null;
  error: string | null;
}) {
  const message = problem ? ui.bodyProblem[problem] : error;
  return (
    <View className="gap-3">
      <View className="gap-1 rounded-3xl bg-secondary p-5">
        <Text className="text-sm font-medium text-muted-foreground">{ui.promptLabel}</Text>
        <Text className="text-lg text-foreground">
          {promptLoading ? '…' : prompt?.text ?? ui.freeWriting}
        </Text>
      </View>

      <TextInput
        accessibilityLabel={ui.inputLabel}
        value={draft}
        onChangeText={onChange}
        editable={!saving}
        multiline
        maxLength={MAX_JOURNAL_CHARS}
        placeholder={ui.placeholder}
        placeholderTextColor="#9a93a8"
        textAlignVertical="top"
        className={`min-h-48 rounded-xl border bg-card px-4 py-3 text-base text-foreground ${
          message ? 'border-destructive' : 'border-input'
        }`}
      />
      <Text className="self-end text-sm text-muted-foreground">{ui.count(draft.length, MAX_JOURNAL_CHARS)}</Text>

      {saving ? (
        <Text className="text-base text-muted-foreground" accessibilityLiveRegion="polite">
          {ui.saving}
        </Text>
      ) : null}
      {message && !saving ? (
        <Text className="text-sm text-destructive" accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
    </View>
  );
}

function EntryCard({
  ui,
  crisisLabels,
  lang,
  entry,
  reply,
  onDelete,
}: {
  ui: JournalUi;
  crisisLabels: CrisisHelpLabels;
  lang: LanguageCode;
  entry: JournalEntry;
  reply: ReplyState | undefined;
  onDelete: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const time = formatPhTime(entry.written_at);

  const doDelete = async () => {
    setDeleting(true);
    setDeleteError(false);
    try {
      await onDelete(); // on success this card unmounts
    } catch {
      setDeleting(false);
      setDeleteError(true);
    }
  };

  return (
    <View className="gap-4">
      <View className="gap-3 rounded-3xl border border-border bg-card p-5">
        {entry.prompt_text ? <Text className="text-sm font-medium text-muted-foreground">{entry.prompt_text}</Text> : null}
        <Text className="text-base text-foreground">{entry.body ?? ui.unreadable}</Text>
        {time ? <Text className="text-sm text-muted-foreground">{ui.writtenAt(time)}</Text> : null}
      </View>

      <ReplyArea ui={ui} crisisLabels={crisisLabels} lang={lang} entry={entry} reply={reply} />

      {confirming ? (
        <View className="gap-3 rounded-3xl border border-destructive p-4">
          <Text className="text-base text-foreground">{ui.deleteConfirm}</Text>
          <Button title={ui.deleteYes} onPress={doDelete} loading={deleting} />
          <Button title={ui.deleteNo} variant="secondary" onPress={() => setConfirming(false)} disabled={deleting} />
          {deleteError ? <Text className="text-sm text-destructive">{ui.deleteError}</Text> : null}
        </View>
      ) : (
        <Button title={ui.delete} variant="ghost" onPress={() => setConfirming(true)} />
      )}
    </View>
  );
}

/** The reply spot: the AI note, or in a crisis the fixed, clinician-approved help (never AI-written). */
function ReplyArea({
  ui,
  crisisLabels,
  lang,
  entry,
  reply,
}: {
  ui: JournalUi;
  crisisLabels: CrisisHelpLabels;
  lang: LanguageCode;
  entry: JournalEntry;
  reply: ReplyState | undefined;
}) {
  if (reply?.kind === 'recovered') return <Note text={ui.recovered} />;
  if (reply?.kind === 'response') {
    const r = reply.response;
    if (r.ai_status === 'crisis') {
      return (
        <View className="rounded-3xl border-2 border-primary bg-card p-5">
          <CrisisHelp crisis={r.crisis ?? getFallbackCrisis(lang)} labels={crisisLabels} />
        </View>
      );
    }
    if (r.ai_status === 'unavailable') return <Note text={ui.unavailable} />;
    if (r.ai_status === 'no_consent') return null; // by design: nothing extra
  }
  const reflection = reply?.kind === 'response' ? reply.response.reflection ?? entry.reflection : entry.reflection;
  if (!reflection) return null;
  return (
    <View className="gap-2 rounded-3xl bg-secondary p-5" accessibilityLiveRegion="polite">
      <Text className="text-sm font-medium text-muted-foreground">{ui.replyTitle}</Text>
      <Text className="text-base text-foreground">{reflection.message}</Text>
      {reflection.nudge ? <Text className="text-base italic text-foreground">{reflection.nudge}</Text> : null}
    </View>
  );
}

function Note({ text }: { text: string }) {
  return <Text className="text-base text-muted-foreground">{text}</Text>;
}

/** Always on the page, so help is one tap away even if a crisis answer never arrived. */
function HelpToggle({ ui, lang, labels }: { ui: JournalUi; lang: LanguageCode; labels: CrisisHelpLabels }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="gap-3 pt-4">
      <Button title={open ? ui.helpHide : ui.helpLink} variant="ghost" onPress={() => setOpen((o) => !o)} />
      {open ? (
        <View className="rounded-3xl border border-border bg-card p-5">
          <CrisisHelp crisis={getFallbackCrisis(lang)} labels={labels} />
        </View>
      ) : null}
    </View>
  );
}
