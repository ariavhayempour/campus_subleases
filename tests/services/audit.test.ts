import { describe, expect, it } from 'vitest';
import { AUDIT_LIST_LIMIT } from '@/lib/moderation-options';
import { ANONYMOUS } from '@/server/services/actor';
import { listAuditLog } from '@/server/services/audit';
import { Forbidden } from '@/server/services/errors';
import { withRollback } from '../helpers/db';
import { actorFor, createUser } from '../helpers/fixtures';
import { insertAudit } from '../helpers/moderation';

const MINUTE = 60_000;

describe('listAuditLog', () => {
  it('lists the newest 200 entries with admin names; system rows have a null admin', () =>
    withRollback(async () => {
      const admin = await createUser({ displayName: 'Ada A.' });
      const base = Date.now() + 10 * 365 * 24 * 60 * MINUTE;
      for (let i = 0; i < AUDIT_LIST_LIMIT + 5; i += 1) {
        await insertAudit({
          adminId: admin.id,
          action: 'hid_listing',
          targetType: 'listing',
          targetId: `t${i}`,
          createdAt: new Date(base + i * MINUTE),
        });
      }
      await insertAudit({
        adminId: null,
        action: 'auto_hid_listing',
        targetType: 'listing',
        targetId: 'system',
        createdAt: new Date(base + 1000 * MINUTE),
      });

      const entries = await listAuditLog(actorFor(admin.id, true));
      expect(entries).toHaveLength(AUDIT_LIST_LIMIT);
      expect(entries[0]).toMatchObject({ targetId: 'system', adminId: null, adminName: null });
      expect(entries[1]).toMatchObject({
        targetId: `t${AUDIT_LIST_LIMIT + 4}`,
        adminId: admin.id,
        adminName: 'Ada A.',
      });
      expect(entries[0].createdAt.getTime()).toBeGreaterThan(entries[1].createdAt.getTime());
    }));

  it('admins only', async () => {
    await withRollback(async () => {
      const user = await createUser();
      await expect(listAuditLog(actorFor(user.id))).rejects.toBeInstanceOf(Forbidden);
      await expect(listAuditLog(ANONYMOUS)).rejects.toBeInstanceOf(Forbidden);
    });
  });
});
