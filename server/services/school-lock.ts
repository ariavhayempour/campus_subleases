import { eq } from 'drizzle-orm';
import { db, type DbExecutor } from '@/server/db/client';
import { users } from '@/server/db/schema';
import type { UserActor } from './actor';
import { Forbidden } from './errors';

// Users without a home school are sent through onboarding before they reach any caller.
export async function isOutsideHomeSchool(
  user: UserActor,
  schoolId: string,
  executor: DbExecutor = db(),
): Promise<boolean> {
  if (user.isAdmin) return false;
  const [me] = await executor
    .select({ homeSchoolId: users.homeSchoolId })
    .from(users)
    .where(eq(users.id, user.userId));
  const home = me?.homeSchoolId;
  return home != null && home !== schoolId;
}

// Students may view another school's listing but not message, save, or report it.
export async function assertInHomeSchool(user: UserActor, schoolId: string): Promise<void> {
  if (await isOutsideHomeSchool(user, schoolId)) {
    throw new Forbidden('This listing is at another school');
  }
}
