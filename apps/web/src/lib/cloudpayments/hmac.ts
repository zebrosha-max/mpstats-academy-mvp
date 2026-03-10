import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify CloudPayments webhook HMAC-SHA256 signature.
 *
 * CloudPayments sends the signature in the `Content-HMAC` header
 * as a base64-encoded HMAC-SHA256 of the raw request body,
 * using the API Secret as the key.
 *
 * @param body - Raw request body (string)
 * @param signature - Value of Content-HMAC header (base64)
 * @returns true if signature is valid, false otherwise
 */
export function verifyCloudPaymentsHmac(
  body: string,
  signature: string,
): boolean {
  const secret = process.env.CLOUDPAYMENTS_API_SECRET;

  if (!secret) {
    console.error(
      '[CloudPayments] CLOUDPAYMENTS_API_SECRET is not configured',
    );
    return false;
  }

  if (!signature) {
    return false;
  }

  try {
    const expectedHmac = createHmac('sha256', secret)
      .update(body, 'utf-8')
      .digest('base64');

    const expectedBuffer = Buffer.from(expectedHmac, 'base64');
    const receivedBuffer = Buffer.from(signature, 'base64');

    // Buffers must be the same length for timingSafeEqual
    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch {
    console.error('[CloudPayments] HMAC verification error');
    return false;
  }
}
