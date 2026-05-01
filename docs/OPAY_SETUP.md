# OPay Payment Integration

## Overview

Apiamway supports two payment providers for wallet top-ups: **Paystack** (default, always available) and **OPay** (optional, activated by supplying credentials). When OPay credentials are absent or incomplete the system falls back silently to Paystack-only mode — no code change is required.

---

## Environment Variables

All five variables are **optional**. Leave them empty to keep Paystack-only mode.

| Variable | Description | Example |
|---|---|---|
| `OPAY_MERCHANT_ID` | Your OPay merchant ID | `256621090001` |
| `OPAY_PUBLIC_KEY` | OPay public key (used for webhook HMAC verification) | `OPAYPUB…` |
| `OPAY_SECRET_KEY` | OPay secret key (server-side HMAC for API calls) | `OPAYPRIV…` |
| `OPAY_BASE_URL` | OPay API base URL | `https://cashier.opayweb.com` (production) or `https://cashier.pre.opayweb.com` (sandbox) |
| `OPAY_WEBHOOK_SECRET` | Reserved for future use (currently unused) | any strong random string |

Set these via **Admin → Settings → Secrets** in the Manus Management UI, or via `webdev_request_secrets` in the agent.

---

## How It Works

### Initialization check

`server/opay.ts` exports `isOpayConfigured()` which returns `true` only when all four required values (`OPAY_MERCHANT_ID`, `OPAY_PUBLIC_KEY`, `OPAY_SECRET_KEY`, `OPAY_BASE_URL`) are non-empty. Every OPay procedure checks this guard before proceeding.

### Hosted checkout flow

1. The user opens **My Wallet** and clicks **Top Up**.
2. A dialog appears with two provider tiles: **Paystack** and **OPay**. The OPay tile is greyed-out and unselectable when `isOpayConfigured()` returns `false`.
3. If OPay is selected, the frontend calls `trpc.payments.initializeOpayTopup` with the amount and a `callbackUrl` pointing back to `/wallet`.
4. The server calls the OPay Cashier API (`POST /api/cashier/initialize`), receives a `cashierUrl`, and returns it to the frontend.
5. The user is redirected to the OPay hosted payment page.
6. After payment, OPay redirects the user back to `callbackUrl`. The frontend detects the `reference` query parameter and calls `trpc.payments.verifyOpay` to confirm and credit the wallet.

### Idempotency

Both the redirect-verify path and the webhook path check `payment.status === "success"` before crediting the wallet. Whichever path runs first credits the wallet; the second path silently skips. This means double-crediting is impossible regardless of delivery order.

### Payment record

Every transaction — Paystack or OPay — is stored in the `payments` table with a `paymentProvider` column (`"paystack"` | `"opay"`, default `"paystack"`). OPay references use the prefix `OPY-`.

---

## Webhook

### Endpoint

```
POST /api/webhooks/opay
```

**Staging URL:**
```
https://apiamway-96zj69hn.manus.space/api/webhooks/opay
```

### How to configure in the OPay dashboard

1. Log in to the [OPay Merchant Dashboard](https://merchant.opayweb.com).
2. Navigate to **Settings → Webhook** (or **Developer → Webhook URL**).
3. Set the **Webhook URL** to the staging URL above (or your production domain for live).
4. Save. OPay will POST a JSON payload to this URL for every payment status change.

### Signature verification

OPay signs the raw request body with HMAC-SHA512 using your **public key** (not secret key — this is OPay's convention for webhooks). The signature is sent in the `Authorization: Bearer <base64sig>` header. The handler rejects any request where the signature does not match.

### Webhook payload shape

```json
{
  "reference": "OPY-ABC123-DEF456",
  "orderNo": "2024010512345678",
  "status": "SUCCESS",
  "amount": 500000,
  "currency": "NGN",
  "merchantId": "256621090001",
  "payChannel": "BankTransfer",
  "payTime": "2024-01-05T10:30:00Z"
}
```

`status` values: `SUCCESS` | `PENDING` | `FAIL` | `CLOSE`

### Webhook behaviour

| Condition | Action |
|---|---|
| Invalid / missing signature | Returns `401` — OPay will retry |
| Unknown reference | Returns `200` — silently ignored (no retry) |
| Already `status = "success"` | Returns `200` — duplicate ignored |
| `status = "SUCCESS"` (new) | Marks payment success, credits wallet, returns `200` |
| `status = "FAIL"` or `"CLOSE"` | Marks payment failed, returns `200` |
| `status = "PENDING"` | No action, returns `200` |

### Reliability: webhook + redirect verify

Both paths are active simultaneously. The redirect-verify call (`trpc.payments.verifyOpay`) runs immediately after the user returns from OPay's hosted page. The webhook fires server-to-server, typically within seconds. Whichever arrives first credits the wallet; the second is idempotently ignored. This dual-path design ensures the wallet is credited even if the user closes the browser before the redirect completes.

---

## Admin Tools

Go to **Admin → Testing Tools → OPay Payment Tools** to:

- **Check OPay Status** — pings the OPay API and reports `configured`, `connected`, and `mode` (sandbox / production).
- **Manual OPay Reference Verify** — enter any `OPY-…` reference to manually verify and credit the wallet. Useful for recovering stuck payments.

---

## Sandbox vs Production

| Environment | `OPAY_BASE_URL` |
|---|---|
| Sandbox / staging | `https://cashier.pre.opayweb.com` |
| Production | `https://cashier.opayweb.com` |

The `checkOpayHealth` procedure reports the active mode based on the configured base URL.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| OPay tile greyed out in wallet | Missing env vars | Set all four required vars in Secrets |
| `PRECONDITION_FAILED` from `initializeOpayTopup` | `isOpayConfigured()` returned false at request time | Restart server after setting secrets |
| `cashierUrl` missing in OPay response | Wrong `OPAY_BASE_URL` or invalid credentials | Verify base URL matches environment (sandbox vs prod) |
| Wallet not credited after redirect | `verifyOpay` not called / OPay status not `SUCCESS` | Use Manual Verify in Testing Tools |
| Webhook returns `401` | Signature mismatch | Confirm `OPAY_PUBLIC_KEY` matches the key in OPay dashboard |
| Webhook returns `200` but wallet not credited | Payment was already credited via redirect-verify | Expected — idempotency working correctly |
| Health check shows `connected: false` | Network issue or wrong base URL | Check `OPAY_BASE_URL` and firewall rules |
