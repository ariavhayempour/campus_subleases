import { z } from 'zod';
import { MESSAGE_MAX_LENGTH } from '@/lib/messaging-options';

export const messageBodySchema = z
  .string()
  .trim()
  .min(1, 'Write a message')
  .max(MESSAGE_MAX_LENGTH, 'Messages can be up to 2,000 characters');

export const startConversationSchema = z.object({
  listingId: z.uuid(),
  body: messageBodySchema,
});

export const sendMessageSchema = z.object({
  conversationId: z.uuid(),
  body: messageBodySchema,
});

// `before` is a message id used as the pagination cursor.
export const earlierMessagesSchema = z.object({
  conversationId: z.uuid(),
  before: z.uuid(),
});

export const blockInputSchema = z.object({
  userId: z.string().min(1).max(100),
});
