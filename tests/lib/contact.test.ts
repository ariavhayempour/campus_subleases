import { describe, expect, it, vi } from 'vitest';
import { APP_NAME } from '@/lib/app-config';
import { contactPayload, submitContactMessage, WEB3FORMS_ENDPOINT } from '@/lib/contact';
import { contactSchema, type ContactMessage } from '@/lib/validation/contact';

const message: ContactMessage = {
  name: 'Ada L.',
  email: 'ada@example.edu',
  message: 'Is there a way to edit my school?',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('contactSchema', () => {
  it('trims fields and accepts a valid message', () => {
    const parsed = contactSchema.parse({
      name: '  Ada L. ',
      email: ' ada@example.edu ',
      message: '  Is there a way to edit my school?  ',
    });
    expect(parsed).toEqual(message);
  });

  it('rejects a missing name, a bad email, and a too-short message', () => {
    const result = contactSchema.safeParse({ name: '   ', email: 'nope', message: 'hi' });
    expect(result.success).toBe(false);
    const fields = result.error?.flatten().fieldErrors;
    expect(fields?.name).toEqual(['Enter your name']);
    expect(fields?.email).toEqual(['Enter a valid email address']);
    expect(fields?.message).toEqual(['Write at least 10 characters']);
  });

  it('rejects a message over 5,000 characters', () => {
    const result = contactSchema.safeParse({ ...message, message: 'a'.repeat(5001) });
    expect(result.success).toBe(false);
  });
});

describe('contactPayload', () => {
  it('sends the access key, a fixed subject, and the visitor fields', () => {
    expect(contactPayload(message, 'key-123')).toEqual({
      access_key: 'key-123',
      subject: `New message from the ${APP_NAME} contact form`,
      from_name: APP_NAME,
      name: 'Ada L.',
      email: 'ada@example.edu',
      message: 'Is there a way to edit my school?',
    });
  });
});

describe('submitContactMessage', () => {
  it('posts JSON to Web3Forms and succeeds on success: true', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(200, { success: true }));
    await expect(submitContactMessage(message, 'key-123', fetchImpl)).resolves.toEqual({
      ok: true,
    });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(WEB3FORMS_ENDPOINT);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toMatchObject({ access_key: 'key-123', name: 'Ada L.' });
  });

  it('refuses without an access key and never calls the network', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await submitContactMessage(message, '', fetchImpl);
    expect(result).toEqual({ ok: false, message: 'The contact form is not set up yet.' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails on success: false, on a rate limit, on non-JSON, and on a network error', async () => {
    const cases: Array<() => Promise<Response>> = [
      async () => jsonResponse(400, { success: false, message: 'Invalid access key' }),
      async () => jsonResponse(200, { success: false }),
      async () => jsonResponse(429, { success: false }),
      async () => new Response('<html>oops</html>', { status: 500 }),
      async () => {
        throw new TypeError('Failed to fetch');
      },
    ];
    for (const respond of cases) {
      const result = await submitContactMessage(message, 'key-123', vi.fn<typeof fetch>(respond));
      expect(result.ok).toBe(false);
    }
  });

  it('explains a rate limit', async () => {
    const result = await submitContactMessage(
      message,
      'key-123',
      vi.fn<typeof fetch>(async () => jsonResponse(429, { success: false })),
    );
    expect(result).toEqual({
      ok: false,
      message: 'Too many messages were sent. Please try again later.',
    });
  });
});
