import { APP_NAME } from '@/lib/app-config';
import type { ContactMessage } from '@/lib/validation/contact';

// Public by design: Web3Forms only accepts browser submissions, so the key ships in the page.
export const WEB3FORMS_ACCESS_KEY = '4e194f06-8d58-4c94-a591-76b5b33da0c9';

export const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

export type ContactSubmitResult = { ok: true } | { ok: false; message: string };

const GENERIC_FAILURE = 'Your message could not be sent. Please try again in a few minutes.';

export function contactPayload(message: ContactMessage, accessKey: string): Record<string, string> {
  return {
    access_key: accessKey,
    subject: `New message from the ${APP_NAME} contact form`,
    from_name: APP_NAME,
    name: message.name,
    email: message.email,
    message: message.message,
  };
}

export async function submitContactMessage(
  message: ContactMessage,
  accessKey: string = WEB3FORMS_ACCESS_KEY,
  fetchImpl: typeof fetch = fetch,
): Promise<ContactSubmitResult> {
  if (!accessKey) return { ok: false, message: 'The contact form is not set up yet.' };
  let response: Response;
  try {
    response = await fetchImpl(WEB3FORMS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(contactPayload(message, accessKey)),
    });
  } catch {
    return { ok: false, message: 'Your message could not be sent. Check your connection.' };
  }
  if (response.status === 429) {
    return { ok: false, message: 'Too many messages were sent. Please try again later.' };
  }
  const body: unknown = await response.json().catch(() => null);
  const success = typeof body === 'object' && body !== null && 'success' in body && body.success;
  return response.ok && success === true ? { ok: true } : { ok: false, message: GENERIC_FAILURE };
}
