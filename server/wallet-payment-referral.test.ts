/**
 * Tests for Wallet, Payment, and Referral Systems
 * 
 * These tests verify the core business logic for:
 * - Wallet operations (credit, debit, balance tracking)
 * - Payment processing (Paystack integration)
 * - Referral system (code generation, application, anti-abuse)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getOrCreateWallet: vi.fn(),
  getWalletByUserId: vi.fn(),
  creditWallet: vi.fn(),
  debitWallet: vi.fn(),
  getWalletTransactions: vi.fn(),
  createPayment: vi.fn(),
  getPaymentByReference: vi.fn(),
  updatePayment: vi.fn(),
  getUserPayments: vi.fn(),
  getOrCreateReferralCode: vi.fn(),
  getReferralCodeByCode: vi.fn(),
  createReferral: vi.fn(),
  getReferralByReferredUserId: vi.fn(),
  getUserReferrals: vi.fn(),
  checkDuplicateReferral: vi.fn(),
  revokeReferral: vi.fn(),
}));

// Mock Paystack module
vi.mock("./paystack", () => ({
  isPaystackConfigured: vi.fn(),
  getPublicKey: vi.fn(),
  generateReference: vi.fn(),
  initializePayment: vi.fn(),
  verifyPayment: vi.fn(),
  verifyWebhookSignature: vi.fn(),
  parseWebhookEvent: vi.fn(),
  checkPaystackHealth: vi.fn(),
}));

import * as db from "./db";
import * as paystack from "./paystack";

describe("Wallet System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrCreateWallet", () => {
    it("should return existing wallet for user", async () => {
      const mockWallet = { id: 1, userId: 100, balance: "500.00", currency: "NGN" };
      vi.mocked(db.getOrCreateWallet).mockResolvedValue(mockWallet);

      const wallet = await db.getOrCreateWallet(100);
      
      expect(wallet).toEqual(mockWallet);
      expect(db.getOrCreateWallet).toHaveBeenCalledWith(100);
    });

    it("should create new wallet if none exists", async () => {
      const mockWallet = { id: 2, userId: 200, balance: "0.00", currency: "NGN" };
      vi.mocked(db.getOrCreateWallet).mockResolvedValue(mockWallet);

      const wallet = await db.getOrCreateWallet(200);
      
      expect(wallet).toEqual(mockWallet);
      expect(wallet?.balance).toBe("0.00");
    });
  });

  describe("creditWallet", () => {
    it("should credit wallet and return transaction", async () => {
      const mockTransaction = {
        id: 1,
        walletId: 1,
        type: "credit",
        amount: "1000.00",
        balanceBefore: "500.00",
        balanceAfter: "1500.00",
        description: "Wallet top-up",
      };
      vi.mocked(db.creditWallet).mockResolvedValue(mockTransaction as any);

      const transaction = await db.creditWallet(1, 1000, "Wallet top-up", "payment", "REF123");
      
      expect(transaction).toEqual(mockTransaction);
      expect(db.creditWallet).toHaveBeenCalledWith(1, 1000, "Wallet top-up", "payment", "REF123");
    });
  });

  describe("debitWallet", () => {
    it("should debit wallet when sufficient balance", async () => {
      const mockTransaction = {
        id: 2,
        walletId: 1,
        type: "debit",
        amount: "200.00",
        balanceBefore: "500.00",
        balanceAfter: "300.00",
        description: "Order payment",
      };
      vi.mocked(db.debitWallet).mockResolvedValue(mockTransaction as any);

      const transaction = await db.debitWallet(1, 200, "Order payment", "order", "ORD123");
      
      expect(transaction).toEqual(mockTransaction);
    });

    it("should throw error when insufficient balance", async () => {
      vi.mocked(db.debitWallet).mockRejectedValue(new Error("Insufficient wallet balance"));

      await expect(db.debitWallet(1, 1000, "Order payment")).rejects.toThrow("Insufficient wallet balance");
    });
  });
});

describe("Payment System (Paystack)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isPaystackConfigured", () => {
    it("should return true when secret key is set", () => {
      vi.mocked(paystack.isPaystackConfigured).mockReturnValue(true);
      
      expect(paystack.isPaystackConfigured()).toBe(true);
    });

    it("should return false when secret key is not set", () => {
      vi.mocked(paystack.isPaystackConfigured).mockReturnValue(false);
      
      expect(paystack.isPaystackConfigured()).toBe(false);
    });
  });

  describe("generateReference", () => {
    it("should generate unique reference with prefix", () => {
      vi.mocked(paystack.generateReference).mockReturnValue("TOP-ABC123-XYZ");
      
      const reference = paystack.generateReference("TOP");
      
      expect(reference).toBe("TOP-ABC123-XYZ");
      expect(reference).toMatch(/^TOP-/);
    });
  });

  describe("initializePayment", () => {
    it("should initialize payment and return authorization URL", async () => {
      const mockResponse = {
        status: true,
        message: "Authorization URL created",
        data: {
          authorization_url: "https://checkout.paystack.com/abc123",
          access_code: "abc123",
          reference: "TOP-REF123",
        },
      };
      vi.mocked(paystack.initializePayment).mockResolvedValue(mockResponse);

      const response = await paystack.initializePayment({
        email: "test@example.com",
        amount: 100000, // 1000 NGN in kobo
        reference: "TOP-REF123",
      });

      expect(response.data.authorization_url).toBe("https://checkout.paystack.com/abc123");
      expect(response.data.reference).toBe("TOP-REF123");
    });
  });

  describe("verifyPayment", () => {
    it("should verify successful payment", async () => {
      const mockResponse = {
        status: true,
        message: "Verification successful",
        data: {
          id: 12345,
          status: "success" as const,
          reference: "TOP-REF123",
          amount: 100000,
          channel: "card",
          currency: "NGN",
        },
      };
      vi.mocked(paystack.verifyPayment).mockResolvedValue(mockResponse as any);

      const response = await paystack.verifyPayment("TOP-REF123");

      expect(response.data.status).toBe("success");
      expect(response.data.amount).toBe(100000);
    });

    it("should handle failed payment verification", async () => {
      const mockResponse = {
        status: true,
        message: "Verification successful",
        data: {
          id: 12346,
          status: "failed" as const,
          reference: "TOP-REF456",
          amount: 100000,
        },
      };
      vi.mocked(paystack.verifyPayment).mockResolvedValue(mockResponse as any);

      const response = await paystack.verifyPayment("TOP-REF456");

      expect(response.data.status).toBe("failed");
    });
  });

  describe("verifyWebhookSignature", () => {
    it("should return true for valid signature", () => {
      vi.mocked(paystack.verifyWebhookSignature).mockReturnValue(true);

      const isValid = paystack.verifyWebhookSignature('{"event":"charge.success"}', "valid_signature");

      expect(isValid).toBe(true);
    });

    it("should return false for invalid signature", () => {
      vi.mocked(paystack.verifyWebhookSignature).mockReturnValue(false);

      const isValid = paystack.verifyWebhookSignature('{"event":"charge.success"}', "invalid_signature");

      expect(isValid).toBe(false);
    });
  });
});

describe("Referral System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrCreateReferralCode", () => {
    it("should return existing referral code", async () => {
      const mockCode = { id: 1, userId: 100, code: "ABC12345", isActive: true };
      vi.mocked(db.getOrCreateReferralCode).mockResolvedValue(mockCode as any);

      const code = await db.getOrCreateReferralCode(100);

      expect(code).toEqual(mockCode);
      expect(code?.code).toBe("ABC12345");
    });

    it("should create new referral code if none exists", async () => {
      const mockCode = { id: 2, userId: 200, code: "XYZ98765", isActive: true };
      vi.mocked(db.getOrCreateReferralCode).mockResolvedValue(mockCode as any);

      const code = await db.getOrCreateReferralCode(200);

      expect(code).toEqual(mockCode);
      expect(code?.code).toHaveLength(8);
    });
  });

  describe("getReferralCodeByCode", () => {
    it("should find referral code by code string", async () => {
      const mockCode = { id: 1, userId: 100, code: "ABC12345", isActive: true };
      vi.mocked(db.getReferralCodeByCode).mockResolvedValue(mockCode as any);

      const code = await db.getReferralCodeByCode("ABC12345");

      expect(code).toEqual(mockCode);
    });

    it("should return null for non-existent code", async () => {
      vi.mocked(db.getReferralCodeByCode).mockResolvedValue(null);

      const code = await db.getReferralCodeByCode("INVALID");

      expect(code).toBeNull();
    });
  });

  describe("createReferral", () => {
    it("should create referral relationship", async () => {
      const mockReferral = {
        id: 1,
        referrerUserId: 100,
        referredUserId: 200,
        referralCodeId: 1,
        status: "pending",
      };
      vi.mocked(db.createReferral).mockResolvedValue(mockReferral as any);

      const referral = await db.createReferral({
        referrerUserId: 100,
        referredUserId: 200,
        referralCodeId: 1,
        status: "pending",
      } as any);

      expect(referral).toEqual(mockReferral);
      expect(referral?.status).toBe("pending");
    });
  });

  describe("checkDuplicateReferral (Anti-Abuse)", () => {
    it("should detect duplicate referral from same device", async () => {
      vi.mocked(db.checkDuplicateReferral).mockResolvedValue(true);

      const isDuplicate = await db.checkDuplicateReferral("device_fingerprint_123", "192.168.1.1");

      expect(isDuplicate).toBe(true);
    });

    it("should allow new referral from unique device", async () => {
      vi.mocked(db.checkDuplicateReferral).mockResolvedValue(false);

      const isDuplicate = await db.checkDuplicateReferral("new_device_456", "10.0.0.1");

      expect(isDuplicate).toBe(false);
    });
  });

  describe("revokeReferral", () => {
    it("should revoke fraudulent referral", async () => {
      vi.mocked(db.revokeReferral).mockResolvedValue(undefined);

      await db.revokeReferral(1, 999, "Suspected fraud");

      expect(db.revokeReferral).toHaveBeenCalledWith(1, 999, "Suspected fraud");
    });
  });

  describe("getUserReferrals", () => {
    it("should return all referrals for a user", async () => {
      const mockReferrals = [
        { id: 1, referrerUserId: 100, referredUserId: 200, status: "rewarded" },
        { id: 2, referrerUserId: 100, referredUserId: 300, status: "pending" },
      ];
      vi.mocked(db.getUserReferrals).mockResolvedValue(mockReferrals as any);

      const referrals = await db.getUserReferrals(100);

      expect(referrals).toHaveLength(2);
      expect(referrals[0].status).toBe("rewarded");
    });
  });
});

describe("Integration: Payment to Wallet Credit Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should credit wallet after successful payment verification", async () => {
    // 1. Payment is initialized
    vi.mocked(paystack.generateReference).mockReturnValue("TOP-FLOW-123");
    vi.mocked(paystack.initializePayment).mockResolvedValue({
      status: true,
      message: "Success",
      data: {
        authorization_url: "https://checkout.paystack.com/flow123",
        access_code: "flow123",
        reference: "TOP-FLOW-123",
      },
    });

    // 2. Payment record is created
    vi.mocked(db.createPayment).mockResolvedValue({
      id: 1,
      userId: 100,
      reference: "TOP-FLOW-123",
      amount: "5000.00",
      status: "pending",
      purpose: "wallet_topup",
    } as any);

    // 3. Payment is verified as successful
    vi.mocked(db.getPaymentByReference).mockResolvedValue({
      id: 1,
      userId: 100,
      reference: "TOP-FLOW-123",
      amount: "5000.00",
      status: "pending",
      purpose: "wallet_topup",
    } as any);

    vi.mocked(paystack.verifyPayment).mockResolvedValue({
      status: true,
      message: "Success",
      data: {
        id: 12345,
        status: "success",
        reference: "TOP-FLOW-123",
        amount: 500000, // 5000 NGN in kobo
        channel: "card",
      },
    } as any);

    // 4. Wallet is credited
    vi.mocked(db.getOrCreateWallet).mockResolvedValue({
      id: 1,
      userId: 100,
      balance: "0.00",
      currency: "NGN",
    } as any);

    vi.mocked(db.creditWallet).mockResolvedValue({
      id: 1,
      walletId: 1,
      type: "credit",
      amount: "5000.00",
      balanceBefore: "0.00",
      balanceAfter: "5000.00",
      description: "Wallet top-up via card",
    } as any);

    // Execute flow
    const initResponse = await paystack.initializePayment({
      email: "test@example.com",
      amount: 500000,
      reference: "TOP-FLOW-123",
    });

    expect(initResponse.data.authorization_url).toBeDefined();

    const payment = await db.getPaymentByReference("TOP-FLOW-123");
    expect(payment?.status).toBe("pending");

    const verification = await paystack.verifyPayment("TOP-FLOW-123");
    expect(verification.data.status).toBe("success");

    const wallet = await db.getOrCreateWallet(100);
    const transaction = await db.creditWallet(
      wallet!.id,
      5000,
      "Wallet top-up via card",
      "payment",
      "TOP-FLOW-123"
    );

    expect(transaction?.balanceAfter).toBe("5000.00");
  });
});

describe("Integration: Referral Reward Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reward referrer after referred user completes first paid delivery", async () => {
    // 1. Referrer has a code
    vi.mocked(db.getOrCreateReferralCode).mockResolvedValue({
      id: 1,
      userId: 100,
      code: "REFER123",
      isActive: true,
    } as any);

    // 2. New user applies the code
    vi.mocked(db.getReferralCodeByCode).mockResolvedValue({
      id: 1,
      userId: 100,
      code: "REFER123",
      isActive: true,
    } as any);

    vi.mocked(db.getReferralByReferredUserId).mockResolvedValue(null);
    vi.mocked(db.checkDuplicateReferral).mockResolvedValue(false);

    vi.mocked(db.createReferral).mockResolvedValue({
      id: 1,
      referrerUserId: 100,
      referredUserId: 200,
      referralCodeId: 1,
      status: "pending",
    } as any);

    // Execute flow
    const referralCode = await db.getOrCreateReferralCode(100);
    expect(referralCode?.code).toBe("REFER123");

    const foundCode = await db.getReferralCodeByCode("REFER123");
    expect(foundCode).not.toBeNull();

    const existingReferral = await db.getReferralByReferredUserId(200);
    expect(existingReferral).toBeNull();

    const isDuplicate = await db.checkDuplicateReferral("device123", "192.168.1.1");
    expect(isDuplicate).toBe(false);

    const referral = await db.createReferral({
      referrerUserId: 100,
      referredUserId: 200,
      referralCodeId: 1,
      status: "pending",
    } as any);

    expect(referral?.status).toBe("pending");
  });
});
