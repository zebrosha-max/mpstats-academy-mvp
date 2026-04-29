/**
 * CustomerReceipt schema (54-FZ / ФФД).
 * @see https://developers.cloudpayments.ru/#kassovyy-chek
 *
 * Passed at widget intent root for the FIRST payment AND inside
 * `recurrent.receipt` as a TEMPLATE for all subsequent auto-charges.
 * Without `recurrent.receipt` CP fires recurrents with CustomerReceipt:null
 * — exactly the bug observed in operations 3477150564, 3479149166.
 */
export interface ReceiptItem {
  /** Product/service name, 1–128 chars. Must mirror the offer wording. */
  label: string;
  price: number;
  quantity: number;
  amount: number;
  /** VAT code (null = without VAT, 0/5/7/10/20/22 = standard, 105/107/110/120/122 = calculated) */
  vat: number | null;
  /** Payment method (3 = full prepayment, 4 = full settlement) */
  method: number;
  /** Subject of payment (4 = service, 13 = subscription — requires FFD ≥ 1.2) */
  object: number;
}

export interface ReceiptAmounts {
  electronic?: number;
  cash?: number;
  advancePayment?: number;
  credit?: number;
  provision?: number;
}

export interface CustomerReceipt {
  items: ReceiptItem[];
  /** Taxation system: 0=ОСН, 1=УСН доходы, 2=УСН доходы−расходы, 3=ЕНВД, 4=ЕСХН, 5=ПСН */
  taxationSystem: number;
  /** Customer email — sufficient under 54-FZ when phone is omitted */
  email?: string;
  phone?: string;
  isBso?: boolean;
  amounts?: ReceiptAmounts;
}
