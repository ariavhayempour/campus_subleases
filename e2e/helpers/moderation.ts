import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { LOCAL_DATABASE_URL } from '../../tests/local-db';

const FIRST_NAME = 'Throwaway';
const LAST_NAME = 'Banned';

function connect(): postgres.Sql {
  return postgres(process.env.DATABASE_URL ?? LOCAL_DATABASE_URL, { max: 1, prepare: false });
}

type ClerkUser = {
  id: string;
  banned: boolean;
  primary_email_address_id: string | null;
  email_addresses: { id: string; email_address: string }[];
  private_metadata: Record<string, unknown>;
};

const THROWAWAY_EMAIL = /^e2e-ban-[0-9a-f]{12}\+clerk_test@example\.com$/;

// Plain fetch: @clerk/nextjs/server does not load under Playwright's module resolver.
async function clerkApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  const key = process.env.CLERK_SECRET_KEY ?? '';
  // Test helpers must never reach a production Clerk instance.
  if (!key.startsWith('sk_test_')) throw new Error('CLERK_SECRET_KEY must be a sk_test_ key');
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw Object.assign(new Error(`Clerk ${method} ${path} failed: ${response.status}`), {
      status: response.status,
    });
  }
  return (await response.json()) as T;
}

export function getClerkUser(id: string): Promise<ClerkUser> {
  return clerkApi<ClerkUser>('GET', `/users/${id}`);
}

// Creates a real Clerk user (the admin page reads it) plus its users mirror row.
export async function createThrowawayUser(): Promise<{ id: string; displayName: string }> {
  const tag = randomBytes(6).toString('hex');
  const clerkUser = await clerkApi<ClerkUser>('POST', '/users', {
    email_address: [`e2e-ban-${tag}+clerk_test@example.com`],
    first_name: FIRST_NAME,
    last_name: LAST_NAME,
    password: randomBytes(24).toString('base64url'),
    private_metadata: { e2eThrowaway: true },
  });
  const displayName = `${FIRST_NAME} ${LAST_NAME.charAt(0)}.`;
  const sql = connect();
  try {
    await sql`
      insert into users (id, first_name, last_name, display_name, home_school_id, status)
      values (
        ${clerkUser.id}, ${FIRST_NAME}, ${LAST_NAME}, ${displayName},
        (select id from schools where slug = 'uw-madison'), 'active'
      )
      on conflict (id) do nothing`;
  } catch (error) {
    await deleteThrowawayUser(clerkUser.id);
    throw error;
  } finally {
    await sql.end();
  }
  return { id: clerkUser.id, displayName };
}

// True only for users this helper created: the generated email and the private marker.
function isThrowaway(user: ClerkUser): boolean {
  const primary = user.email_addresses.find((e) => e.id === user.primary_email_address_id);
  return (
    THROWAWAY_EMAIL.test(primary?.email_address ?? '') &&
    user.private_metadata.e2eThrowaway === true
  );
}

async function deleteClerkThrowaway(id: string): Promise<void> {
  let user: ClerkUser;
  try {
    user = await getClerkUser(id);
  } catch (error) {
    if ((error as { status?: number }).status === 404) return;
    throw error;
  }
  if (!isThrowaway(user)) throw new Error(`Refusing to delete non-throwaway Clerk user ${id}`);
  try {
    await clerkApi('DELETE', `/users/${id}`);
  } catch (error) {
    if ((error as { status?: number }).status !== 404) throw error;
  }
}

async function removeUserRows(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const sql = connect();
  try {
    await sql`delete from admin_audit_log where target_type = 'user' and target_id in ${sql(ids)}`;
    await sql`delete from reports where target_type = 'user' and target_id in ${sql(ids)}`;
    await sql`delete from users where id in ${sql(ids)}`;
  } finally {
    await sql.end();
  }
}

// Removes the Clerk user (a missing user counts as done), its row, and the audit rows about it.
export async function deleteThrowawayUser(id: string): Promise<void> {
  try {
    await deleteClerkThrowaway(id);
  } finally {
    await removeUserRows([id]);
  }
}

// Deletes throwaway users left by killed runs; Clerk's query is fuzzy, so results are re-checked.
export async function sweepThrowawayUsers(): Promise<void> {
  const users = await clerkApi<ClerkUser[]>('GET', '/users?query=e2e-ban-&limit=100');
  const stale = users.filter(isThrowaway).map((u) => u.id);
  for (const id of stale) await deleteThrowawayUser(id);
}

// Deletes reports about this test's targets (listing ids, the throwaway user id) and their audit rows.
export async function removeReports(targetIds: string[]): Promise<void> {
  if (targetIds.length === 0) return;
  const sql = connect();
  try {
    const rows = await sql<{ id: string }[]>`
      delete from reports where target_id in ${sql(targetIds)} returning id`;
    if (rows.length > 0) {
      await sql`
        delete from admin_audit_log
        where target_type = 'report' and target_id in ${sql(rows.map((r) => r.id))}`;
    }
  } finally {
    await sql.end();
  }
}
