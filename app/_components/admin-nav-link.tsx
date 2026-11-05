import Link from 'next/link';
import { getActor } from '@/server/auth/get-actor';
import { getAdminCounts } from '@/server/services/admin-listings';

export async function AdminNavLink() {
  const actor = await getActor();
  if (actor.kind !== 'user' || !actor.isAdmin) return null;
  const { pendingListings, openReports } = await getAdminCounts(actor);
  const total = pendingListings + openReports;
  return (
    <Link
      href="/admin"
      prefetch={false}
      aria-label={total > 0 ? `Admin, ${total} to review` : undefined}
      className="flex items-center gap-1.5 hover:underline"
    >
      Admin
      {total > 0 && (
        <span
          aria-hidden="true"
          className="rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground"
        >
          {total}
        </span>
      )}
    </Link>
  );
}
