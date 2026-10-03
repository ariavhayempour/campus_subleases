import { execFileSync } from 'node:child_process';

type LocalSupabaseEnv = { NEXT_PUBLIC_SUPABASE_URL: string; SUPABASE_SECRET_KEY: string };

// CI exports these; locally they come from the running Supabase CLI stack.
export function localSupabaseEnv(): LocalSupabaseEnv {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    const output = execFileSync('supabase', ['status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const status = JSON.parse(output) as { API_URL: string; SECRET_KEY: string };
    url = status.API_URL;
    key = status.SECRET_KEY;
  }
  const host = new URL(url).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(`Tests only run against local Supabase, not ${host}`);
  }
  return { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: key };
}
