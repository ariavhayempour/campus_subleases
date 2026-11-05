import type { Metadata } from 'next';
import { requireOnboardedUser } from '@/app/_lib/guards';
import { listBlockedUsers } from '@/server/services/moderation';
import { BlockedUsersList } from './_components/blocked-users-list';
import { DeleteAccountForm } from './_components/delete-account-form';
import { ProfileButton } from './_components/profile-button';

export const metadata: Metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const actor = await requireOnboardedUser();
  const blocked = await listBlockedUsers(actor);
  return (
    <main className="mx-auto w-full max-w-160 space-y-10 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Name, email, and password</h2>
        <p className="text-sm text-muted-foreground">Managed by your account profile</p>
        <ProfileButton />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Blocked users</h2>
        <BlockedUsersList
          users={blocked.map((row) => ({
            id: row.id,
            displayName: row.displayName,
            blockedAt: row.blockedAt.toISOString(),
          }))}
        />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Delete account</h2>
        <p className="text-sm text-muted-foreground">
          This permanently deletes your listings, photos, and favorites. Your messages stay visible
          to the people you talked to, shown as &quot;Deleted user&quot;.
        </p>
        <DeleteAccountForm />
      </section>
    </main>
  );
}
