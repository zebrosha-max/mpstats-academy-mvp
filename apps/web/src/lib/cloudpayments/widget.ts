/**
 * CloudPayments widget wrapper (new API — widget.start())
 * Loads via <script src="https://widget.cloudpayments.ru/bundles/cloudpayments">
 * in the page head, then accessed via window.cp
 */

interface WidgetResult {
  success: boolean;
  [key: string]: unknown;
}

interface CloudPaymentsWidget {
  start(intentParams: Record<string, unknown>): Promise<WidgetResult>;
  oncomplete?: (result: WidgetResult) => void;
}

interface CloudPaymentsConstructor {
  new (): CloudPaymentsWidget;
}

declare global {
  interface Window {
    cp?: {
      CloudPayments: CloudPaymentsConstructor;
    };
  }
}

export interface CPChargeOptions {
  /** CloudPayments public terminal ID */
  publicId: string;
  /** Payment description shown to user */
  description: string;
  /** Amount in rubles */
  amount: number;
  /** Currency code */
  currency?: string;
  /** User ID (accountId for CloudPayments) */
  accountId: string;
  /** Our subscription ID (invoiceId for CloudPayments) */
  invoiceId: string;
  /** Recurrent payment config */
  recurrent?: {
    interval: 'Month' | 'Week' | 'Day';
    period: number;
    amount?: number;
  };
}

/**
 * Open CloudPayments payment widget.
 * Resolves true on successful payment, false on failure/cancel.
 */
export function openPaymentWidget(options: CPChargeOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!window.cp) {
      console.error(
        'CloudPayments widget not loaded. Add <script src="https://widget.cloudpayments.ru/bundles/cloudpayments"> to page head.',
      );
      resolve(false);
      return;
    }

    const widget = new window.cp.CloudPayments();

    const intentParams: Record<string, unknown> = {
      publicTerminalId: options.publicId,
      description: options.description,
      amount: options.amount,
      currency: options.currency ?? 'RUB',
      accountId: options.accountId,
      invoiceId: options.invoiceId,
      paymentSchema: 'Single',
    };

    if (options.recurrent) {
      intentParams.recurrent = {
        interval: options.recurrent.interval,
        period: options.recurrent.period,
        amount: options.recurrent.amount ?? options.amount,
      };
    }

    widget
      .start(intentParams)
      .then((result) => {
        resolve(result.success === true);
      })
      .catch(() => {
        resolve(false);
      });
  });
}
