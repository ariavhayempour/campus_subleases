import Link from 'next/link';
import { LocalTime } from '@/app/_components/local-time';
import { ACTION_LABELS, summarizeSnapshot } from '@/lib/audit-labels';
import { auditActorLabel } from '@/lib/moderation-options';
import type { AuditEntry } from '@/server/services/audit';
import { Empty, LINK, TABLE, TD, TH } from './admin-ui';

const TARGET_PATHS: Record<string, string> = {
  listing: '/admin/listings',
  user: '/admin/users',
  report: '/admin/reports',
  conversation: '/admin/conversations',
};

function AuditTargetLink({ entry }: { entry: AuditEntry }) {
  const base = TARGET_PATHS[entry.targetType];
  const label = `${entry.targetType} ${entry.targetId.slice(0, 8)}`;
  // A deleted listing has no page left to open.
  if (!base || entry.action === 'deleted_listing') return <span>{label}</span>;
  return (
    <Link href={`${base}/${entry.targetId}`} prefetch={false} className={LINK}>
      {label}
    </Link>
  );
}

export function AuditTable({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return <Empty />;
  return (
    <table className={TABLE}>
      <thead>
        <tr>
          <th className={TH}>Time</th>
          <th className={TH}>Admin</th>
          <th className={TH}>Action</th>
          <th className={TH}>Target</th>
          <th className={TH}>Details</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.id}>
            <td className={`${TD} whitespace-nowrap text-ink-2`}>
              <LocalTime iso={entry.createdAt.toISOString()} />
            </td>
            <td className={TD}>{auditActorLabel(entry)}</td>
            <td className={`${TD} font-semibold`}>{ACTION_LABELS[entry.action]}</td>
            <td className={`${TD} whitespace-nowrap`}>
              <AuditTargetLink entry={entry} />
            </td>
            <td className={`${TD} break-words text-ink-2`}>{summarizeSnapshot(entry.snapshot)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
