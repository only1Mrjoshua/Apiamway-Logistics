/**
 * Weekly Payout Cancellation Guard Tests
 *
 * Verifies that earnings linked to cancelled orders are never included
 * in a payout batch, while valid delivered-order earnings are processed normally.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { processWeeklyPayouts } from "./weeklyPayout";

// ─── Mock database module ────────────────────────────────────────────────────

vi.mock("./db", () => ({
  getDb: vi.fn(),
  getOrderById: vi.fn(),
  getPartnerCompanyById: vi.fn(),
  creditPartnerBalance: vi.fn(),
}));

import * as db from "./db";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMockDb(pendingEarnings: any[]) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(pendingEarnings),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
}

function makeEarning(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    orderId: 42,
    partnerCompanyId: 3,
    partnerAmount: "3500",
    status: "pending",
    creditedAt: null,
    ...overrides,
  };
}

function makeOrder(overrides?: Record<string, unknown>) {
  return {
    id: 42,
    trackingNumber: "AP-EN-0042",
    status: "delivered",
    paymentStatus: "paid",
    settlementStatus: "settled",
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    archivedAt: null,
    ...overrides,
  };
}

function makePartner(id = 3) {
  return {
    id,
    name: "Test Fleet Co.",
    commissionType: "percentage",
    commissionValue: "70",
    status: "active",
    balance: "0",
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Weekly payout cancellation guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.creditPartnerBalance).mockResolvedValue(undefined as any);
  });

  // ── Earning linked to cancelled order (status) is skipped ─────────────────

  it("skips earning when linked order status is 'cancelled'", async () => {
    const earning = makeEarning({ id: 1, orderId: 42 });
    const mockDb = makeMockDb([earning]);
    vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
    vi.mocked(db.getPartnerCompanyById).mockResolvedValue(makePartner() as any);
    vi.mocked(db.getOrderById).mockResolvedValue(
      makeOrder({ status: "cancelled" }) as any
    );

    const result = await processWeeklyPayouts();

    expect(result.success).toBe(true);
    // No Fleet Owner should be in the summary (all earnings skipped)
    expect(result.payoutsSummary).toHaveLength(0);
    expect(result.totalAmount).toBe(0);
    expect(result.totalOrders).toBe(0);
    // Wallet must NOT be credited
    expect(db.creditPartnerBalance).not.toHaveBeenCalled();
  });

  // ── Earning linked to order with cancelledAt is skipped ───────────────────

  it("skips earning when linked order has cancelledAt set (race-condition guard)", async () => {
    const earning = makeEarning({ id: 2, orderId: 43 });
    const mockDb = makeMockDb([earning]);
    vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
    vi.mocked(db.getPartnerCompanyById).mockResolvedValue(makePartner() as any);
    vi.mocked(db.getOrderById).mockResolvedValue(
      makeOrder({ orderId: 43, cancelledAt: new Date() }) as any
    );

    const result = await processWeeklyPayouts();

    expect(result.success).toBe(true);
    expect(result.payoutsSummary).toHaveLength(0);
    expect(db.creditPartnerBalance).not.toHaveBeenCalled();
  });

  // ── Valid delivered order is included normally ─────────────────────────────

  it("includes earning for a valid delivered order in the payout batch", async () => {
    const earning = makeEarning({ id: 3, orderId: 44, partnerAmount: "7000" });
    const mockDb = makeMockDb([earning]);
    vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
    vi.mocked(db.getPartnerCompanyById).mockResolvedValue(makePartner() as any);
    vi.mocked(db.getOrderById).mockResolvedValue(
      makeOrder({ id: 44, status: "delivered", cancelledAt: null }) as any
    );

    const result = await processWeeklyPayouts();

    expect(result.success).toBe(true);
    expect(result.payoutsSummary).toHaveLength(1);
    expect(result.payoutsSummary[0].totalEarnings).toBe(7000);
    expect(result.payoutsSummary[0].orderCount).toBe(1);
    expect(db.creditPartnerBalance).toHaveBeenCalledWith(3, 7000);
  });

  // ── Mixed batch: only valid earnings are paid ──────────────────────────────

  it("processes only valid earnings in a mixed batch (some cancelled, some delivered)", async () => {
    // Two earnings for the same Fleet Owner: one valid, one cancelled
    const validEarning = makeEarning({ id: 10, orderId: 100, partnerAmount: "5000" });
    const cancelledEarning = makeEarning({ id: 11, orderId: 101, partnerAmount: "3000" });

    const mockDb = makeMockDb([validEarning, cancelledEarning]);
    vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
    vi.mocked(db.getPartnerCompanyById).mockResolvedValue(makePartner() as any);

    // Return different orders based on orderId
    vi.mocked(db.getOrderById).mockImplementation(async (id: number) => {
      if (id === 100) return makeOrder({ id: 100, status: "delivered", cancelledAt: null }) as any;
      if (id === 101) return makeOrder({ id: 101, status: "cancelled", cancelledAt: new Date() }) as any;
      return null;
    });

    const result = await processWeeklyPayouts();

    expect(result.success).toBe(true);
    expect(result.payoutsSummary).toHaveLength(1);
    // Only the valid earning (₦5000) should be included
    expect(result.payoutsSummary[0].totalEarnings).toBe(5000);
    expect(result.payoutsSummary[0].orderCount).toBe(1);
    expect(result.totalAmount).toBe(5000);
    expect(result.totalOrders).toBe(1);
    // Wallet credited with valid amount only
    expect(db.creditPartnerBalance).toHaveBeenCalledWith(3, 5000);
    expect(db.creditPartnerBalance).not.toHaveBeenCalledWith(3, 8000); // full amount must NOT be used
  });

  // ── No pending earnings ────────────────────────────────────────────────────

  it("returns success with empty summary when there are no pending earnings", async () => {
    const mockDb = makeMockDb([]);
    vi.mocked(db.getDb).mockResolvedValue(mockDb as any);

    const result = await processWeeklyPayouts();

    expect(result.success).toBe(true);
    expect(result.payoutsSummary).toHaveLength(0);
    expect(result.totalAmount).toBe(0);
    expect(db.creditPartnerBalance).not.toHaveBeenCalled();
  });

  // ── Fleet Owner with all cancelled earnings is skipped entirely ───────────

  it("skips Fleet Owner entirely when all their earnings are linked to cancelled orders", async () => {
    const e1 = makeEarning({ id: 20, orderId: 200, partnerAmount: "2000" });
    const e2 = makeEarning({ id: 21, orderId: 201, partnerAmount: "3000" });

    const mockDb = makeMockDb([e1, e2]);
    vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
    vi.mocked(db.getPartnerCompanyById).mockResolvedValue(makePartner() as any);
    vi.mocked(db.getOrderById).mockResolvedValue(
      makeOrder({ status: "cancelled" }) as any
    );

    const result = await processWeeklyPayouts();

    expect(result.success).toBe(true);
    expect(result.payoutsSummary).toHaveLength(0);
    expect(result.totalAmount).toBe(0);
    expect(db.creditPartnerBalance).not.toHaveBeenCalled();
  });
});
