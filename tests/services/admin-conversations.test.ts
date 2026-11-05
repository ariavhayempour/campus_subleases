import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '@/server/db/client';
import { adminAuditLog, listings, users } from '@/server/db/schema';
import { getAdminConversation } from '@/server/services/admin-conversations';
import { Forbidden, NotFound } from '@/server/services/errors';
import { withRollback } from '../helpers/db';
import { actorFor, createUser } from '../helpers/fixtures';
import { insertConversation, insertMessage, liveListing } from '../helpers/messaging';

const auditRows = (targetId: string) =>
  db().select().from(adminAuditLog).where(eq(adminAuditLog.targetId, targetId));

describe('getAdminConversation', () => {
  it('admins only', () =>
    withRollback(async () => {
      const { owner, listing } = await liveListing();
      const renter = await createUser();
      const convo = await insertConversation({
        listingId: listing.id,
        hostId: owner.id,
        renterId: renter.id,
      });
      await expect(getAdminConversation(actorFor(renter.id), convo.id)).rejects.toBeInstanceOf(
        Forbidden,
      );
      expect(await auditRows(convo.id)).toHaveLength(0);
    }));

  it('returns both participants, the unit, and all messages; logs each view', () =>
    withRollback(async () => {
      const { owner, listing } = await liveListing();
      await db().update(listings).set({ unit: '4B' }).where(eq(listings.id, listing.id));
      const renter = await createUser();
      const admin = await createUser();
      const convo = await insertConversation({
        listingId: listing.id,
        hostId: owner.id,
        renterId: renter.id,
      });
      await insertMessage(convo.id, renter.id, 'first', new Date('2026-01-01T00:00:00Z'));
      await insertMessage(convo.id, owner.id, 'second', new Date('2026-01-01T00:01:00Z'));

      const view = await getAdminConversation(actorFor(admin.id, true), convo.id);
      expect(view.host?.id).toBe(owner.id);
      expect(view.renter?.id).toBe(renter.id);
      expect(view.listing).toMatchObject({ id: listing.id, unit: '4B', linkable: true });
      expect(view.messages.map((m) => m.body)).toEqual(['first', 'second']);
      expect(view.truncated).toBe(false);

      await getAdminConversation(actorFor(admin.id, true), convo.id);
      const rows = await auditRows(convo.id);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        action: 'viewed_conversation',
        targetType: 'conversation',
        adminId: admin.id,
      });
    }));

  it('handles deleted participants and listings', () =>
    withRollback(async () => {
      const { owner, listing } = await liveListing();
      const renter = await createUser();
      const admin = await createUser();
      const convo = await insertConversation({
        listingId: listing.id,
        hostId: owner.id,
        renterId: renter.id,
      });
      await insertMessage(convo.id, renter.id, 'hello');
      await db().delete(users).where(eq(users.id, renter.id));
      await db().delete(listings).where(eq(listings.id, listing.id));
      const view = await getAdminConversation(actorFor(admin.id, true), convo.id);
      expect(view.renter).toBeNull();
      expect(view.listing).toBeNull();
      expect(view.host?.id).toBe(owner.id);
      expect(view.messages).toHaveLength(1);
    }));

  it('caps at the latest 1,000 messages', () =>
    withRollback(async () => {
      const { owner, listing } = await liveListing();
      const renter = await createUser();
      const admin = await createUser();
      const convo = await insertConversation({
        listingId: listing.id,
        hostId: owner.id,
        renterId: renter.id,
      });
      const base = Date.UTC(2026, 0, 1);
      for (let i = 0; i < 1001; i += 1) {
        await insertMessage(convo.id, renter.id, `m${i}`, new Date(base + i * 1000));
      }
      const view = await getAdminConversation(actorFor(admin.id, true), convo.id);
      expect(view.messages).toHaveLength(1000);
      expect(view.truncated).toBe(true);
      expect(view.messages[0].body).toBe('m1');
      expect(view.messages[999].body).toBe('m1000');
    }));

  it('rejects unknown or malformed ids without logging', () =>
    withRollback(async () => {
      const admin = await createUser();
      const missing = '00000000-0000-4000-8000-000000000000';
      await expect(getAdminConversation(actorFor(admin.id, true), missing)).rejects.toBeInstanceOf(
        NotFound,
      );
      await expect(getAdminConversation(actorFor(admin.id, true), 'nope')).rejects.toBeInstanceOf(
        NotFound,
      );
      expect(await auditRows(missing)).toHaveLength(0);
    }));

  it('does not truncate at exactly 1,000 messages', () =>
    withRollback(async () => {
      const { owner, listing } = await liveListing();
      const renter = await createUser();
      const admin = await createUser();
      const convo = await insertConversation({
        listingId: listing.id,
        hostId: owner.id,
        renterId: renter.id,
      });
      const base = Date.UTC(2026, 0, 1);
      for (let i = 0; i < 1000; i += 1) {
        await insertMessage(convo.id, renter.id, `m${i}`, new Date(base + i * 1000));
      }
      const view = await getAdminConversation(actorFor(admin.id, true), convo.id);
      expect(view.messages).toHaveLength(1000);
      expect(view.truncated).toBe(false);
      expect(view.messages[0].body).toBe('m0');
    }));
});
