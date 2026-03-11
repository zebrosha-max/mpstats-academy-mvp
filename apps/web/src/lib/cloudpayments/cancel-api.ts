/**
 * Server-side CloudPayments subscription cancellation.
 * Uses CloudPayments REST API with HTTP Basic Auth.
 */

const CP_CANCEL_URL = 'https://api.cloudpayments.ru/subscriptions/cancel';

interface CPCancelResponse {
  Success: boolean;
  Message?: string;
}

/**
 * Cancel a CloudPayments subscription by ID.
 * For MVP, we pass our subscription ID. If CloudPayments needs their
 * internal recurrent ID, we'll store it from the recurrent webhook later.
 *
 * @param subscriptionId - Our subscription ID (or CP recurrent ID when available)
 * @returns true if cancellation succeeded, false otherwise
 */
export async function cancelCloudPaymentsSubscription(
  subscriptionId: string,
): Promise<boolean> {
  const publicId = process.env.CLOUDPAYMENTS_PUBLIC_ID;
  const apiSecret = process.env.CLOUDPAYMENTS_API_SECRET;

  if (!publicId || !apiSecret) {
    console.error('CloudPayments credentials not configured');
    return false;
  }

  const credentials = Buffer.from(`${publicId}:${apiSecret}`).toString('base64');

  try {
    const response = await fetch(CP_CANCEL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({ Id: subscriptionId }),
    });

    if (!response.ok) {
      console.error(
        `CloudPayments cancel failed: HTTP ${response.status} ${response.statusText}`,
      );
      return false;
    }

    const data = (await response.json()) as CPCancelResponse;
    return data.Success === true;
  } catch (error) {
    console.error('CloudPayments cancel error:', error);
    return false;
  }
}
