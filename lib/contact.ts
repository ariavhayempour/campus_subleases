import { APP_NAME } from '@/lib/app-config';
import type { ContactMessage } from '@/lib/validation/contact';

// Public by design: Web3Forms only accepts browser submissions, so the key ships in the page.
export const WEB3FORMS_ACCESS_KEY = '0f7c3774-a567-4ca9-8852-2ed55e7e6d61';

export const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

// Web3Forms' shared free-plan hCaptcha sitekey; Web3Forms verifies the token when hCaptcha is on.
export const HCAPTCHA_SITEKEY = '50b2fe65-b00b-4b9e-ad62-3ba471098be2';
export const HCAPTCHA_ONLOAD = 'onHCaptchaLoad';
export const HCAPTCHA_SCRIPT_URL = `https://js.hcaptcha.com/1/api.js?render=explicit&onload=${HCAPTCHA_ONLOAD}`;

export type ContactSubmitResult = { ok: true } | { ok: false; message: string };

const GENERIC_FAILURE = 'Your message could not be sent. Please try again in a few minutes.';

export function contactPayload(
  message: ContactMessage,
  accessKey: string,
  captchaToken: string,
): Record<string, string> {
  return {
    access_key: accessKey,
    'h-captcha-response': captchaToken,
    subject: `New message from the ${APP_NAME} contact form`,
    from_name: APP_NAME,
    name: message.name,
    email: message.email,
    message: message.message,
  };
}

export async function submitContactMessage(
  message: ContactMessage,
  captchaToken: string,
  accessKey: string = WEB3FORMS_ACCESS_KEY,
  fetchImpl: typeof fetch = fetch,
): Promise<ContactSubmitResult> {
  if (!accessKey) return { ok: false, message: 'The contact form is not set up yet.' };
  let response: Response;
  try {
    response = await fetchImpl(WEB3FORMS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(contactPayload(message, accessKey, captchaToken)),
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
