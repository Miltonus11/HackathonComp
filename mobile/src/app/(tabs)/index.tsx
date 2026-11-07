import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { MoodGate } from '@/components/mood-gate';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import type { SessionSummary } from '@/domain/screening';
import { useAssessmentUi } from '@/lib/use-assessment-ui';
import { useAssessmentStatus } from '@/lib/use-assessment-status';
import { useAuth } from '@/lib/auth';
import { USE_MOCK } from '@/services/config';

export default function Home() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  // Only the username is ever shown; real names are not available to the UI.
  const name = session?.identity.display_name || 'there';

  const handleSignOut = async () => {
    await signOut();
    // The guard has swapped to the auth screens; leave the stale "/" URL behind.
    router.replace('/welcome');
  };

  return (
    <Screen footer={<Button title="Log out" variant="secondary" onPress={handleSignOut} />}>
      {/* Returning users: the daily mood dialog shows here once a day. First-timers meet it in Journal. */}
      <MoodGate where="home" />
      <View className="gap-2 pt-6">
        <Text className="text-3xl font-bold text-foreground">Hello, {name}</Text>
        <Text className="text-base text-muted-foreground">
          Your account is ready. Mood check-ins and the journal are coming next.
        </Text>
      </View>
      {USE_MOCK ? null : <AssessmentCard />}
    </Screen>
  );
}

function AssessmentCard() {
  const router = useRouter();
  const { ui } = useAssessmentUi();
  const { state, retry } = useAssessmentStatus();
  const open = () => router.push('/assessment');

  return (
    <View className="gap-3 rounded-2xl border border-border bg-card p-5">
      <Text className="text-lg font-semibold text-foreground">{ui.home.title}</Text>

      {state.phase === 'loading' ? <Text className="text-base text-muted-foreground">{ui.home.loading}</Text> : null}

      {state.phase === 'error' ? (
        <>
          <Text className="text-base text-muted-foreground">{ui.home.loadError}</Text>
          <Button title={ui.home.retry} variant="secondary" onPress={retry} />
        </>
      ) : null}

      {state.phase === 'ready' && state.status.kind === 'none' ? (
        <>
          <Text className="text-base text-muted-foreground">{ui.home.none}</Text>
          <Button title={ui.home.start} onPress={open} />
        </>
      ) : null}

      {state.phase === 'ready' && state.status.kind === 'unfinished' ? (
        <>
          <Text className="text-base text-muted-foreground">{ui.home.unfinished}</Text>
          <Button title={ui.home.continue} onPress={open} />
        </>
      ) : null}

      {state.phase === 'ready' && state.status.kind === 'done' ? (
        <DoneSummary last={state.status.last} onAgain={open} />
      ) : null}
    </View>
  );
}

function DoneSummary({ last, onAgain }: { last: SessionSummary; onAgain: () => void }) {
  const { ui } = useAssessmentUi();
  const date = new Date(last.completed_at ?? last.started_at).toLocaleDateString();

  return (
    <>
      <Text className="text-base text-muted-foreground">{ui.home.lastDone(date)}</Text>
      <ViewResultsButton sessionId={last.session_id} label={ui.home.viewResults} />
      <Button title={ui.home.again} variant="secondary" onPress={onAgain} />
    </>
  );
}

function ViewResultsButton({ sessionId, label }: { sessionId: string; label: string }) {
  const router = useRouter();
  // Results open on the assessment screens, which load the session themselves.
  return (
    <Button
      title={label}
      onPress={() => router.push({ pathname: '/assessment/results', params: { session: sessionId } })}
    />
  );
}
