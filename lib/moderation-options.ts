import type { AuditEntry } from '@/server/services/audit';

export const REPORT_TARGET_TYPES = ['user', 'listing', 'message'] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];
export const REPORT_REASONS = ['scam', 'spam', 'inappropriate', 'harassment', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  scam: 'Scam or fraud',
  spam: 'Spam',
  inappropriate: 'Inappropriate content',
  harassment: 'Harassment',
  other: 'Something else',
};
export const REPORT_STATUS_LABELS = { open: 'Open', resolved: 'Resolved' } as const;
export const REPORT_TARGET_LABELS: Record<ReportTargetType, string> = {
  user: 'User',
  listing: 'Listing',
  message: 'Message',
};
export const USER_STATUS_LABELS = { active: 'Active', banned: 'Banned' } as const;
export const REVIEW_STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  hidden: 'Hidden',
} as const;
export const REPORT_DETAILS_MAX = 1000;
export const MAX_REPORTS_PER_DAY = 20;
export const AUTO_HIDE_REPORTERS = 3;
export const ADMIN_NOTE_MAX = 1000;
export const ADMIN_LIST_LIMIT = 100;
export const AUDIT_LIST_LIMIT = 200;
export const ADMIN_THREAD_LIMIT = 1000;
export const CONFIRM_WORD = 'DELETE';
export const REPORT_SENT = "Thanks. We'll review your report.";
export const REPORT_DUPLICATE = "You've already reported this. We'll review it soon.";
export const REPORT_RATE_LIMITED = 'You can send up to 20 reports a day. Try again tomorrow.';
export const STALE_REVIEW = 'This listing was edited — reload to review the new version';
export const REVIEW_STATE_CHANGED = "This listing's review status changed — reload";

// Only the auto-hide is written without an admin; any other null admin was deleted.
export function auditActorLabel(entry: Pick<AuditEntry, 'adminName' | 'action'>): string {
  if (entry.adminName) return entry.adminName;
  return entry.action === 'auto_hid_listing' ? 'System' : 'Deleted admin';
}
