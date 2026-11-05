import type { DbExecutor } from '@/server/db/client';
import { adminAuditLog, type adminAction } from '@/server/db/schema';

export type AdminAction = (typeof adminAction.enumValues)[number];
export type AuditTargetType = 'listing' | 'user' | 'report' | 'conversation';

// Runs on the caller's executor so the audit row commits or rolls back with the action.
export async function writeAudit(
  executor: DbExecutor,
  entry: {
    adminId: string | null;
    action: AdminAction;
    targetType: AuditTargetType;
    targetId: string;
    snapshot?: Record<string, unknown>;
  },
): Promise<void> {
  await executor.insert(adminAuditLog).values(entry);
}
