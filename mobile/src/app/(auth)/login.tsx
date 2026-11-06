import { AuthForm } from '@/components/auth-form';
import { useAuth } from '@/lib/auth';

export default function Login() {
  const { signIn } = useAuth();
  return <AuthForm mode="login" onSubmit={signIn} />;
}
