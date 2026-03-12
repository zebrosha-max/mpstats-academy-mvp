/**
 * CloudPayments widget wrapper
 * Loads via <script src="https://widget.cloudpayments.ru/bundles/cloudpayments">
 * in the page head, then accessed via window.cp
 */

interface CloudPaymentsCallbacks {
  onSuccess?: (options: Record<string, unknown>) => void;
  onFail?: (reason: string, options: Record<string, unknown>) => void;
  onComplete?: (paymentResult: Record<string, unknown>, options: Record<string, unknown>) => void;
}

interface CloudPaymentsWidget {
  charge(
    options: Record<string, unknown>,
    callbacks: CloudPaymentsCallbacks,
  ): void;
}

interface CloudPaymentsConstructor {
  new (config?: { publicId?: string; language?: string }): CloudPaymentsWidget;
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
        'CloudPayments widget not loaded. Add <script src="https://widget.cloudpayments.ru/bundles/cloudpayments"> to page head.',
      );
      resolve(false);
      return;
    }

    const widget = new window.cp.CloudPayments({ publicId: options.publicId });

    widget.charge(
      {
        description: options.description,
        amount: options.amount,
        currency: options.currency ?? 'RUB',
        accountId: options.accountId,
        invoiceId: options.invoiceId,
        data: options.data ?? {
          cloudPayments: {
            recurrent: {
              interval: 'Month',
              period: 1,
            },
          },
        },
      },
      {
        onSuccess: (_options) => {
          resolve(true);
        },
        onFail: (_reason, _options) => {
          resolve(false);
        },
      },
    );
  });
}
