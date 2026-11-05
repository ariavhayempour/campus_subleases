import { and, asc, desc, eq } from 'drizzle-orm';
import { AUDIT_LIST_LIMIT } from '@/lib/moderation-options';
import { db, type DbExecutor } from '@/server/db/client';
import { adminAuditLog, users, type adminAction } from '@/server/db/schema';
import { requireAdmin, type Actor } from './actor';

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

export type AuditEntry = {
  id: string;
  createdAt: Date;
  adminName: string | null; // null = system action or a deleted admin
  adminId: string | null;
  action: AdminAction;
  targetType: string;
  targetId: string;
  snapshot: Record<string, unknown> | null;
};

const auditSelect = {
  id: adminAuditLog.id,
  createdAt: adminAuditLog.createdAt,
  adminName: users.displayName,
  adminId: adminAuditLog.adminId,
  action: adminAuditLog.action,
  targetType: adminAuditLog.targetType,
  targetId: adminAuditLog.targetId,
  snapshot: adminAuditLog.snapshot,
};

type AuditRow = Omit<AuditEntry, 'snapshot'> & { snapshot: unknown };

const toEntry = (row: AuditRow): AuditEntry => ({
  ...row,
  snapshot: (row.snapshot as Record<string, unknown> | null) ?? null,
});

export async function listAuditLog(actor: Actor): Promise<AuditEntry[]> {
  requireAdmin(actor);
  const rows = await db()
    .select(auditSelect)
    .from(adminAuditLog)
    .leftJoin(users, eq(users.id, adminAuditLog.adminId))
    .orderBy(desc(adminAuditLog.createdAt), desc(adminAuditLog.id))
    .limit(AUDIT_LIST_LIMIT);
  return rows.map(toEntry);
}

// Oldest first; callers are admin services that have already checked the actor.
export async function listAuditFor(
  targetType: AuditTargetType,
  targetId: string,
  executor: DbExecutor = db(),
): Promise<AuditEntry[]> {
  const rows = await executor
    .select(auditSelect)
    .from(adminAuditLog)
    .leftJoin(users, eq(users.id, adminAuditLog.adminId))
    .where(and(eq(adminAuditLog.targetType, targetType), eq(adminAuditLog.targetId, targetId)))
    .orderBy(asc(adminAuditLog.createdAt), asc(adminAuditLog.id));
  return rows.map(toEntry);
}
