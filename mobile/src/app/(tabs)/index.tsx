import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { BrandLockup } from '@/components/brand';
import { MoodGate } from '@/components/mood-gate';
import { Card } from '@/components/ui/card';
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
    <Screen footer={<Button title="Log out" variant="ghost" onPress={handleSignOut} />}>
      {/* Returning users: the daily mood dialog shows here once a day. First-timers meet it in Journal. */}
      <MoodGate where="home" />
      <BrandLockup />
      <View className="gap-2 pt-4">
        <Text className="text-base font-medium text-primary">{greeting()}</Text>
        <Text className="text-4xl font-bold tracking-tight text-foreground">{name}</Text>
        <Text className="text-base leading-6 text-muted-foreground">
          Be gentle with yourself today. Whenever you are ready, the Journal tab is a quiet place to
          put your thoughts down.
        </Text>
      </View>
      {USE_MOCK ? null : <AssessmentCard />}
    </Screen>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 18) return 'Good afternoon,';
  return 'Good evening,';
}

function AssessmentCard() {
  const router = useRouter();
  const { ui } = useAssessmentUi();
  const { state, retry } = useAssessmentStatus();
  const open = () => router.push('/assessment');

  return (
    <Card>
      <Text className="text-xl font-semibold text-foreground">{ui.home.title}</Text>

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
    </Card>
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
