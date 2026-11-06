import { CurrentLink } from '@/app/_components/header-nav';
import { getActor } from '@/server/auth/get-actor';
import { getAdminCounts } from '@/server/services/admin-listings';

export async function AdminNavLink({ className }: { className?: string }) {
  const actor = await getActor();
  if (actor.kind !== 'user' || !actor.isAdmin) return null;
  const { pendingListings, openReports } = await getAdminCounts(actor);
  const total = pendingListings + openReports;
  return (
    <CurrentLink
      href="/admin"
      prefetch={false}
      aria-label={total > 0 ? `Admin, ${total} to review` : undefined}
      className={className}
    >
      Admin
      {total > 0 && (
        <span
          aria-hidden="true"
          className="numeral min-w-[19px] rounded-full bg-highlight px-1.5 pt-0.5 text-center text-xs text-on-highlight"
        >
          {total}
        </span>
      )}
    </CurrentLink>
  );
}
