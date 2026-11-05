import { z } from 'zod';

export const CONTACT_NAME_MAX_LENGTH = 100;
export const CONTACT_MESSAGE_MIN_LENGTH = 10;
export const CONTACT_MESSAGE_MAX_LENGTH = 5000;

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your name')
    .max(CONTACT_NAME_MAX_LENGTH, 'Names can be up to 100 characters'),
  email: z.string().trim().pipe(z.email('Enter a valid email address').max(254)),
  message: z
    .string()
    .trim()
    .min(CONTACT_MESSAGE_MIN_LENGTH, 'Write at least 10 characters')
    .max(CONTACT_MESSAGE_MAX_LENGTH, 'Messages can be up to 5,000 characters'),
});

export type ContactInput = z.input<typeof contactSchema>;
export type ContactMessage = z.output<typeof contactSchema>;
