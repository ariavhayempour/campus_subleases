import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt } from './columns';
import { adminAction, reportReason, reportStatus, reportTargetType } from './enums';
import { users } from './users';

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterId: text('reporter_id').references(() => users.id, { onDelete: 'set null' }),
    targetType: reportTargetType('target_type').notNull(),
    targetId: text('target_id').notNull(),
    reason: reportReason('reason').notNull(),
    details: text('details'),
    status: reportStatus('status').notNull().default('open'),
    resolvedBy: text('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionNote: text('resolution_note'),
    createdAt: createdAt(),
  },
  (t) => [
    index('reports_reporter').on(t.reporterId, t.createdAt),
    index('reports_queue').on(t.status, t.createdAt),
    index('reports_target').on(t.targetType, t.targetId, t.createdAt),
    uniqueIndex('reports_open_unique')
      .on(t.reporterId, t.targetType, t.targetId)
      .where(sql`${t.status} = 'open'`),
    check('reports_details_length', sql`char_length(${t.details}) <= 1000`),
  ],
).enableRLS();

export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: text('admin_id').references(() => users.id, { onDelete: 'set null' }),
    action: adminAction('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    snapshot: jsonb('snapshot'),
    createdAt: createdAt(),
  },
  (t) => [
    index('admin_audit_log_created').on(t.createdAt),
    index('admin_audit_log_target').on(t.targetType, t.targetId, t.createdAt),
  ],
).enableRLS();
