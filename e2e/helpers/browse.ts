import postgres from 'postgres';
import { LOCAL_DATABASE_URL } from '../../tests/local-db';

const HOST_ID = 'user_e2e_browse_host';

export type SeedListing = {
  title: string;
  rentCents: number;
  unit?: string;
  description?: string;
};

const DESCRIPTION = 'Zebracorn test listing with big windows near campus.';

function connect(): postgres.Sql {
  return postgres(process.env.DATABASE_URL ?? LOCAL_DATABASE_URL, { max: 1, prepare: false });
}

// Approved listings owned by a host with no Clerk account; deleting the host cascades them.
export async function seedBrowseListings(listings: SeedListing[]): Promise<string[]> {
  const sql = connect();
  try {
    await sql`delete from users where id = ${HOST_ID}`;
    await sql`
      insert into users (id, first_name, last_name, display_name)
      values (${HOST_ID}, 'Erin', 'Host', 'Erin H.')`;
    const ids: string[] = [];
    for (const [index, listing] of listings.entries()) {
      const [row] = await sql<{ id: string }[]>`
        insert into listings (
          school_id, owner_id, type, title, description, rent_cents, available_from, available_to,
          bedrooms, bathrooms, roommates_count, address, city, state, zip, unit, location,
          review_status, reviewed_at, created_at
        )
        values (
          (select id from schools where slug = 'uw-madison'), ${HOST_ID}, 'apartment',
          ${listing.title}, ${listing.description ?? DESCRIPTION},
          ${listing.rentCents}, current_date + 30, current_date + 150, 1, 1, 0,
          '200 Lake St', 'Madison', 'WI', '53703', ${listing.unit ?? null},
          'SRID=4326;POINT(-89.40 43.07)'::geography, 'approved', now(),
          now() - make_interval(mins => ${index})
        )
        returning id`;
      ids.push(row.id);
    }
    return ids;
  } finally {
    await sql.end();
  }
}

export async function removeBrowseHost(): Promise<void> {
  const sql = connect();
  try {
    await sql`delete from users where id = ${HOST_ID}`;
  } finally {
    await sql.end();
  }
}
