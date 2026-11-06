import { SignUp } from '@clerk/nextjs';
import { AuthShell } from '@/app/_components/auth-shell';

export default function SignUpPage() {
  return (
    <AuthShell heading="Find your next place.">
      <SignUp forceRedirectUrl="/onboarding" />
    </AuthShell>
  );
}
