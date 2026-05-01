/**
 * OPay Webhook Handler Tests
 *
 * Covers:
 * - Valid webhook with SUCCESS status confirms payment and credits wallet
 * - Invalid / missing signature is rejected with 401
 * - Duplicate webhook (already success) is ignored with 200
 * - Unknown reference is ignored with 200 (no error thrown)
 * - FAIL / CLOSE status marks payment failed, does not credit wallet
 * - PENDING status takes no action
 * - Missing reference in payload returns 400
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";
import crypto from "crypto";

// ─── Mock db module ───────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  getPaymentByReference: vi.fn(),
  updatePayment: vi.fn(),
  getWalletByUserId: vi.fn(),
  creditWallet: vi.fn(),
}));

import * as db from "./db";
import { handleOpayWebhook } from "./_core/opay-webhook";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PUBLIC_KEY = "OPAYPUB_TEST_KEY_FOR_WEBHOOK_HMAC";
const MERCHANT_ID = "TEST_MERCHANT_123";

function setOpayEnv() {
  process.env.OPAY_MERCHANT_ID = MERCHANT_ID;
  process.env.OPAY_PUBLIC_KEY = PUBLIC_KEY;
  process.env.OPAY_SECRET_KEY = "OPAY_SEC_KEY_TEST";
  process.env.OPAY_BASE_URL = "https://sandboxapi.opayweb.com";
}

function clearOpayEnv() {
  delete process.env.OPAY_MERCHANT_ID;
  delete process.env.OPAY_PUBLIC_KEY;
  delete process.env.OPAY_SECRET_KEY;
  delete process.env.OPAY_BASE_URL;
  delete process.env.OPAY_WEBHOOK_SECRET;
}

function makeSignature(payload: string): string {
  return crypto
    .createHmac("sha512", PUBLIC_KEY)
    .update(payload)
    .digest("base64");
}

function makeRequest(
  body: object,
  overrideSignature?: string | null
): Partial<Request> {
  const payload = JSON.stringify(body);
  const rawBody = Buffer.from(payload, "utf8");
  const sig = overrideSignature !== undefined ? overrideSignature : makeSignature(payload);
  return {
    rawBody,
    body,
    headers: sig ? { authorization: `Bearer ${sig}` } : {},
  } as any;
}

function makeResponse(): { res: Partial<Response>; status: number; body: any } {
  const result: { status: number; body: any } = { status: 0, body: null };
  const res: Partial<Response> = {
    status: vi.fn().mockImplementation((code: number) => {
      result.status = code;
      return res;
    }),
    json: vi.fn().mockImplementation((data: any) => {
      result.body = data;
      return res;
    }),
  };
  return { res, ...result };
}

const mockPayment = {
  id: 1,
  userId: 42,
  reference: "OPY-TEST-001",
  amount: 500000,
  status: "pending",
  paymentProvider: "opay",
  webhookVerified: false,
  webhookReceivedAt: null,
};

const mockWallet = { id: 10, userId: 42, balance: 0 };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("OPay Webhook Handler", () => {
  beforeEach(() => {
    setOpayEnv();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearOpayEnv();
  });

  // ── Valid webhook confirms payment ──────────────────────────────────────────

  it("valid SUCCESS webhook confirms payment and credits wallet", async () => {
    const payload = {
      reference: "OPY-TEST-001",
      status: "SUCCESS",
      amount: 500000,
      currency: "NGN",
      merchantId: MERCHANT_ID,
    };

    vi.mocked(db.getPaymentByReference).mockResolvedValue(mockPayment as any);
    vi.mocked(db.updatePayment).mockResolvedValue(undefined);
    vi.mocked(db.getWalletByUserId).mockResolvedValue(mockWallet as any);
    vi.mocked(db.creditWallet).mockResolvedValue(undefined as any);

    const req = makeRequest(payload);
    const { res, status, body } = makeResponse();

    await handleOpayWebhook(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(db.updatePayment).toHaveBeenCalledWith(
      "OPY-TEST-001",
      expect.objectContaining({ status: "success", webhookVerified: true })
    );
    expect(db.creditWallet).toHaveBeenCalledWith(
      mockWallet.id,
      5000, // 500000 kobo → ₦5000
      expect.stringContaining("OPY-TEST-001"),
      "payment",
      "1"
    );
  });

  // ── Invalid signature rejected ──────────────────────────────────────────────

  it("rejects request with invalid signature with 401", async () => {
    const payload = { reference: "OPY-TEST-001", status: "SUCCESS", amount: 500000 };
    const req = makeRequest(payload, "invalidsignature==");
    const { res } = makeResponse();

    await handleOpayWebhook(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(db.getPaymentByReference).not.toHaveBeenCalled();
    expect(db.creditWallet).not.toHaveBeenCalled();
  });

  it("rejects request with missing Authorization header with 400", async () => {
    const payload = { reference: "OPY-TEST-001", status: "SUCCESS", amount: 500000 };
    const req = makeRequest(payload, null); // null → no header
    const { res } = makeResponse();

    await handleOpayWebhook(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.creditWallet).not.toHaveBeenCalled();
  });

  // ── Duplicate webhook ignored ───────────────────────────────────────────────

  it("ignores duplicate webhook when payment is already success", async () => {
    const payload = {
      reference: "OPY-TEST-001",
      status: "SUCCESS",
      amount: 500000,
      currency: "NGN",
      merchantId: MERCHANT_ID,
    };

    vi.mocked(db.getPaymentByReference).mockResolvedValue({
      ...mockPayment,
      status: "success", // already processed
    } as any);

    const req = makeRequest(payload);
    const { res } = makeResponse();

    await handleOpayWebhook(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(db.updatePayment).not.toHaveBeenCalled();
    expect(db.creditWallet).not.toHaveBeenCalled();
  });

  // ── Unknown reference ignored ───────────────────────────────────────────────

  it("returns 200 and ignores unknown reference without throwing", async () => {
    const payload = {
      reference: "OPY-UNKNOWN-999",
      status: "SUCCESS",
      amount: 100000,
      currency: "NGN",
      merchantId: MERCHANT_ID,
    };

    vi.mocked(db.getPaymentByReference).mockResolvedValue(null);

    const req = makeRequest(payload);
    const { res } = makeResponse();

    await handleOpayWebhook(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(db.creditWallet).not.toHaveBeenCalled();
  });

  // ── FAIL / CLOSE status ─────────────────────────────────────────────────────

  it("marks payment failed on FAIL status without crediting wallet", async () => {
    const payload = {
      reference: "OPY-TEST-001",
      status: "FAIL",
      amount: 500000,
      currency: "NGN",
      merchantId: MERCHANT_ID,
    };

    vi.mocked(db.getPaymentByReference).mockResolvedValue(mockPayment as any);
    vi.mocked(db.updatePayment).mockResolvedValue(undefined);

    const req = makeRequest(payload);
    const { res } = makeResponse();

    await handleOpayWebhook(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(db.updatePayment).toHaveBeenCalledWith(
      "OPY-TEST-001",
      expect.objectContaining({ status: "failed", webhookVerified: true })
    );
    expect(db.creditWallet).not.toHaveBeenCalled();
  });

  it("marks payment failed on CLOSE status without crediting wallet", async () => {
    const payload = {
      reference: "OPY-TEST-001",
      status: "CLOSE",
      amount: 500000,
      currency: "NGN",
      merchantId: MERCHANT_ID,
    };

    vi.mocked(db.getPaymentByReference).mockResolvedValue(mockPayment as any);
    vi.mocked(db.updatePayment).mockResolvedValue(undefined);

    const req = makeRequest(payload);
    const { res } = makeResponse();

    await handleOpayWebhook(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(db.updatePayment).toHaveBeenCalledWith(
      "OPY-TEST-001",
      expect.objectContaining({ status: "failed" })
    );
    expect(db.creditWallet).not.toHaveBeenCalled();
  });

  // ── PENDING status — no action ──────────────────────────────────────────────

  it("takes no action on PENDING status", async () => {
    const payload = {
      reference: "OPY-TEST-001",
      status: "PENDING",
      amount: 500000,
      currency: "NGN",
      merchantId: MERCHANT_ID,
    };

    vi.mocked(db.getPaymentByReference).mockResolvedValue(mockPayment as any);

    const req = makeRequest(payload);
    const { res } = makeResponse();

    await handleOpayWebhook(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(db.updatePayment).not.toHaveBeenCalled();
    expect(db.creditWallet).not.toHaveBeenCalled();
  });

  // ── Missing reference ───────────────────────────────────────────────────────

  it("returns 400 when reference is missing from payload", async () => {
    const payload = { status: "SUCCESS", amount: 500000, currency: "NGN" };
    const req = makeRequest(payload);
    const { res } = makeResponse();

    await handleOpayWebhook(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.creditWallet).not.toHaveBeenCalled();
  });

  // ── OPay not configured ─────────────────────────────────────────────────────

  it("rejects with 401 when OPay is not configured (signature cannot be verified)", async () => {
    clearOpayEnv(); // No keys set
    const payload = {
      reference: "OPY-TEST-001",
      status: "SUCCESS",
      amount: 500000,
      currency: "NGN",
      merchantId: MERCHANT_ID,
    };
    // Even a correctly-formed signature will fail because verifyOpayWebhookSignature
    // returns false when OPay is not configured
    const req = makeRequest(payload, makeSignature(JSON.stringify(payload)));
    const { res } = makeResponse();

    await handleOpayWebhook(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(db.creditWallet).not.toHaveBeenCalled();
  });
});
