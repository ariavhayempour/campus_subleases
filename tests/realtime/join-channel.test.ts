import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it } from 'vitest';
import { joinChannel, removeClients } from '../helpers/realtime';

const unreachable = createClient('http://127.0.0.1:1', 'sb_publishable_unreachable', {
  auth: { persistSession: false, autoRefreshToken: false },
});

afterEach(async () => {
  await removeClients([unreachable]);
});

describe('joinChannel', () => {
  it('rejects a refused-mode join whose channel error is not an authorization error', async () => {
    await expect(
      joinChannel(unreachable, `probe:${randomUUID()}`, { expect: 'refused', private: false }),
    ).rejects.toThrow(/transport failure/);
  });
});
