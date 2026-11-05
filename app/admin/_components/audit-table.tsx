import Link from 'next/link';
import { LocalTime } from '@/app/_components/local-time';
import { ACTION_LABELS, summarizeSnapshot } from '@/lib/audit-labels';
import type { AuditEntry } from '@/server/services/audit';

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
    <Link href={`${base}/${entry.targetId}`} prefetch={false} className="underline">
      {label}
    </Link>
  );
}

export function AuditTable({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Nothing here.</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b text-muted-foreground">
        <tr>
          <th className="py-2 pr-4 font-medium">Time</th>
          <th className="py-2 pr-4 font-medium">Admin</th>
          <th className="py-2 pr-4 font-medium">Action</th>
          <th className="py-2 pr-4 font-medium">Target</th>
          <th className="py-2 font-medium">Details</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.id} className="border-b align-top">
            <td className="py-2 pr-4 whitespace-nowrap">
              <LocalTime iso={entry.createdAt.toISOString()} />
            </td>
            <td className="py-2 pr-4">{entry.adminName ?? 'System'}</td>
            <td className="py-2 pr-4">{ACTION_LABELS[entry.action]}</td>
            <td className="py-2 pr-4">
              <AuditTargetLink entry={entry} />
            </td>
            <td className="py-2 break-words">{summarizeSnapshot(entry.snapshot)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
