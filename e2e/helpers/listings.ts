import postgres from 'postgres';
import { LOCAL_DATABASE_URL } from '../../tests/local-db';

function connect(): postgres.Sql {
  return postgres(process.env.DATABASE_URL ?? LOCAL_DATABASE_URL, { max: 1, prepare: false });
}

// Gives the test user a home school and removes listings left by earlier runs.
export async function prepareHost(userId: string, schoolSlug: string): Promise<void> {
  const sql = connect();
  try {
    const updated = await sql`
      update users set home_school_id = (select id from schools where slug = ${schoolSlug})
      where id = ${userId}
      returning id`;
    if (updated.length !== 1) throw new Error(`No users row for ${userId}`);
    await sql`delete from listings where owner_id = ${userId}`;
  } finally {
    await sql.end();
  }
}

export async function removeListings(userId: string): Promise<void> {
  const sql = connect();
  try {
    await sql`delete from listings where owner_id = ${userId}`;
  } finally {
    await sql.end();
  }
}

export async function seedListing(
  userId: string,
  schoolSlug: string,
  title: string,
  options: { withPhoto?: boolean } = {},
): Promise<string> {
  const sql = connect();
  try {
    const [row] = await sql<{ id: string }[]>`
      insert into listings (
        school_id, owner_id, type, title, description, rent_cents, available_from, available_to,
        bedrooms, bathrooms, roommates_count, address, city, state, zip, unit, location
      )
      values (
        (select id from schools where slug = ${schoolSlug}), ${userId}, 'apartment', ${title},
        'Bright studio with big windows, five minutes from campus.', 95000,
        current_date + 30, current_date + 150, 0, 1, 0,
        '123 State St', 'Madison', 'WI', '53703', '4B',
        'SRID=4326;POINT(-89.39 43.07)'::geography
      )
      returning id`;
    if (options.withPhoto) {
      // The file does not exist in storage; the edit form only needs one photo row.
      await sql`
        insert into listing_photos (listing_id, storage_path, position)
        values (${row.id}, 'e2e/placeholder', 0)`;
    }
    return row.id;
  } finally {
    await sql.end();
  }
}

export async function removeAudit(listingIds: string[]): Promise<void> {
  if (listingIds.length === 0) return;
  const sql = connect();
  try {
    await sql`
      delete from admin_audit_log
      where target_type = 'listing' and target_id in ${sql(listingIds)}`;
  } finally {
    await sql.end();
  }
}

export async function approveListing(listingId: string): Promise<void> {
  const sql = connect();
  try {
    await sql`
      update listings set review_status = 'approved', reviewed_at = now() where id = ${listingId}`;
  } finally {
    await sql.end();
  }
}
