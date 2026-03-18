/**
 * Carrot Quest event types for transactional email triggers.
 * Each event maps to a CQ automation rule that sends the email.
 */
export type CQEventName =
  | 'Payment Success'
  | 'Payment Failed'
  | 'Subscription Cancelled'
  | 'Subscription Expiring'
  | 'User Registered'
  | 'Inactive 7d'
  | 'Inactive 14d'
  | 'Inactive 30d'
  // Auth hook events (sent via Supabase Send Email Hook)
  | 'Email Confirmation'
  | 'Password Reset'
  | 'Email Change';

/**
 * Event data payload — flat key-value map sent alongside the event.
 */
export type CQEventData = Record<string, string | number | boolean | null>;
