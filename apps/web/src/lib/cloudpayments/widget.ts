/**
 * CloudPayments widget wrapper (new API — widget.start())
 * Docs: docs/cloudpayments-api-2026-03-12.md
 * Loads via <script src="https://widget.cloudpayments.ru/bundles/cloudpayments">
 */

interface WidgetResult {
  type: string;
  status: string;
  data?: Record<string, unknown>;
  message?: string;
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
  publicId: string;
  description: string;
  amount: number;
  currency?: string;
  accountId: string;
  invoiceId: string;
  email?: string;
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
      console.error('CloudPayments widget not loaded');
      resolve(false);
      return;
    }

    const widget = new window.cp.CloudPayments();

    const intentParams: Record<string, unknown> = {
      publicTerminalId: options.publicId,
      description: options.description,
      amount: options.amount,
      currency: options.currency ?? 'RUB',
      paymentSchema: 'Single',
      externalId: options.invoiceId,
      retryPayment: true,
      userInfo: {
        accountId: options.accountId,
        ...(options.email ? { email: options.email } : {}),
      },
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
        resolve(result.status === 'success');
      })
      .catch(() => {
        resolve(false);
      });
  });
}
