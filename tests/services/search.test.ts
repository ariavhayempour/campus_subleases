import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { PAGE_SIZE } from '@/lib/search-options';
import type { SearchFilters } from '@/lib/validation/search';
import { db } from '@/server/db/client';
import { blocks, favorites, listings } from '@/server/db/schema';
import { ANONYMOUS, type Actor } from '@/server/services/actor';
import { ValidationError } from '@/server/services/errors';
import { searchListings, searchMapPins } from '@/server/services/search';
import { withRollback } from '../helpers/db';
import {
  actorFor,
  createSchool,
  createUser,
  insertListing,
  insertPhoto,
  listingValues,
} from '../helpers/fixtures';

const live = { reviewStatus: 'approved' } as const;

async function titles(
  schoolId: string,
  filters: SearchFilters = {},
  actor: Actor = ANONYMOUS,
): Promise<string[]> {
  return (await searchListings(actor, { schoolId, filters })).cards.map((card) => card.title);
}

const sorted = (values: string[]): string[] => [...values].sort();

describe('searchListings visibility', () => {
  it('returns only public listings at the school', () =>
    withRollback(async () => {
      const owner = await createUser();
      const banned = await createUser({ status: 'banned' });
      const school = await createSchool();
      const other = await createSchool();
      await insertListing(owner.id, school.id, { ...live, title: 'Public place' });
      await insertListing(owner.id, school.id, { title: 'Pending place' });
      await insertListing(owner.id, school.id, { reviewStatus: 'hidden', title: 'Hidden place' });
      await insertListing(owner.id, school.id, { ...live, status: 'taken', title: 'Taken place' });
      await insertListing(owner.id, school.id, { ...live, status: 'removed', title: 'Gone place' });
      await insertListing(owner.id, school.id, {
        ...live,
        title: 'Expired place',
        availableFrom: '2020-01-01',
        availableTo: '2020-06-01',
      });
      await insertListing(banned.id, school.id, { ...live, title: 'Banned owner place' });
      await insertListing(owner.id, other.id, { ...live, title: 'Other school place' });
      expect(await titles(school.id)).toEqual(['Public place']);

      const closed = await createSchool({ isActive: false });
      await insertListing(owner.id, closed.id, { ...live, title: 'Closed school place' });
      expect(await titles(closed.id)).toEqual([]);
    }));

  it('excludes listings that ended before today in the school timezone', () =>
    withRollback(async () => {
      const [{ today, yesterday }] = await db().execute<{ today: string; yesterday: string }>(
        sql`select (now() at time zone 'America/Los_Angeles')::date::text as today,
                   ((now() at time zone 'America/Los_Angeles')::date - 1)::text as yesterday`,
      );
      const owner = await createUser();
      const school = await createSchool({ timezone: 'America/Los_Angeles' });
      const base = { ...live, availableFrom: '2020-01-01' };
      await insertListing(owner.id, school.id, {
        ...base,
        availableTo: today,
        title: 'Ends today',
      });
      await insertListing(owner.id, school.id, {
        ...base,
        availableTo: yesterday,
        title: 'Ended yesterday',
      });
      expect(await titles(school.id)).toEqual(['Ends today']);
      expect(await titles(school.id, { from: today })).toEqual(['Ends today']);
    }));

  it('uses each school timezone for today, at both extremes of UTC offset', () =>
    withRollback(async () => {
      const [dates] = await db().execute<{ aheadYesterday: string; behindToday: string }>(
        sql`select ((now() at time zone 'Pacific/Kiritimati')::date - 1)::text as "aheadYesterday",
                   (now() at time zone 'Etc/GMT+12')::date::text as "behindToday"`,
      );
      const owner = await createUser();
      const ahead = await createSchool({ timezone: 'Pacific/Kiritimati' });
      const behind = await createSchool({ timezone: 'Etc/GMT+12' });
      const base = { ...live, availableFrom: '2020-01-01' };
      await insertListing(owner.id, ahead.id, {
        ...base,
        availableTo: dates.aheadYesterday,
        title: 'Ended yesterday far ahead of UTC',
      });
      await insertListing(owner.id, behind.id, {
        ...base,
        availableTo: dates.behindToday,
        title: 'Ends today far behind UTC',
      });
      expect(await titles(ahead.id)).toEqual([]);
      expect(await titles(behind.id)).toEqual(['Ends today far behind UTC']);
    }));

  it('hides listings when a block exists in either direction', () =>
    withRollback(async () => {
      const owner = await createUser();
      const school = await createSchool();
      await insertListing(owner.id, school.id, { ...live, title: 'Blocked host place' });
      const blocker = await createUser();
      const blocked = await createUser();
      const bystander = await createUser();
      await db()
        .insert(blocks)
        .values([
          { blockerId: blocker.id, blockedId: owner.id },
          { blockerId: owner.id, blockedId: blocked.id },
        ]);
      expect(await titles(school.id, {}, actorFor(blocker.id))).toEqual([]);
      expect(await titles(school.id, {}, actorFor(blocked.id))).toEqual([]);
      expect(await titles(school.id, {}, actorFor(bystander.id))).toEqual(['Blocked host place']);
      expect(await titles(school.id)).toEqual(['Blocked host place']);
    }));

  it('never returns the unit or street address in cards or pins', () =>
    withRollback(async () => {
      const owner = await createUser();
      const school = await createSchool();
      await insertListing(owner.id, school.id, {
        ...live,
        unit: 'Unit-ZZ9',
        address: '987 Secretive Way',
      });
      const page = await searchListings(ANONYMOUS, { schoolId: school.id, filters: {} });
      const pins = await searchMapPins(ANONYMOUS, { schoolId: school.id, filters: {} });
      expect(page.cards).toHaveLength(1);
      expect(Object.keys(page.cards[0])).not.toContain('unit');
      const json = JSON.stringify([page, pins]);
      expect(json).not.toContain('ZZ9');
      expect(json).not.toContain('Secretive');
    }));
});

describe('searchListings filters', () => {
  it('matches date ranges that overlap, inclusive at both ends', () =>
    withRollback(async () => {
      const owner = await createUser();
      const school = await createSchool();
      await insertListing(owner.id, school.id, {
        ...live,
        title: 'Spring place',
        availableFrom: '2027-02-01',
        availableTo: '2027-03-31',
      });
      const match = async (filters: SearchFilters): Promise<boolean> =>
        (await titles(school.id, filters)).length === 1;
      expect(await match({ from: '2027-03-31' })).toBe(true);
      expect(await match({ from: '2027-04-01' })).toBe(false);
      expect(await match({ to: '2027-02-01' })).toBe(true);
      expect(await match({ to: '2027-01-31' })).toBe(false);
      expect(await match({ from: '2027-01-01', to: '2027-12-31' })).toBe(true);
      expect(await match({ from: '2027-02-10', to: '2027-02-20' })).toBe(true);
      expect(await match({ from: '2027-04-01', to: '2027-05-01' })).toBe(false);
    }));

  it('filters by rent, bedrooms, type, furnished, roommates, and private bathroom', () =>
    withRollback(async () => {
      const owner = await createUser();
      const school = await createSchool();
      const add = (title: string, overrides: Parameters<typeof insertListing>[2]) =>
        insertListing(owner.id, school.id, { ...live, title, ...overrides });
      await add('Studio A', { rentCents: 90_000, bedrooms: 0, furnished: true, roommatesCount: 0 });
      await add('House B', {
        type: 'house',
        rentCents: 150_000,
        bedrooms: 3,
        furnished: false,
        roommatesCount: 2,
      });
      await add('Room C', {
        type: 'room',
        privateBathroom: true,
        rentCents: 70_000,
        bedrooms: 1,
        furnished: false,
        roommatesCount: 3,
      });
      await add('Big D', { rentCents: 250_000, bedrooms: 5, furnished: false, roommatesCount: 0 });
      await add('Room E', {
        type: 'room',
        privateBathroom: false,
        rentCents: 65_000,
        bedrooms: 1,
        furnished: false,
        roommatesCount: 1,
      });

      expect(sorted(await titles(school.id, { rentMin: 800, rentMax: 1500 }))).toEqual([
        'House B',
        'Studio A',
      ]);
      expect(await titles(school.id, { bedrooms: 0 })).toEqual(['Studio A']);
      expect(await titles(school.id, { bedrooms: 4 })).toEqual(['Big D']);
      expect(sorted(await titles(school.id, { type: 'room' }))).toEqual(['Room C', 'Room E']);
      expect(await titles(school.id, { furnished: true })).toEqual(['Studio A']);
      expect(sorted(await titles(school.id, { maxRoommates: 1 }))).toEqual([
        'Big D',
        'Room E',
        'Studio A',
      ]);
      expect(sorted(await titles(school.id, { privateBathroom: true }))).toEqual([
        'Big D',
        'Room C',
        'Studio A',
      ]);
    }));

  it('matches a gender preference or "any"', () =>
    withRollback(async () => {
      const owner = await createUser();
      const school = await createSchool();
      const shared = { ...live, type: 'room', privateBathroom: false } as const;
      await insertListing(owner.id, school.id, { ...shared, title: 'Anyone room' });
      await insertListing(owner.id, school.id, {
        ...shared,
        genderPreference: 'women',
        title: 'Women room',
      });
      await insertListing(owner.id, school.id, {
        ...shared,
        genderPreference: 'men',
        title: 'Men room',
      });
      expect(sorted(await titles(school.id, { gender: 'women' }))).toEqual([
        'Anyone room',
        'Women room',
      ]);
      expect(await titles(school.id)).toHaveLength(3);
    }));

  it('requires every selected amenity', () =>
    withRollback(async () => {
      const owner = await createUser();
      const school = await createSchool();
      await insertListing(owner.id, school.id, {
        ...live,
        title: 'Gym and dishwasher',
        amenities: ['gym', 'dishwasher'],
      });
      await insertListing(owner.id, school.id, { ...live, title: 'Gym only', amenities: ['gym'] });
      expect(await titles(school.id, { amenities: ['gym', 'dishwasher'] })).toEqual([
        'Gym and dishwasher',
      ]);
      expect(sorted(await titles(school.id, { amenities: ['gym'] }))).toEqual([
        'Gym and dishwasher',
        'Gym only',
      ]);
    }));

  it('matches keywords and ranks title matches first by default', () =>
    withRollback(async () => {
      const owner = await createUser();
      const school = await createSchool();
      await insertListing(owner.id, school.id, {
        ...live,
        title: 'Quiet basement room',
        description: 'Cozy room with a view of the lake from the window and plenty of light.',
      });
      await insertListing(owner.id, school.id, {
        ...live,
        title: 'Lake view studio',
        description: 'Bright studio with big windows, five minutes from campus.',
      });
      await insertListing(owner.id, school.id, { ...live, title: 'Unrelated loft' });
      expect(await titles(school.id, { q: 'lake' })).toEqual([
        'Lake view studio',
        'Quiet basement room',
      ]);
      expect(await titles(school.id, { q: '"quiet basement"' })).toEqual(['Quiet basement room']);
    }));

  it('filters by distance to campus and by map area, and sorts by distance', () =>
    withRollback(async () => {
      const owner = await createUser();
      // Fixture campus is (-89.404, 43.0753).
      const school = await createSchool();
      await insertListing(owner.id, school.id, {
        ...live,
        title: 'Far place',
        location: { lng: -89.3, lat: 43.1 },
      });
      await insertListing(owner.id, school.id, {
        ...live,
        title: 'Near place',
        location: { lng: -89.4, lat: 43.076 },
      });
      expect(await titles(school.id, { maxKm: 2 })).toEqual(['Near place']);
      expect(
        await titles(school.id, {
          bounds: { west: -89.41, south: 43.07, east: -89.39, north: 43.08 },
        }),
      ).toEqual(['Near place']);
      expect(await titles(school.id, { sort: 'distance' })).toEqual(['Near place', 'Far place']);
      const [near] = (
        await searchListings(ANONYMOUS, { schoolId: school.id, filters: {} })
      ).cards.filter((card) => card.title === 'Near place');
      expect(near.distanceKm).toBeGreaterThan(0.2);
      expect(near.distanceKm).toBeLessThan(0.6);
    }));
});

describe('searchListings sorting and paging', () => {
  it('sorts newest first by default, or by rent', () =>
    withRollback(async () => {
      const owner = await createUser();
      const school = await createSchool();
      await insertListing(owner.id, school.id, {
        ...live,
        title: 'Old cheap',
        rentCents: 50_000,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
      await insertListing(owner.id, school.id, {
        ...live,
        title: 'New pricey',
        rentCents: 200_000,
        createdAt: new Date('2026-03-01T00:00:00Z'),
      });
      await insertListing(owner.id, school.id, {
        ...live,
        title: 'Mid middle',
        rentCents: 100_000,
        createdAt: new Date('2026-02-01T00:00:00Z'),
      });
      expect(await titles(school.id)).toEqual(['New pricey', 'Mid middle', 'Old cheap']);
      expect(await titles(school.id, { sort: 'rent_asc' })).toEqual([
        'Old cheap',
        'Mid middle',
        'New pricey',
      ]);
      expect(await titles(school.id, { sort: 'rent_desc' })).toEqual([
        'New pricey',
        'Mid middle',
        'Old cheap',
      ]);
    }));

  it('pages by PAGE_SIZE with a total and the next offset', () =>
    withRollback(async () => {
      const owner = await createUser();
      const school = await createSchool();
      await db()
        .insert(listings)
        .values(
          Array.from({ length: PAGE_SIZE + 1 }, (_, i) =>
            listingValues(owner.id, school.id, { ...live, title: `Listing number ${i}` }),
          ),
        );
      const first = await searchListings(ANONYMOUS, { schoolId: school.id, filters: {} });
      expect(first.cards).toHaveLength(PAGE_SIZE);
      expect(first.total).toBe(PAGE_SIZE + 1);
      expect(first.nextOffset).toBe(PAGE_SIZE);
      const second = await searchListings(ANONYMOUS, {
        schoolId: school.id,
        filters: {},
        offset: PAGE_SIZE,
      });
      expect(second.cards).toHaveLength(1);
      expect(second.nextOffset).toBeNull();
      const ids = new Set([...first.cards, ...second.cards].map((card) => card.id));
      expect(ids.size).toBe(PAGE_SIZE + 1);
    }));
});

describe('cards and pins', () => {
  it('include the cover photo and whether the viewer saved the listing', () =>
    withRollback(async () => {
      const owner = await createUser();
      const viewer = await createUser();
      const school = await createSchool();
      const listing = await insertListing(owner.id, school.id, live);
      await insertPhoto(listing.id, 1, `${listing.id}/second`);
      await insertPhoto(listing.id, 0, `${listing.id}/cover`);
      await db().insert(favorites).values({ userId: viewer.id, listingId: listing.id });

      const mine = await searchListings(actorFor(viewer.id), { schoolId: school.id, filters: {} });
      expect(mine.cards[0]).toMatchObject({
        id: listing.id,
        schoolSlug: school.slug,
        isFavorited: true,
        coverThumbUrl: expect.stringMatching(/\/cover-thumb\.webp$/),
      });
      const anon = await searchListings(ANONYMOUS, { schoolId: school.id, filters: {} });
      expect(anon.cards[0].isFavorited).toBe(false);

      const pins = await searchMapPins(ANONYMOUS, { schoolId: school.id, filters: {} });
      expect(pins).toEqual([
        {
          id: listing.id,
          title: listing.title,
          rentCents: listing.rentCents,
          location: listing.location,
          coverThumbUrl: expect.stringMatching(/\/cover-thumb\.webp$/),
        },
      ]);
    }));

  it('apply the same filters to map pins', () =>
    withRollback(async () => {
      const owner = await createUser();
      const school = await createSchool();
      await insertListing(owner.id, school.id, { ...live, title: 'Cheap', rentCents: 50_000 });
      await insertListing(owner.id, school.id, { ...live, title: 'Pricey', rentCents: 300_000 });
      const pins = await searchMapPins(ANONYMOUS, {
        schoolId: school.id,
        filters: { rentMax: 1000 },
      });
      expect(pins.map((pin) => pin.title)).toEqual(['Cheap']);
    }));
});

describe('input validation', () => {
  it('rejects a malformed school id and crossed ranges', async () => {
    await expect(
      searchListings(ANONYMOUS, { schoolId: 'nope', filters: {} }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      searchMapPins(ANONYMOUS, {
        schoolId: '00000000-0000-4000-8000-000000000000',
        filters: { rentMin: 900, rentMax: 100 },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
