import { describe, expect, it, vi } from 'vitest';
import { Forbidden } from '@/server/services/errors';
import { setFavorite } from '@/server/services/favorites';
import { getListingDetail } from '@/server/services/listing-reads';
import { startConversation } from '@/server/services/messaging';
import { createReport } from '@/server/services/reports';
import { withRollback } from '../helpers/db';
import { actorFor, createSchool, createUser } from '../helpers/fixtures';
import { liveListing } from '../helpers/messaging';

vi.mock('@/server/realtime/publish', () => ({
  publishToUser: vi.fn().mockResolvedValue(undefined),
}));

async function setup() {
  const { listing, school } = await liveListing();
  const home = await createSchool();
  const student = await createUser({ homeSchoolId: home.id });
  const local = await createUser({ homeSchoolId: school.id });
  return { listing, student, local };
}

describe('students outside the listing school', () => {
  it('can view the listing but is flagged as cross-school', () =>
    withRollback(async () => {
      const { listing, student, local } = await setup();
      expect((await getListingDetail(actorFor(student.id), listing.id)).crossSchool).toBe(true);
      expect((await getListingDetail(actorFor(local.id), listing.id)).crossSchool).toBe(false);
      expect((await getListingDetail(actorFor(student.id, true), listing.id)).crossSchool).toBe(
        false,
      );
    }));

  it('sees the host only from the listing school or as an admin', () =>
    withRollback(async () => {
      const { listing, student, local } = await setup();
      expect((await getListingDetail(actorFor(student.id), listing.id)).host).toBeNull();
      expect((await getListingDetail(actorFor(local.id), listing.id)).host).not.toBeNull();
      expect((await getListingDetail(actorFor(student.id, true), listing.id)).host).not.toBeNull();
    }));

  it('cannot message, save, or report', () =>
    withRollback(async () => {
      const { listing, student } = await setup();
      const actor = actorFor(student.id);
      await expect(
        startConversation(actor, { listingId: listing.id, body: 'Is this still free?' }),
      ).rejects.toBeInstanceOf(Forbidden);
      await expect(
        setFavorite(actor, { listingId: listing.id, favorited: true }),
      ).rejects.toBeInstanceOf(Forbidden);
      await expect(
        createReport(actor, {
          targetType: 'listing',
          targetId: listing.id,
          reason: 'spam',
          details: '',
        }),
      ).rejects.toBeInstanceOf(Forbidden);
    }));

  it('lets same-school students and admins interact', () =>
    withRollback(async () => {
      const { listing, student, local } = await setup();
      await setFavorite(actorFor(local.id), { listingId: listing.id, favorited: true });
      await setFavorite(actorFor(student.id, true), { listingId: listing.id, favorited: true });
      await startConversation(actorFor(local.id), { listingId: listing.id, body: 'Hi there' });
    }));
});
