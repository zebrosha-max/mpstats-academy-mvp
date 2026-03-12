# CloudPayments Widget API Reference (fetched 2026-03-12)

## Script Loading

```html
<script src="https://widget.cloudpayments.ru/bundles/cloudpayments.js"></script>
```

## Widget Initialization

```javascript
const widget = new cp.CloudPayments();
```

## Main Method: start()

```javascript
widget.start(intentParams: CreateIntentCommand): Promise<WidgetResult>
```

## Core Parameters (intentParams)

| Parameter | Type | Required | Details |
|-----------|------|----------|---------|
| publicTerminalId | string | Yes | Terminal identifier from personal account |
| amount | float | Yes | Must be > 0 |
| currency | string enum | Yes | RUB, USD, EUR, GBP, etc. |
| paymentSchema | string enum | Yes | "Single" or "Dual" |
| culture | string | No | Language code; default "ru-RU" |
| description | string | No | Payment purpose text |
| externalId | string | No | Your system order identifier |
| receiptEmail | string | No | Email for receipt delivery |
| tokenize | boolean | No | Enable card storage for future payments |
| skin | string enum | No | "classic" (light) or "modern" (dark) |
| autoClose | int | No | Auto-close after success (3-10 seconds) |
| emailBehavior | string enum | No | "Required", "Hidden", or "Optional" |
| retryPayment | boolean | No | Show retry button on failure; default true |

## Recurrent Payment Setup

```javascript
recurrent: {
  period: 1,
  interval: 'Day' | 'Week' | 'Month',
  amount: 500.00,
  startDate: "2030-04-15T00:00:00Z",
  maxPeriods: 50
}
```

## Payer Information (userInfo)

```javascript
userInfo: {
  firstName: "Ivan",
  lastName: "Petrov",
  phone: "+71234567890",
  email: "user@example.com",
  accountId: "user_id_123"
}
```

**IMPORTANT:** accountId goes inside userInfo, NOT top-level!

## Callback Handling

```javascript
widget.oncomplete = (result) => {
  console.log(result);
}

widget.start(intentParams)
  .then(widgetResult => console.log('Success:', widgetResult))
  .catch(error => console.log('Error:', error));
```

## Response Structure

Success:
```json
{
  "type": "payment",
  "status": "success",
  "data": { "transactionId": 3059300327 }
}
```

Failure:
```json
{
  "type": "error",
  "status": "fail",
  "data": { "transactionId": 3192600857, "ReasonCode": 5206 },
  "message": "3-D Secure authorization failed"
}
```

## Test Cards

- Visa: 4242 4242 4242 4242
- MasterCard: 5555 5555 5555 4444
- Expiration: Any future date
- CVV: Any 3-digit code

## Payment Schemes

- Single (SMS): Authorization + settlement simultaneously
- Dual (DMS): Authorization blocks funds, settlement within 7 days

## Full Example (Recurrent)

```javascript
const widget = new cp.CloudPayments();

const intentParams = {
  publicTerminalId: "pk_xxx",
  amount: 4990,
  currency: "RUB",
  paymentSchema: "Single",
  description: "Полный доступ — MPSTATS Academy",
  externalId: "subscription_id_123",
  userInfo: {
    accountId: "user_uuid",
    email: "user@example.com"
  },
  recurrent: {
    period: 1,
    interval: "Month",
    amount: 4990
  },
  retryPayment: true,
  autoClose: 5
};

widget.oncomplete = (result) => {
  if (result.status === 'success') {
    // redirect to profile
  }
};

widget.start(intentParams)
  .then(result => console.log(result))
  .catch(err => console.error(err));
```
