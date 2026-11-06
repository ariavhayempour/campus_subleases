import { SignIn } from '@clerk/nextjs';
import { AuthShell } from '@/app/_components/auth-shell';

export default function SignInPage() {
  return (
    <AuthShell heading="Welcome back.">
      <SignIn />
    </AuthShell>
  );
}
