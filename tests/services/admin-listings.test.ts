import { and, eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { listingBadges } from '@/lib/listing-rules';
import { REVIEW_STATE_CHANGED, STALE_REVIEW } from '@/lib/moderation-options';
import type { ListingInput } from '@/lib/validation/listing';
import { db } from '@/server/db/client';
import {
  adminAuditLog,
  conversations,
  favorites,
  listingPhotos,
  listings,
} from '@/server/db/schema';
import { ANONYMOUS } from '@/server/services/actor';
import {
  approveListing,
  deleteListingAsAdmin,
  getAdminCounts,
  getAdminListing,
  hideListing,
  listAdminListings,
  rejectListing,
  unhideListing,
} from '@/server/services/admin-listings';
import { Conflict, Forbidden, NotFound, ValidationError } from '@/server/services/errors';
import { listMyListings } from '@/server/services/listing-reads';
import { updateListing } from '@/server/services/listings';
import * as photos from '@/server/services/photos';
import { createReport } from '@/server/services/reports';
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

vi.mock('@/server/services/photos', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/services/photos')>();
  return { ...actual, deleteProcessedPhotos: vi.fn(async () => {}) };
});

const HOUR = 3_600_000;
const DAY = 86_400_000;
const FUTURE = Date.now() + 365 * DAY;
const NOW = Date.now();

async function setup(overrides: Partial<typeof listings.$inferInsert> = {}) {
  const admin = await createUser({ displayName: 'Ada A.' });
  const owner = await createUser({ displayName: 'Olive O.' });
  const school = await createSchool();
  const listing = await insertListing(owner.id, school.id, overrides);
  return { admin, adminActor: actorFor(admin.id, true), owner, school, listing };
}

const rowOf = async (id: string) =>
  (await db().select().from(listings).where(eq(listings.id, id)))[0];
const auditRows = (listingId: string) =>
  db()
    .select()
    .from(adminAuditLog)
    .where(and(eq(adminAuditLog.targetType, 'listing'), eq(adminAuditLog.targetId, listingId)));
const auditCount = async (listingId: string): Promise<number> =>
  (await auditRows(listingId)).length;

async function fieldErrors(promise: Promise<unknown>): Promise<Record<string, string[]>> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ValidationError) return error.fieldErrors;
    throw error;
  }
  throw new Error('Expected ValidationError');
}

describe('admin listing services', () => {
  it('admins only', () =>
    withRollback(async () => {
      const { owner, listing } = await setup();
      const id = listing.id;
      const calls: ((actor: ReturnType<typeof actorFor> | typeof ANONYMOUS) => Promise<unknown>)[] =
        [
          (a) => listAdminListings(a, {}),
          (a) => getAdminListing(a, id),
          (a) => getAdminCounts(a),
          (a) => approveListing(a, { listingId: id, version: 'x' }),
          (a) => rejectListing(a, { listingId: id, version: 'x', note: 'no' }),
          (a) => hideListing(a, { listingId: id }),
          (a) => unhideListing(a, { listingId: id }),
          (a) => deleteListingAsAdmin(a, { listingId: id, confirm: 'DELETE' }),
        ];
      for (const call of calls) {
        await expect(call(actorFor(owner.id))).rejects.toBeInstanceOf(Forbidden);
        await expect(call(ANONYMOUS)).rejects.toBeInstanceOf(Forbidden);
      }
    }));

  it('lists tabs in the specified order and filters by school', () =>
    withRollback(async () => {
      const { adminActor, owner, school, listing: base } = await setup();
      const other = await createSchool();
      const t = (days: number): Date => new Date(FUTURE + days * DAY);
      const older = await insertListing(owner.id, school.id, { title: 'older', createdAt: t(1) });
      const newer = await insertListing(owner.id, school.id, { title: 'newer', createdAt: t(2) });
      await insertListing(owner.id, school.id, {
        title: 'expired',
        availableFrom: '2019-01-01',
        availableTo: '2020-01-01',
      });
      await insertListing(owner.id, school.id, { title: 'taken', status: 'taken' });
      const elsewhere = await insertListing(owner.id, other.id, {
        title: 'elsewhere',
        createdAt: t(3),
      });
      const a1 = await insertListing(owner.id, school.id, {
        reviewStatus: 'approved',
        updatedAt: t(1),
      });
      const a2 = await insertListing(owner.id, school.id, {
        reviewStatus: 'approved',
        updatedAt: t(5),
      });
      const hidden = await insertListing(owner.id, school.id, { reviewStatus: 'hidden' });
      const rejected = await insertListing(owner.id, school.id, {
        reviewStatus: 'rejected',
        reviewNote: 'bad',
      });
      await insertReport({ reporterId: null, targetType: 'listing', targetId: older.id });
      await insertReport({
        reporterId: null,
        targetType: 'listing',
        targetId: older.id,
        status: 'resolved',
      });

      const pending = await listAdminListings(adminActor, { school: school.slug });
      expect(pending.map((r) => r.id)).toEqual([base.id, older.id, newer.id]);
      expect(pending[1]).toMatchObject({
        title: 'older',
        schoolSlug: school.slug,
        schoolName: school.name,
        ownerId: owner.id,
        ownerName: 'Olive O.',
        reviewStatus: 'pending',
        status: 'active',
        autoHidden: false,
        openReports: 1,
      });
      const all = await listAdminListings(adminActor, {});
      expect(await listAdminListings(adminActor, { school: '  ' })).toHaveLength(all.length);
      expect(await listAdminListings(adminActor, { school: '' })).toHaveLength(all.length);
      expect(all.map((r) => r.id)).toContain(elsewhere.id);
      const approved = await listAdminListings(adminActor, { tab: 'approved' });
      expect(approved.map((r) => r.id)).toEqual([a2.id, a1.id]);
      expect((await listAdminListings(adminActor, { tab: 'hidden' })).map((r) => r.id)).toEqual([
        hidden.id,
      ]);
      expect((await listAdminListings(adminActor, { tab: 'rejected' })).map((r) => r.id)).toEqual([
        rejected.id,
      ]);
      expect(
        await listAdminListings(adminActor, { tab: 'approved', school: other.slug }),
      ).toHaveLength(0);
    }));

  it('approves a pending listing and writes an audit row', () =>
    withRollback(async () => {
      const { admin, adminActor, listing } = await setup({
        reviewStatus: 'rejected',
        reviewNote: 'old',
      });
      await db()
        .update(listings)
        .set({ reviewStatus: 'pending' })
        .where(eq(listings.id, listing.id));
      const view = await getAdminListing(adminActor, listing.id);
      await approveListing(adminActor, { listingId: listing.id, version: view.version });
      const row = await rowOf(listing.id);
      expect(row).toMatchObject({
        reviewStatus: 'approved',
        reviewedBy: admin.id,
        reviewNote: null,
      });
      expect(row.reviewedAt).not.toBeNull();
      const audit = await auditRows(listing.id);
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        action: 'approved_listing',
        adminId: admin.id,
        targetType: 'listing',
        targetId: listing.id,
      });
    }));

  it('rejects with a required note shown to the owner', () =>
    withRollback(async () => {
      const { owner, adminActor, listing } = await setup();
      const { version } = await getAdminListing(adminActor, listing.id);
      expect(
        await fieldErrors(rejectListing(adminActor, { listingId: listing.id, version, note: ' ' })),
      ).toEqual({ note: ['Give the owner a reason'] });
      await rejectListing(adminActor, { listingId: listing.id, version, note: 'Blurry photos' });
      expect(await rowOf(listing.id)).toMatchObject({
        reviewStatus: 'rejected',
        reviewNote: 'Blurry photos',
      });
      const [mine] = await listMyListings(actorFor(owner.id));
      expect(listingBadges(mine).map((b) => b.label)).toContain('Rejected: Blurry photos');
      const [audit] = await auditRows(listing.id);
      expect(audit).toMatchObject({
        action: 'rejected_listing',
        snapshot: { note: 'Blurry photos' },
      });
    }));

  it('refuses stale and out-of-state decisions without writing audit rows', () =>
    withRollback(async () => {
      const { owner, adminActor, listing } = await setup();
      const photo = await insertPhoto(listing.id, 0);
      const { version } = await getAdminListing(adminActor, listing.id);
      const input: ListingInput = {
        schoolId: listing.schoolId,
        type: listing.type,
        title: 'Edited title',
        description: listing.description,
        rentDollars: listing.rentCents / 100,
        availableFrom: listing.availableFrom,
        availableTo: listing.availableTo,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        roommatesCount: listing.roommatesCount,
        privateBathroom: listing.privateBathroom,
        genderPreference: listing.genderPreference,
        address: listing.address,
        unit: '',
        city: listing.city,
        state: listing.state,
        zip: listing.zip,
        location: listing.location,
        furnished: listing.furnished,
        amenities: [],
        photos: [{ kind: 'existing', id: photo.id }],
      };
      await updateListing(actorFor(owner.id), listing.id, input);
      const fresh = await getAdminListing(adminActor, listing.id);
      expect(fresh.version).not.toBe(version);

      await expect(approveListing(adminActor, { listingId: listing.id, version })).rejects.toThrow(
        STALE_REVIEW,
      );
      await expect(
        rejectListing(adminActor, { listingId: listing.id, version, note: 'x' }),
      ).rejects.toBeInstanceOf(Conflict);
      await expect(hideListing(adminActor, { listingId: listing.id })).rejects.toThrow(
        REVIEW_STATE_CHANGED,
      );
      await expect(unhideListing(adminActor, { listingId: listing.id })).rejects.toBeInstanceOf(
        Conflict,
      );

      await approveListing(adminActor, { listingId: listing.id, version: fresh.version });
      const before = await auditCount(listing.id);
      const again = await getAdminListing(adminActor, listing.id);
      await expect(
        approveListing(adminActor, { listingId: listing.id, version: again.version }),
      ).rejects.toThrow(REVIEW_STATE_CHANGED);
      await expect(approveListing(adminActor, { listingId: listing.id, version })).rejects.toThrow(
        REVIEW_STATE_CHANGED,
      );
      await expect(unhideListing(adminActor, { listingId: listing.id })).rejects.toBeInstanceOf(
        Conflict,
      );
      await expect(
        approveListing(adminActor, {
          listingId: '00000000-0000-4000-8000-000000000000',
          version: 'x',
        }),
      ).rejects.toBeInstanceOf(NotFound);
      expect(await auditCount(listing.id)).toBe(before);
    }));

  it('hides, confirms an auto-hide, and unhides', () =>
    withRollback(async () => {
      const { adminActor, listing } = await setup({
        reviewStatus: 'approved',
        reviewedAt: new Date(NOW - 3 * DAY),
        reviewNote: 'keep',
      });
      await hideListing(adminActor, { listingId: listing.id });
      expect(await rowOf(listing.id)).toMatchObject({ reviewStatus: 'hidden', reviewNote: 'keep' });
      expect((await getAdminListing(adminActor, listing.id)).autoHidden).toBe(false);

      await insertAudit({
        adminId: null,
        action: 'auto_hid_listing',
        targetType: 'listing',
        targetId: listing.id,
        createdAt: new Date(NOW - 3_600_000),
      });
      await db()
        .update(listings)
        .set({ reviewedAt: new Date(NOW - 2 * DAY) })
        .where(eq(listings.id, listing.id));
      expect((await getAdminListing(adminActor, listing.id)).autoHidden).toBe(true);
      const [row] = await listAdminListings(adminActor, { tab: 'hidden' });
      expect(row.autoHidden).toBe(true);

      await hideListing(adminActor, { listingId: listing.id });
      expect((await getAdminListing(adminActor, listing.id)).autoHidden).toBe(false);

      await unhideListing(adminActor, { listingId: listing.id });
      expect(await rowOf(listing.id)).toMatchObject({ reviewStatus: 'approved', reviewNote: null });
      const actions = (await getAdminListing(adminActor, listing.id)).history.map((h) => h.action);
      expect(actions.sort()).toEqual([
        'auto_hid_listing',
        'hid_listing',
        'hid_listing',
        'unhid_listing',
      ]);
    }));

  it('resets the auto-hide count after a review', () =>
    withRollback(async () => {
      const { adminActor, owner, school } = await setup();
      const reporters = await Promise.all([createUser(), createUser(), createUser()]);
      // now() is frozen in the test transaction, so backdate the listing and its first reports
      const seed = async (): Promise<string> => {
        const row = await insertListing(owner.id, school.id, {
          reviewStatus: 'approved',
          createdAt: new Date(NOW - 2 * HOUR),
        });
        for (const reporter of reporters.slice(0, 2)) {
          await insertReport({
            reporterId: reporter.id,
            targetType: 'listing',
            targetId: row.id,
            createdAt: new Date(NOW - HOUR),
          });
        }
        return row.id;
      };
      const thirdReport = (id: string) =>
        createReport(actorFor(reporters[2].id), {
          targetType: 'listing',
          targetId: id,
          reason: 'spam',
        });

      const reviewed = await seed();
      await hideListing(adminActor, { listingId: reviewed });
      await unhideListing(adminActor, { listingId: reviewed });
      expect((await thirdReport(reviewed)).autoHidden).toBe(false);
      expect((await rowOf(reviewed)).reviewStatus).toBe('approved');

      const control = await seed();
      expect((await thirdReport(control)).autoHidden).toBe(true);
      expect((await rowOf(control)).reviewStatus).toBe('hidden');
    }));

  it('deletes with a snapshot and keeps conversations', () =>
    withRollback(async () => {
      const { adminActor, owner, school, listing } = await setup({ reviewStatus: 'approved' });
      const renter = await createUser();
      await insertPhoto(listing.id, 0, `${listing.id}/p0`);
      await insertPhoto(listing.id, 1, `${listing.id}/p1`);
      await db().insert(favorites).values({ userId: renter.id, listingId: listing.id });
      const conversation = await insertConversation({
        listingId: listing.id,
        hostId: owner.id,
        renterId: renter.id,
      });

      expect(
        await fieldErrors(
          deleteListingAsAdmin(adminActor, { listingId: listing.id, confirm: 'nope' }),
        ),
      ).toEqual({ confirm: ['Type DELETE to confirm'] });
      expect(await rowOf(listing.id)).toBeDefined();
      expect(await auditCount(listing.id)).toBe(0);

      await deleteListingAsAdmin(adminActor, { listingId: listing.id, confirm: 'DELETE' });
      expect(await rowOf(listing.id)).toBeUndefined();
      expect(
        await db().select().from(listingPhotos).where(eq(listingPhotos.listingId, listing.id)),
      ).toHaveLength(0);
      expect(
        await db().select().from(favorites).where(eq(favorites.listingId, listing.id)),
      ).toHaveLength(0);
      const [kept] = await db()
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversation.id));
      expect(kept.listingId).toBeNull();
      const [audit] = await auditRows(listing.id);
      expect(audit).toMatchObject({
        action: 'deleted_listing',
        targetId: listing.id,
        snapshot: { title: listing.title, ownerId: owner.id, schoolSlug: school.slug },
      });
      expect(photos.deleteProcessedPhotos).toHaveBeenCalledWith(
        expect.arrayContaining([`${listing.id}/p0`, `${listing.id}/p1`]),
      );
      await expect(
        deleteListingAsAdmin(adminActor, { listingId: listing.id, confirm: 'DELETE' }),
      ).rejects.toBeInstanceOf(NotFound);
    }));

  it('shows the far-from-campus distance only beyond the school radius', () =>
    withRollback(async () => {
      const near = await setup({ location: { lng: -89.404, lat: 43.0753 } });
      expect((await getAdminListing(near.adminActor, near.listing.id)).farFromCampusKm).toBeNull();
      expect(
        (await listAdminListings(near.adminActor, { school: near.school.slug }))[0].farFromCampusKm,
      ).toBeNull();

      const far = await setup({ location: { lng: -89.0, lat: 43.5 } });
      const view = await getAdminListing(far.adminActor, far.listing.id);
      expect(view.farFromCampusKm).toBeGreaterThan(far.school.warnRadiusKm);
      expect(view.farFromCampusKm).toBeCloseTo(view.detail.distanceKm, 5);
      const [row] = await listAdminListings(far.adminActor, { school: far.school.slug });
      expect(row.farFromCampusKm).toBeCloseTo(view.detail.distanceKm, 5);
    }));

  it('shows owner, reports, and history on the admin view', () =>
    withRollback(async () => {
      const { adminActor, owner, listing } = await setup();
      const reporter = await createUser({ displayName: 'Rae R.' });
      await insertReport({ reporterId: reporter.id, targetType: 'listing', targetId: listing.id });
      await insertReport({ reporterId: null, targetType: 'listing', targetId: listing.id });
      expect(await getAdminListing(adminActor, 'nope').catch((e: unknown) => e)).toBeInstanceOf(
        NotFound,
      );
      const view = await getAdminListing(adminActor, listing.id);
      expect(view.detail.viewer).toBe('admin');
      expect(view.owner).toMatchObject({
        id: owner.id,
        displayName: 'Olive O.',
        status: 'active',
        listingCount: 1,
      });
      expect(view.reports).toHaveLength(2);
      for (const [i, action] of (['hid_listing', 'unhid_listing'] as const).entries()) {
        await insertAudit({
          adminId: null,
          action,
          targetType: 'listing',
          targetId: listing.id,
          createdAt: new Date(NOW - (2 - i) * HOUR),
        });
      }
      const later = await getAdminListing(adminActor, listing.id);
      expect(later.history.map((h) => h.action)).toEqual(['hid_listing', 'unhid_listing']);
      expect(view.reports.map((r) => r.reporterName)).toEqual(
        expect.arrayContaining(['Rae R.', null]),
      );
    }));

  it('counts pending active listings and open reports', () =>
    withRollback(async () => {
      const { adminActor, owner, school, listing } = await setup();
      const base = await getAdminCounts(adminActor);
      await insertListing(owner.id, school.id, {
        availableFrom: '2019-01-01',
        availableTo: '2020-01-01',
      });
      await insertListing(owner.id, school.id, { status: 'taken' });
      await insertListing(owner.id, school.id, { reviewStatus: 'approved' });
      await insertReport({ reporterId: null, targetType: 'listing', targetId: listing.id });
      await insertReport({
        reporterId: null,
        targetType: 'listing',
        targetId: listing.id,
        status: 'resolved',
      });
      const counts = await getAdminCounts(adminActor);
      expect(counts.pendingListings).toBe(base.pendingListings);
      await insertListing(owner.id, school.id);
      expect((await getAdminCounts(adminActor)).pendingListings).toBe(base.pendingListings + 1);
      expect(counts.openReports).toBe(base.openReports + 1);
    }));
});
