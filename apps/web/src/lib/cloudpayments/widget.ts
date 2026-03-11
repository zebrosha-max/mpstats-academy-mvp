/**
 * CloudPayments Checkout widget wrapper
 * Loads via <script src="https://widget.cloudpayments.ru/bundles/checkout">
 * in the page head, then accessed via window.cp
 */

interface CloudPaymentsWidget {
  charge(
    options: Record<string, unknown>,
    onSuccess: (options: Record<string, unknown>) => void,
    onFail: (reason: string, options: Record<string, unknown>) => void,
  ): void;
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
  /** CloudPayments public ID */
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
  /** Widget skin */
  skin?: string;
  /** Additional data with recurrent config */
  data?: {
    cloudPayments?: {
      recurrent?: {
        interval: 'Month' | 'Week' | 'Day';
        period: number;
      };
    };
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
        'CloudPayments widget not loaded. Add <script src="https://widget.cloudpayments.ru/bundles/checkout"> to page head.',
      );
      resolve(false);
      return;
    }

    const widget = new window.cp.CloudPayments();

    widget.charge(
      {
        publicId: options.publicId,
        description: options.description,
        amount: options.amount,
        currency: options.currency ?? 'RUB',
        accountId: options.accountId,
        invoiceId: options.invoiceId,
        skin: options.skin,
        data: options.data ?? {
          cloudPayments: {
            recurrent: {
              interval: 'Month',
              period: 1,
            },
          },
        },
      },
      (_successOptions) => {
        resolve(true);
      },
      (_reason, _failOptions) => {
        resolve(false);
      },
    );
  });
}
