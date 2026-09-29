import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/webhooks/clerk/route';
import { getUserById } from '@/server/services/users';
import { signedClerkWebhook } from '../helpers/clerk-webhook';
import { withRollback } from '../helpers/db';
import { createUser } from '../helpers/fixtures';

const userEvent = (type: 'user.created' | 'user.updated', overrides: Record<string, unknown> = {}) => ({
  type,
  object: 'event',
  data: { id: 'user_webhook', first_name: 'Ada', last_name: 'Lovelace', banned: false, ...overrides },
});

describe('POST /api/webhooks/clerk', () => {
  it('rejects an invalid signature with 400', async () => {
    const response = await POST(
      signedClerkWebhook(userEvent('user.created'), 'whsec_d3Jvbmctc2VjcmV0LXdyb25nLXNlY3JldC13cm9uZyE='),
    );
    expect(response.status).toBe(400);
  });

  it('creates the user once even when delivered twice', () =>
    withRollback(async () => {
      expect((await POST(signedClerkWebhook(userEvent('user.created')))).status).toBe(200);
      expect((await POST(signedClerkWebhook(userEvent('user.created')))).status).toBe(200);
      expect(await getUserById('user_webhook')).toMatchObject({ displayName: 'Ada L.', status: 'active' });
    }));

  it('mirrors name changes and bans on user.updated', () =>
    withRollback(async () => {
      await POST(signedClerkWebhook(userEvent('user.created')));
      await POST(signedClerkWebhook(userEvent('user.updated', { last_name: 'Byron', banned: true })));
      expect(await getUserById('user_webhook')).toMatchObject({
        lastName: 'Byron',
        displayName: 'Ada B.',
        status: 'banned',
      });
    }));

  it('deletes on user.deleted, idempotently', () =>
    withRollback(async () => {
      const user = await createUser();
      const event = { type: 'user.deleted', object: 'event', data: { id: user.id, deleted: true } };
      expect((await POST(signedClerkWebhook(event))).status).toBe(200);
      expect((await POST(signedClerkWebhook(event))).status).toBe(200);
      expect(await getUserById(user.id)).toBeNull();
    }));
});
