import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/server/db/client';
import {
  adminAuditLog,
  blocks,
  conversations,
  favorites,
  listingPhotos,
  listings,
  reports,
  users,
} from '@/server/db/schema';
import { deleteClerkAccount } from '@/server/clerk/users';
import { ANONYMOUS } from '@/server/services/actor';
import { deleteAccount } from '@/server/services/account';
import { Forbidden, ValidationError } from '@/server/services/errors';
import { withRollback } from '../helpers/db';
import {
  actorFor,
  createSchool,
  createUser,
  insertListing,
  insertPhoto,
} from '../helpers/fixtures';
import { insertConversation } from '../helpers/messaging';
import { insertAudit, insertReport } from '../helpers/moderation';

vi.mock('@/server/clerk/users', () => ({
  deleteClerkAccount: vi.fn(),
  getClerkAccount: vi.fn(),
  setClerkBan: vi.fn(),
}));
vi.mock('@/server/services/photos', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/services/photos')>()),
  deleteProcessedPhotos: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.mocked(deleteClerkAccount).mockReset();
  vi.mocked(deleteClerkAccount).mockResolvedValue(undefined);
});

describe('deleteAccount', () => {
  it('deletes the Clerk user, then the local user and their listings', () =>
    withRollback(async () => {
      const me = await createUser();
      const other = await createUser();
      const school = await createSchool();
      const listing = await insertListing(me.id, school.id);
      await insertPhoto(listing.id, 0);
      const otherListing = await insertListing(other.id, school.id);
      await db().insert(favorites).values({ userId: me.id, listingId: otherListing.id });
      await db().insert(blocks).values({ blockerId: me.id, blockedId: other.id });
      await db().insert(blocks).values({ blockerId: other.id, blockedId: me.id });
      const report = await insertReport({
        reporterId: me.id,
        targetType: 'listing',
        targetId: otherListing.id,
      });
      await insertAudit({
        adminId: me.id,
        action: 'hid_listing',
        targetType: 'listing',
        targetId: otherListing.id,
      });
      const conversation = await insertConversation({
        listingId: otherListing.id,
        hostId: other.id,
        renterId: me.id,
      });

      await deleteAccount(actorFor(me.id), { confirm: 'DELETE' });

      expect(deleteClerkAccount).toHaveBeenCalledWith(me.id);
      expect(await db().select().from(users).where(eq(users.id, me.id))).toHaveLength(0);
      expect(await db().select().from(listings).where(eq(listings.id, listing.id))).toHaveLength(0);
      expect(
        await db().select().from(listingPhotos).where(eq(listingPhotos.listingId, listing.id)),
      ).toHaveLength(0);
      expect(await db().select().from(favorites).where(eq(favorites.userId, me.id))).toHaveLength(
        0,
      );
      expect(await db().select().from(blocks).where(eq(blocks.blockerId, me.id))).toHaveLength(0);
      expect(await db().select().from(blocks).where(eq(blocks.blockedId, me.id))).toHaveLength(0);
      const [keptReport] = await db().select().from(reports).where(eq(reports.id, report.id));
      expect(keptReport).toBeDefined();
      expect(keptReport.reporterId).toBeNull();
      const keptAudit = await db()
        .select()
        .from(adminAuditLog)
        .where(eq(adminAuditLog.targetId, otherListing.id));
      expect(keptAudit).toHaveLength(1);
      expect(keptAudit[0].adminId).toBeNull();
      const [kept] = await db()
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversation.id));
      expect(kept?.renterId).toBeNull();
      expect(kept?.hostId).toBe(other.id);
    }));

  it('requires the confirmation word', () =>
    withRollback(async () => {
      const me = await createUser();
      const error = await deleteAccount(actorFor(me.id), { confirm: 'delete' }).catch((e) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).fieldErrors.confirm).toEqual(['Type DELETE to confirm']);
      expect(deleteClerkAccount).not.toHaveBeenCalled();
    }));

  it('changes nothing locally when Clerk fails', () =>
    withRollback(async () => {
      const me = await createUser();
      vi.mocked(deleteClerkAccount).mockRejectedValue(new Error('clerk down'));
      await expect(deleteAccount(actorFor(me.id), { confirm: 'DELETE' })).rejects.toThrow(
        'clerk down',
      );
      expect(await db().select().from(users).where(eq(users.id, me.id))).toHaveLength(1);
    }));

  it('requires sign-in', async () => {
    await expect(deleteAccount(ANONYMOUS, { confirm: 'DELETE' })).rejects.toBeInstanceOf(Forbidden);
    expect(deleteClerkAccount).not.toHaveBeenCalled();
  });
});
