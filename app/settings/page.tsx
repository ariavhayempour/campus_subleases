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

const SECTIONS = [
  { id: 'profile', label: 'Profile' },
  { id: 'blocked', label: 'Blocked users' },
  { id: 'delete', label: 'Delete account' },
];

export default async function SettingsPage() {
  const actor = await requireOnboardedUser();
  const blocked = await listBlockedUsers(actor);
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <h1 className="varsity text-[clamp(2.75rem,6vw,4rem)] font-black text-ink">Settings</h1>
      <div className="mt-8 grid gap-8 md:grid-cols-[200px_1fr] lg:gap-12">
        <nav aria-label="Settings sections" className="md:sticky md:top-6 md:self-start">
          <ul className="flex gap-1 overflow-x-auto md:flex-col">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded-md px-3 py-2 text-sm font-semibold whitespace-nowrap text-ink no-underline hover:bg-surface-2"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="grid max-w-[44rem] gap-6">
          <section
            id="profile"
            aria-labelledby="profile-heading"
            className="scroll-mt-6 rounded-md border border-line p-5 sm:p-6"
          >
            <h2 id="profile-heading" className="varsity text-[1.625rem] font-extrabold text-ink">
              Name, email, and password
            </h2>
            <p className="mt-2 text-sm text-ink-2">Managed by your account profile</p>
            <div className="mt-4">
              <ProfileButton />
            </div>
          </section>
          <section
            id="blocked"
            aria-labelledby="blocked-heading"
            className="scroll-mt-6 rounded-md border border-line p-5 sm:p-6"
          >
            <h2 id="blocked-heading" className="varsity text-[1.625rem] font-extrabold text-ink">
              Blocked users
            </h2>
            <p className="mt-2 text-sm text-ink-2">
              Blocked users can&apos;t message you, and you won&apos;t see each other&apos;s
              listings.
            </p>
            <div className="mt-4">
              <BlockedUsersList
                users={blocked.map((row) => ({
                  id: row.id,
                  displayName: row.displayName,
                  blockedAt: row.blockedAt.toISOString(),
                }))}
              />
            </div>
          </section>
          <section
            id="delete"
            aria-labelledby="delete-heading"
            className="scroll-mt-6 rounded-md border border-bad/30 bg-bad-bg/50 p-5 sm:p-6"
          >
            <h2 id="delete-heading" className="varsity text-[1.625rem] font-extrabold text-bad">
              Delete account
            </h2>
            <p className="mt-2 max-w-[60ch] text-sm text-ink-2">
              This permanently deletes your listings, photos, and favorites. Your messages stay
              visible to the people you talked to, shown as &quot;Deleted user&quot;.
            </p>
            <div className="mt-4">
              <DeleteAccountForm />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
