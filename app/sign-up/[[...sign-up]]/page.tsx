import { SignUp } from '@clerk/nextjs';
import { AuthShell } from '@/app/_components/auth-shell';
import { onboardingUrl, safeReturnPath } from '@/lib/return-path';

export default async function SignUpPage({ searchParams }: PageProps<'/sign-up/[[...sign-up]]'>) {
  // Clerk's redirect_url (set by sign-up buttons) rides through onboarding so new users land back.
  const returnPath = safeReturnPath((await searchParams).redirect_url);
  return (
    <AuthShell heading="Find your next place.">
      <SignUp forceRedirectUrl={onboardingUrl(returnPath)} />
    </AuthShell>
  );
}
