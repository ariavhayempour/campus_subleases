import { runMigrations } from '../scripts/migrate';
import { LOCAL_DATABASE_URL } from './local-db';

export default async function globalSetup(): Promise<void> {
  await runMigrations(process.env.DATABASE_DIRECT_URL ?? LOCAL_DATABASE_URL);
}
