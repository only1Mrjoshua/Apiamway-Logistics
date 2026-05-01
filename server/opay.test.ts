/**
 * OPay integration tests
 *
 * Covers:
 * - isOpayConfigured() returns false when env vars are missing
 * - isOpayConfigured() returns true when all required vars are set
 * - generateOpayReference() produces unique, correctly prefixed references
 * - initializeOpayPayment() throws when OPay is not configured
 * - verifyOpayPayment() throws when OPay is not configured
 * - checkOpayHealth() returns configured:false when keys are missing
 * - verifyOpayWebhookSignature() returns false when OPay is not configured
 * - parseOpayWebhook() returns null on invalid signature
 * - Paystack functions are unaffected by OPay configuration state
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isOpayConfigured,
  getOpayConfig,
  getOpayPublicKey,
  generateOpayReference,
  initializeOpayPayment,
  verifyOpayPayment,
  checkOpayHealth,
  verifyOpayWebhookSignature,
  parseOpayWebhook,
} from "./opay";
import * as paystack from "./paystack";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const OPAY_ENV = {
  OPAY_MERCHANT_ID: "TEST_MERCHANT_123",
  OPAY_PUBLIC_KEY: "OPAY_PUB_KEY_TEST",
  OPAY_SECRET_KEY: "OPAY_SEC_KEY_TEST",
  OPAY_BASE_URL: "https://sandboxapi.opayweb.com",
  OPAY_WEBHOOK_SECRET: "webhook_secret_test",
};

function setOpayEnv() {
  for (const [k, v] of Object.entries(OPAY_ENV)) {
    process.env[k] = v;
  }
}

function clearOpayEnv() {
  for (const k of Object.keys(OPAY_ENV)) {
    delete process.env[k];
  }
}

// ─── Configuration tests ──────────────────────────────────────────────────────

describe("OPay configuration", () => {
  afterEach(() => clearOpayEnv());

  it("isOpayConfigured() returns false when no env vars are set", () => {
    clearOpayEnv();
    expect(isOpayConfigured()).toBe(false);
  });

  it("isOpayConfigured() returns false when only some vars are set", () => {
    process.env.OPAY_MERCHANT_ID = "TEST";
    process.env.OPAY_PUBLIC_KEY = "PUB";
    // OPAY_SECRET_KEY and OPAY_BASE_URL missing
    expect(isOpayConfigured()).toBe(false);
  });

  it("isOpayConfigured() returns true when all required vars are set", () => {
    setOpayEnv();
    expect(isOpayConfigured()).toBe(true);
  });

  it("getOpayConfig() returns null when not configured", () => {
    clearOpayEnv();
    expect(getOpayConfig()).toBeNull();
  });

  it("getOpayConfig() returns full config when configured", () => {
    setOpayEnv();
    const config = getOpayConfig();
    expect(config).not.toBeNull();
    expect(config!.merchantId).toBe(OPAY_ENV.OPAY_MERCHANT_ID);
    expect(config!.publicKey).toBe(OPAY_ENV.OPAY_PUBLIC_KEY);
    expect(config!.secretKey).toBe(OPAY_ENV.OPAY_SECRET_KEY);
    expect(config!.baseUrl).toBe(OPAY_ENV.OPAY_BASE_URL);
    expect(config!.webhookSecret).toBe(OPAY_ENV.OPAY_WEBHOOK_SECRET);
  });

  it("getOpayPublicKey() returns null when not configured", () => {
    clearOpayEnv();
    expect(getOpayPublicKey()).toBeNull();
  });

  it("getOpayPublicKey() returns the public key when configured", () => {
    setOpayEnv();
    expect(getOpayPublicKey()).toBe(OPAY_ENV.OPAY_PUBLIC_KEY);
  });
});

// ─── Reference generation ─────────────────────────────────────────────────────

describe("generateOpayReference()", () => {
  it("generates a reference with the default OPY prefix", () => {
    const ref = generateOpayReference();
    expect(ref).toMatch(/^OPY-/);
  });

  it("generates a reference with a custom prefix", () => {
    const ref = generateOpayReference("TEST");
    expect(ref).toMatch(/^TEST-/);
  });

  it("generates unique references on successive calls", () => {
    const refs = new Set(Array.from({ length: 20 }, () => generateOpayReference()));
    expect(refs.size).toBe(20);
  });

  it("generates uppercase references", () => {
    const ref = generateOpayReference("abc");
    expect(ref).toBe(ref.toUpperCase());
  });
});

// ─── Graceful fallback when not configured ────────────────────────────────────

describe("OPay operations when not configured", () => {
  beforeEach(() => clearOpayEnv());
  afterEach(() => clearOpayEnv());

  it("initializeOpayPayment() throws a descriptive error", async () => {
    await expect(
      initializeOpayPayment({
        reference: "OPY-TEST-001",
        amount: 500000,
        email: "user@example.com",
        callbackUrl: "https://example.com/wallet",
      })
    ).rejects.toThrow("OPay not configured");
  });

  it("verifyOpayPayment() throws a descriptive error", async () => {
    await expect(verifyOpayPayment("OPY-TEST-001")).rejects.toThrow(
      "OPay not configured"
    );
  });

  it("checkOpayHealth() returns configured:false without throwing", async () => {
    const health = await checkOpayHealth();
    expect(health.configured).toBe(false);
    expect(health.connected).toBe(false);
    expect(health.mode).toBe("unknown");
    expect(health.error).toBeTruthy();
  });

  it("verifyOpayWebhookSignature() returns false without throwing", () => {
    const result = verifyOpayWebhookSignature("payload", "signature");
    expect(result).toBe(false);
  });

  it("parseOpayWebhook() returns null without throwing", () => {
    const result = parseOpayWebhook('{"reference":"OPY-001"}', "badsig");
    expect(result).toBeNull();
  });
});

// ─── Webhook signature verification ──────────────────────────────────────────

describe("verifyOpayWebhookSignature()", () => {
  afterEach(() => clearOpayEnv());

  it("returns false for a tampered payload", () => {
    setOpayEnv();
    // Generate a valid signature for one payload, then check against a different payload
    const crypto = require("crypto");
    const originalPayload = '{"reference":"OPY-001","status":"SUCCESS"}';
    const tamperedPayload = '{"reference":"OPY-001","status":"FAIL"}';
    const validSig = crypto
      .createHmac("sha512", OPAY_ENV.OPAY_PUBLIC_KEY)
      .update(originalPayload)
      .digest("base64");

    expect(verifyOpayWebhookSignature(tamperedPayload, validSig)).toBe(false);
  });

  it("returns true for a correctly signed payload", () => {
    setOpayEnv();
    const crypto = require("crypto");
    const payload = '{"reference":"OPY-001","status":"SUCCESS","amount":500000}';
    const validSig = crypto
      .createHmac("sha512", OPAY_ENV.OPAY_PUBLIC_KEY)
      .update(payload)
      .digest("base64");

    expect(verifyOpayWebhookSignature(payload, validSig)).toBe(true);
  });
});

// ─── parseOpayWebhook ─────────────────────────────────────────────────────────

describe("parseOpayWebhook()", () => {
  afterEach(() => clearOpayEnv());

  it("returns null when signature is invalid", () => {
    setOpayEnv();
    const result = parseOpayWebhook('{"reference":"OPY-001"}', "invalidsig");
    expect(result).toBeNull();
  });

  it("returns the parsed payload when signature is valid", () => {
    setOpayEnv();
    const crypto = require("crypto");
    const webhookData = {
      reference: "OPY-001",
      status: "SUCCESS" as const,
      amount: 500000,
      currency: "NGN",
      merchantId: OPAY_ENV.OPAY_MERCHANT_ID,
    };
    const payload = JSON.stringify(webhookData);
    const validSig = crypto
      .createHmac("sha512", OPAY_ENV.OPAY_PUBLIC_KEY)
      .update(payload)
      .digest("base64");

    const result = parseOpayWebhook(payload, validSig);
    expect(result).not.toBeNull();
    expect(result!.reference).toBe("OPY-001");
    expect(result!.status).toBe("SUCCESS");
  });
});

// ─── checkOpayHealth() mode detection ────────────────────────────────────────

describe("checkOpayHealth() mode detection", () => {
  afterEach(() => clearOpayEnv());

  it("reports sandbox mode for sandbox base URL", async () => {
    setOpayEnv(); // OPAY_BASE_URL = https://sandboxapi.opayweb.com
    // Mock fetch to avoid real network call
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: "02003", message: "order not exist" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const health = await checkOpayHealth();
    expect(health.configured).toBe(true);
    expect(health.mode).toBe("sandbox");

    vi.unstubAllGlobals();
  });

  it("reports production mode for production base URL", async () => {
    setOpayEnv();
    process.env.OPAY_BASE_URL = "https://api.opayweb.com";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: "02003", message: "order not exist" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const health = await checkOpayHealth();
    expect(health.mode).toBe("production");

    vi.unstubAllGlobals();
  });

  it("reports connected:false when fetch throws a network error", async () => {
    setOpayEnv();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const health = await checkOpayHealth();
    expect(health.configured).toBe(true);
    expect(health.connected).toBe(false);
    expect(health.error).toContain("ECONNREFUSED");

    vi.unstubAllGlobals();
  });
});

// ─── Paystack unaffected ──────────────────────────────────────────────────────

describe("Paystack is unaffected by OPay configuration state", () => {
  it("paystack.getPublicKey() works regardless of OPay env vars", () => {
    clearOpayEnv();
    // getPublicKey() reads PAYSTACK_PUBLIC_KEY, not OPay vars
    // Just confirm it doesn't throw
    expect(() => paystack.getPublicKey()).not.toThrow();
  });

  it("paystack.checkPaystackHealth() is callable when OPay is not configured", async () => {
    clearOpayEnv();
    // Should not throw — it reads its own env vars independently
    await expect(paystack.checkPaystackHealth()).resolves.toBeDefined();
  });
});
