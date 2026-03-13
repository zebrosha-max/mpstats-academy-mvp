/**
 * Carrot Quest event types for transactional email triggers.
 * Each event maps to a CQ automation rule that sends the email.
 */
export type CQEventName =
  | '$payment_success'
  | '$payment_failed'
  | '$subscription_cancelled'
  | '$subscription_expiring'
  | '$user_registered'
  | '$diagnostic_completed'
  | '$inactive_7d'
  | '$inactive_14d'
  | '$inactive_30d'
  // Auth hook events (sent via Supabase Send Email Hook)
  | '$email_confirmation'
  | '$password_reset'
  | '$email_change';

/**
 * Event data payload — flat key-value map sent alongside the event.
 */
export type CQEventData = Record<string, string | number | boolean | null>;
