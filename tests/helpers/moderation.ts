import { db } from '@/server/db/client';
import type { AdminAction } from '@/server/services/audit';
import type { ReportReason, ReportTargetType } from '@/lib/moderation-options';
import { adminAuditLog, reports } from '@/server/db/schema';

export async function insertReport(values: {
  reporterId: string | null;
  targetType: ReportTargetType;
  targetId: string;
  reason?: ReportReason;
  status?: 'open' | 'resolved';
  createdAt?: Date;
}): Promise<typeof reports.$inferSelect> {
  const [row] = await db()
    .insert(reports)
    .values({ reason: 'spam', ...values })
    .returning();
  return row;
}

export async function insertAudit(
  values: Partial<typeof adminAuditLog.$inferInsert> & {
    action: AdminAction;
    targetType: string;
    targetId: string;
  },
): Promise<void> {
  await db().insert(adminAuditLog).values(values);
}
