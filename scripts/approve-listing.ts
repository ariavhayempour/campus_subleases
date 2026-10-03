import postgres from 'postgres';

const [listingId] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!listingId || !url) {
  console.error('Usage: pnpm dev:approve-listing <listing-id> (needs DATABASE_URL)');
  process.exit(1);
}
const host = new URL(url).hostname;
if (host !== '127.0.0.1' && host !== 'localhost') {
  console.error(`Refusing to approve listings in a non-local database (${host})`);
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });
try {
  const rows = await sql`
    update listings
    set review_status = 'approved', review_note = null, reviewed_at = now(), updated_at = now()
    where id = ${listingId}
    returning id`;
  console.log(rows.length ? `Approved ${listingId}` : 'No listing with that id');
} finally {
  await sql.end();
}
