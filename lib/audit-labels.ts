import type { AdminAction } from '@/server/services/audit';

export const ACTION_LABELS: Record<AdminAction, string> = {
  approved_listing: 'Approved listing',
  rejected_listing: 'Rejected listing',
  hid_listing: 'Hid listing',
  auto_hid_listing: 'Auto-hid listing',
  unhid_listing: 'Unhid listing',
  deleted_listing: 'Deleted listing',
  resolved_report: 'Resolved report',
  banned_user: 'Banned user',
  unbanned_user: 'Unbanned user',
  viewed_conversation: 'Viewed conversation',
};

export function summarizeSnapshot(snapshot: Record<string, unknown> | null): string {
  if (!snapshot) return '';
  return Object.entries(snapshot)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(', ');
}
