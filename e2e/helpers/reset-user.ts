import postgres from 'postgres';
import { LOCAL_DATABASE_URL } from '../../tests/local-db';

// Deleting the mirror row makes the next request lazily recreate it without onboarding data.
export async function resetUserById(userId: string): Promise<void> {
  const sql = postgres(process.env.DATABASE_URL ?? LOCAL_DATABASE_URL, { max: 1, prepare: false });
  try {
    await sql`delete from users where id = ${userId}`;
  } finally {
    await sql.end();
  }
}
