import postgres from 'postgres';
import { LOCAL_DATABASE_URL } from '../../tests/local-db';

// Removes conversations (messages cascade) and blocks between the users.
export async function resetMessaging(userIds: string[]): Promise<void> {
  const sql = postgres(process.env.DATABASE_URL ?? LOCAL_DATABASE_URL, { max: 1, prepare: false });
  try {
    await sql`
      delete from conversations where host_id in ${sql(userIds)} or renter_id in ${sql(userIds)}`;
    await sql`
      delete from blocks where blocker_id in ${sql(userIds)} and blocked_id in ${sql(userIds)}`;
  } finally {
    await sql.end();
  }
}
