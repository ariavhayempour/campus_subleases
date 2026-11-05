import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/server/db/client';
import { adminAuditLog, users } from '@/server/db/schema';
import { getClerkAccount, setClerkBan, type ClerkAccount } from '@/server/clerk/users';
import { ANONYMOUS } from '@/server/services/actor';
import { banUser, getAdminUser, unbanUser } from '@/server/services/admin-users';
import { Forbidden, NotFound, ValidationError } from '@/server/services/errors';
import { searchListings } from '@/server/services/search';
import { withRollback } from '../helpers/db';
import { actorFor, createSchool, createUser, insertListing } from '../helpers/fixtures';
import { insertConversation, insertMessage } from '../helpers/messaging';
import { insertAudit, insertReport } from '../helpers/moderation';

vi.mock('@/server/clerk/users', () => ({
  getClerkAccount: vi.fn(),
  setClerkBan: vi.fn(),
  deleteClerkAccount: vi.fn(),
}));

const account = (id: string, overrides: Partial<ClerkAccount> = {}): ClerkAccount => ({
  id,
  firstName: 'Test',
  lastName: 'Tester',
  banned: false,
  isAdmin: false,
  ...overrides,
});

beforeEach(() => {
  vi.mocked(getClerkAccount).mockReset();
  vi.mocked(setClerkBan).mockReset();
});

const auditRows = (targetId: string) =>
  db().select().from(adminAuditLog).where(eq(adminAuditLog.targetId, targetId));

const statusOf = async (id: string) =>
  (await db().select().from(users).where(eq(users.id, id)))[0]?.status;

describe('banUser', () => {
  it('admins only', () =>
    withRollback(async () => {
      const target = await createUser();
      const input = { userId: target.id };
      await expect(banUser(ANONYMOUS, input)).rejects.toBeInstanceOf(Forbidden);
      await expect(banUser(actorFor(target.id), input)).rejects.toBeInstanceOf(Forbidden);
      await expect(unbanUser(actorFor(target.id), input)).rejects.toBeInstanceOf(Forbidden);
      await expect(getAdminUser(actorFor(target.id), target.id)).rejects.toBeInstanceOf(Forbidden);
      expect(setClerkBan).not.toHaveBeenCalled();
    }));

  it('validates the input', () =>
    withRollback(async () => {
      const admin = await createUser();
      await expect(banUser(actorFor(admin.id, true), {})).rejects.toBeInstanceOf(ValidationError);
    }));

  it('bans through Clerk and mirrors the status immediately', () =>
    withRollback(async () => {
      const admin = await createUser();
      const target = await createUser();
      const school = await createSchool();
      await insertListing(target.id, school.id, { reviewStatus: 'approved' });
      const publicTitles = async () =>
        (await searchListings(ANONYMOUS, { schoolId: school.id, filters: {} })).cards.length;
      expect(await publicTitles()).toBe(1);
      vi.mocked(getClerkAccount).mockResolvedValue(account(target.id));
      vi.mocked(setClerkBan).mockResolvedValue(account(target.id, { banned: true }));

      await banUser(actorFor(admin.id, true), { userId: target.id });

      expect(setClerkBan).toHaveBeenCalledWith(target.id, true);
      expect(await statusOf(target.id)).toBe('banned');
      expect(await publicTitles()).toBe(0);
      const [row] = await auditRows(target.id);
      expect(row).toMatchObject({
        action: 'banned_user',
        targetType: 'user',
        adminId: admin.id,
        snapshot: { displayName: 'Test T.' },
      });
    }));

  it('unbans the same way', () =>
    withRollback(async () => {
      const admin = await createUser();
      const target = await createUser({ status: 'banned' });
      vi.mocked(getClerkAccount).mockResolvedValue(account(target.id, { banned: true }));
      vi.mocked(setClerkBan).mockResolvedValue(account(target.id));

      await unbanUser(actorFor(admin.id, true), { userId: target.id });

      expect(setClerkBan).toHaveBeenCalledWith(target.id, false);
      expect(await statusOf(target.id)).toBe('active');
      const [row] = await auditRows(target.id);
      expect(row).toMatchObject({ action: 'unbanned_user', adminId: admin.id });
    }));

  it('refuses self, admin, and missing targets', () =>
    withRollback(async () => {
      const admin = await createUser();
      const other = await createUser();
      const peer = await createUser();
      const actor = actorFor(admin.id, true);

      await expect(banUser(actor, { userId: admin.id })).rejects.toThrow("You can't ban yourself");
      await expect(banUser(actor, { userId: admin.id })).rejects.toBeInstanceOf(Forbidden);

      vi.mocked(getClerkAccount).mockResolvedValueOnce(account(peer.id, { isAdmin: true }));
      await expect(banUser(actor, { userId: peer.id })).rejects.toThrow("Admins can't be banned");

      vi.mocked(getClerkAccount).mockResolvedValueOnce(null);
      await expect(banUser(actor, { userId: other.id })).rejects.toBeInstanceOf(NotFound);

      expect(setClerkBan).not.toHaveBeenCalled();
      expect(await statusOf(other.id)).toBe('active');
      expect(await statusOf(peer.id)).toBe('active');
      for (const id of [admin.id, other.id, peer.id]) expect(await auditRows(id)).toHaveLength(0);
    }));

  it('does not call Clerk or log twice when the state already matches', () =>
    withRollback(async () => {
      const admin = await createUser();
      const target = await createUser();
      vi.mocked(getClerkAccount).mockResolvedValue(account(target.id, { banned: true }));

      await banUser(actorFor(admin.id, true), { userId: target.id });

      expect(setClerkBan).not.toHaveBeenCalled();
      expect(await statusOf(target.id)).toBe('banned');
      expect(await auditRows(target.id)).toHaveLength(0);
    }));

  it('does not change anything locally when Clerk fails', () =>
    withRollback(async () => {
      const admin = await createUser();
      const target = await createUser();
      vi.mocked(getClerkAccount).mockResolvedValue(account(target.id));
      vi.mocked(setClerkBan).mockRejectedValue(new Error('clerk down'));

      await expect(banUser(actorFor(admin.id, true), { userId: target.id })).rejects.toThrow(
        'clerk down',
      );

      expect(await statusOf(target.id)).toBe('active');
      expect(await auditRows(target.id)).toHaveLength(0);
    }));
});

describe('getAdminUser', () => {
  it('returns NotFound for unknown ids', () =>
    withRollback(async () => {
      const admin = await createUser();
      await expect(getAdminUser(actorFor(admin.id, true), 'user_missing')).rejects.toBeInstanceOf(
        NotFound,
      );
    }));

  it('shows listings, conversations, and reports filed and received', () =>
    withRollback(async () => {
      const admin = await createUser();
      const subject = await createUser({ displayName: 'Sam S.' });
      const host = await createUser({ displayName: 'Hope H.' });
      const reporter = await createUser({ displayName: 'Rae R.' });
      const school = await createSchool();
      await db().update(users).set({ homeSchoolId: school.id }).where(eq(users.id, subject.id));
      const mine = await insertListing(subject.id, school.id, { title: 'Sam place' });
      const theirs = await insertListing(host.id, school.id, { title: 'Hope place' });
      const conversation = await insertConversation({
        listingId: theirs.id,
        hostId: host.id,
        renterId: subject.id,
      });
      const message = await insertMessage(conversation.id, subject.id, 'x'.repeat(120));
      await insertReport({ reporterId: subject.id, targetType: 'user', targetId: host.id });
      await insertReport({ reporterId: reporter.id, targetType: 'user', targetId: subject.id });
      await insertReport({ reporterId: reporter.id, targetType: 'listing', targetId: mine.id });
      await insertReport({ reporterId: host.id, targetType: 'message', targetId: message.id });
      await insertReport({ reporterId: host.id, targetType: 'listing', targetId: theirs.id });
      await insertAudit({
        adminId: admin.id,
        action: 'banned_user',
        targetType: 'user',
        targetId: subject.id,
      });
      vi.mocked(getClerkAccount).mockResolvedValue(account(subject.id));

      const view = await getAdminUser(actorFor(admin.id, true), subject.id);

      expect(view).toMatchObject({
        id: subject.id,
        displayName: 'Sam S.',
        status: 'active',
        isAdmin: false,
        homeSchool: { slug: school.slug, name: school.name },
      });
      expect(view.listings.map((l) => l.title)).toEqual(['Sam place']);
      expect(view.conversations).toEqual([
        {
          id: conversation.id,
          role: 'renter',
          listingTitle: 'Hope place',
          otherName: 'Hope H.',
          lastMessageAt: expect.any(Date),
        },
      ]);
      expect(view.reportsFiled).toHaveLength(1);
      expect(view.reportsFiled[0]).toMatchObject({
        targetType: 'user',
        targetLabel: 'Hope H.',
        reporterName: 'Sam S.',
        schoolSlug: null,
      });
      const received = Object.fromEntries(view.reportsReceived.map((r) => [r.targetType, r]));
      expect(view.reportsReceived).toHaveLength(3);
      expect(received.user).toMatchObject({ targetLabel: 'Sam S.', schoolSlug: school.slug });
      expect(received.listing).toMatchObject({ targetLabel: 'Sam place', schoolSlug: school.slug });
      expect(received.message).toMatchObject({
        targetLabel: 'x'.repeat(80),
        schoolSlug: school.slug,
        reporterName: 'Hope H.',
      });
      expect(view.history.map((h) => h.action)).toEqual(['banned_user']);
    }));

  it('falls back to the sender home school when a reported message listing is gone', () =>
    withRollback(async () => {
      const admin = await createUser();
      const sender = await createUser();
      const school = await createSchool();
      await db().update(users).set({ homeSchoolId: school.id }).where(eq(users.id, sender.id));
      const conversation = await insertConversation({
        listingId: null,
        hostId: admin.id,
        renterId: sender.id,
      });
      const message = await insertMessage(conversation.id, sender.id, 'hello');
      await insertReport({ reporterId: admin.id, targetType: 'message', targetId: message.id });
      vi.mocked(getClerkAccount).mockResolvedValue(account(sender.id));

      const view = await getAdminUser(actorFor(admin.id, true), sender.id);

      expect(view.reportsReceived[0]).toMatchObject({ schoolSlug: school.slug });
    }));

  it('labels reports on deleted targets, and reports isAdmin as null without Clerk', () =>
    withRollback(async () => {
      const admin = await createUser();
      const subject = await createUser();
      await insertReport({
        reporterId: subject.id,
        targetType: 'listing',
        targetId: '00000000-0000-4000-8000-000000000000',
      });
      vi.mocked(getClerkAccount).mockRejectedValue(new Error('offline'));

      const view = await getAdminUser(actorFor(admin.id, true), subject.id);

      expect(view.isAdmin).toBeNull();
      expect(view.reportsFiled[0]).toMatchObject({ targetLabel: 'Deleted', schoolSlug: null });
    }));
});
