/**
 * CloudPayments webhook payload types.
 * @see https://developers.cloudpayments.ru/#uvedomleniya
 */

export type CloudPaymentsEventType =
  | 'check'
  | 'pay'
  | 'fail'
  | 'refund'
  | 'cancel'
  | 'recurrent';

export interface CloudPaymentsWebhookPayload {
  /** CloudPayments transaction ID (unique per transaction) */
  TransactionId: number;
  /** Payment amount */
  Amount: number;
  /** ISO 4217 currency code (e.g. "RUB") */
  Currency: string;
  /** Transaction datetime (ISO string) */
  DateTime: string;
  /** First 6 digits of card number */
  CardFirstSix: string;
  /** Last 4 digits of card number */
  CardLastFour: string;
  /** Card type: "Visa", "MasterCard", "Mir", etc. */
  CardType: string;
  /** Transaction status: "Completed", "Declined", etc. */
  Status: string;
  /** Operation type: "Payment", "Refund", etc. */
  OperationType: string;
  /** Our subscriptionId (passed when creating payment) */
  InvoiceId: string;
  /** Our userId (passed when creating payment) */
  AccountId: string;
  /** Payer email */
  Email: string;
  /** JSON-encoded custom data */
  Data?: string;
  /** Recurring payment token */
  Token?: string;
  /** Reason for decline */
  Reason?: string;
  /** Decline reason code */
  ReasonCode?: number;
  /** Status code (0 = success) */
  StatusCode?: number;

  // Recurrent-specific fields
  /** Recurrent interval: "Day", "Week", "Month" */
  Interval?: string;
  /** Recurrent period (e.g. 1 for every month) */
  Period?: number;
  /** Recurrent start date (ISO string) */
  StartDate?: string;
}

/** CloudPayments expects this response format. code=0 means success. */
export interface CloudPaymentsResponse {
  code: number;
}
