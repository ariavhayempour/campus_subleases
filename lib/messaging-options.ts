export const MESSAGE_MAX_LENGTH = 2000;
export const MAX_NEW_CONVERSATIONS_PER_DAY = 15;
export const MAX_MESSAGES_PER_MINUTE = 30;
export const THREAD_PAGE_SIZE = 100;
export const INBOX_LIMIT = 100;
export const PREVIEW_LENGTH = 120;
export const SAFETY_NOTICE =
  'Never send money or a deposit before seeing the place in person and meeting the tenant.';
export const DELETED_USER_LABEL = 'Deleted user';
export const REMOVED_LISTING_LABEL = 'Listing removed';
export const REALTIME_EVENT_NAME = 'message';

export const userTopic = (userId: string): string => `user:${userId}`;

export type MessageView = {
  id: string;
  conversationId: string;
  senderId: string | null;
  body: string;
  createdAt: string; // ISO 8601
};

export type RealtimeEvent = { type: 'message'; conversationId: string; message: MessageView };

export type ComposerState = 'open' | 'you_blocked' | 'cannot_reply' | 'deleted_user';
