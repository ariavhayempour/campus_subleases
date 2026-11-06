import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '@/server/db/client';
import { listings } from '@/server/db/schema';
import { withRollback } from '../helpers/db';
import { createSchool, createUser, insertListing } from '../helpers/fixtures';

// Runs only the data statements the migration appends after its `-- backfill` marker.
function backfillStatements(): string[] {
  const file = readFileSync(
    join(process.cwd(), 'server/db/migrations/0011_listing-form-rework.sql'),
    'utf8',
  );
  const marker = file.indexOf('-- backfill');
  if (marker === -1) throw new Error('0011 has no -- backfill marker');
  return file
    .slice(marker)
    .split('--> statement-breakpoint')
    .map((statement) =>
      statement
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter(Boolean);
}

describe('listing form rework backfill', () => {
  it('turns legacy rooms into apartments and aligns private_bathroom with roommates', () =>
    withRollback(async () => {
      const owner = await createUser();
      const school = await createSchool();
      const legacyRoom = await insertListing(owner.id, school.id, {
        type: 'room',
        roommatesCount: 0,
        privateBathroom: true,
      });
      const withRoommates = await insertListing(owner.id, school.id, {
        type: 'apartment',
        roommatesCount: 2,
        privateBathroom: null,
      });
      for (const statement of backfillStatements()) await db().execute(sql.raw(statement));
      const [room] = await db().select().from(listings).where(eq(listings.id, legacyRoom.id));
      const [shared] = await db().select().from(listings).where(eq(listings.id, withRoommates.id));
      expect(room.type).toBe('apartment');
      expect(room.privateBathroom).toBeNull();
      expect(shared.privateBathroom).toBe(false);
    }));
});
