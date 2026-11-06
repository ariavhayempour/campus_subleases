import { pgEnum } from 'drizzle-orm/pg-core';

export const userStatus = pgEnum('user_status', ['active', 'banned']);

// 'room' is legacy: kept in the database enum until a contract migration; the app reads it as apartment.
export const listingType = pgEnum('listing_type', ['apartment', 'house', 'room']);
export const roomType = pgEnum('room_type', ['single', 'shared']);
export const genderPreference = pgEnum('gender_preference', [
  'any',
  'women',
  'men',
  'nonbinary_friendly',
]);
export const listingStatus = pgEnum('listing_status', ['active', 'taken', 'removed']);
export const reviewStatus = pgEnum('review_status', ['pending', 'approved', 'rejected', 'hidden']);
export const reportTargetType = pgEnum('report_target_type', ['user', 'listing', 'message']);
export const reportReason = pgEnum('report_reason', [
  'scam',
  'spam',
  'inappropriate',
  'harassment',
  'other',
]);
export const reportStatus = pgEnum('report_status', ['open', 'resolved']);
export const adminAction = pgEnum('admin_action', [
  'approved_listing',
  'rejected_listing',
  'hid_listing',
  'auto_hid_listing',
  'unhid_listing',
  'deleted_listing',
  'resolved_report',
  'banned_user',
  'unbanned_user',
  'viewed_conversation',
]);
