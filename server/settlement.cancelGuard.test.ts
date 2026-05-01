/**
 * Settlement Cancellation Guard Tests
 *
 * Verifies that cancelled orders never trigger settlement or payout,
 * and that normal delivered orders still settle correctly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { processOrderSettlement } from "./settlement";

// ─── Mock database module ────────────────────────────────────────────────────

vi.mock("./db", () => ({
  getDb: vi.fn(),
  getOrderById: vi.fn(),
  getRiderById: vi.fn(),
  getPartnerCompanyById: vi.fn(),
  getPartnerEarningByOrderId: vi.fn(),
  createPartnerEarning: vi.fn(),
}));

import * as db from "./db";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMockDb() {
  return {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
}

function makeDeliveredOrder(overrides?: Record<string, unknown>) {
  return {
    id: 42,
    trackingNumber: "AP-EN-0042",
    status: "delivered",
    paymentStatus: "paid",
    settlementStatus: "pending",
    price: "5000",
    riderId: 7,
    deviceId: 3,
    partnerCompanyId: null,
    archivedAt: null,
    archivedBy: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRider(overrides?: Record<string, unknown>) {
  return {
    id: 7,
    name: "Test Rider",
    phone: "08099999999",
    status: "active",
    partnerCompanyId: 3,
    fleetType: "partner",
    ...overrides,
  };
}

function makePartner() {
  return {
    id: 3,
    name: "Test Fleet Co.",
    commissionType: "percentage" as const,
    commissionValue: "70",
    status: "active",
    balance: "0",
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Settlement cancellation guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Guard 1: status === 'cancelled' ────────────────────────────────────────

  it("blocks settlement when order status is 'cancelled'", async () => {
    vi.mocked(db.getDb).mockResolvedValue(makeMockDb() as any);
    vi.mocked(db.getOrderById).mockResolvedValue(
      makeDeliveredOrder({ status: "cancelled" }) as any
    );

    const result = await processOrderSettlement(42);

    expect(result.success).toBe(false);
    expect(result.message).toContain("cancelled");
    // No DB writes should happen
    expect(db.createPartnerEarning).not.toHaveBeenCalled();
  });

  // ── Guard 2: cancelledAt is set ────────────────────────────────────────────

  it("blocks settlement when cancelledAt is set (even if status is not 'cancelled')", async () => {
    vi.mocked(db.getDb).mockResolvedValue(makeMockDb() as any);
    // Simulate a race condition: status still shows delivered but cancelledAt was just written
    vi.mocked(db.getOrderById).mockResolvedValue(
      makeDeliveredOrder({ cancelledAt: new Date() }) as any
    );

    const result = await processOrderSettlement(42);

    expect(result.success).toBe(false);
    expect(result.message).toContain("cancellation timestamp");
    expect(db.createPartnerEarning).not.toHaveBeenCalled();
  });

  // ── Delivered → then cancelled: no further settlement ─────────────────────

  it("does not run settlement again after order is cancelled post-delivery", async () => {
    vi.mocked(db.getDb).mockResolvedValue(makeMockDb() as any);
    // Order was delivered and settled, then admin cancelled it
    vi.mocked(db.getOrderById).mockResolvedValue(
      makeDeliveredOrder({
        status: "cancelled",
        cancelledAt: new Date(),
        settlementStatus: "settled",
      }) as any
    );

    const result = await processOrderSettlement(42);

    expect(result.success).toBe(false);
    // Guard 1 fires first (status check)
    expect(result.message).toContain("cancelled");
    expect(db.createPartnerEarning).not.toHaveBeenCalled();
  });

  // ── Normal delivered order: settlement still works ─────────────────────────

  it("runs settlement normally for a delivered, paid, non-cancelled order", async () => {
    const mockDb = makeMockDb();
    vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
    vi.mocked(db.getOrderById).mockResolvedValue(makeDeliveredOrder() as any);
    vi.mocked(db.getRiderById).mockResolvedValue(makeRider() as any);
    vi.mocked(db.getPartnerCompanyById).mockResolvedValue(makePartner() as any);
    vi.mocked(db.getPartnerEarningByOrderId).mockResolvedValue(null);
    vi.mocked(db.createPartnerEarning).mockResolvedValue(undefined as any);

    const result = await processOrderSettlement(42);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Settlement completed successfully");
    expect(db.createPartnerEarning).toHaveBeenCalledOnce();
    expect(result.settlement?.fleetOwnerPayout).toBe(3500); // 70% of 5000
    expect(result.settlement?.apiamwayCommission).toBe(1500); // 30% of 5000
  });

  // ── Already-settled order: idempotency ────────────────────────────────────

  it("returns early without re-crediting if settlement record already exists", async () => {
    const mockDb = makeMockDb();
    vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
    vi.mocked(db.getOrderById).mockResolvedValue(makeDeliveredOrder() as any);
    vi.mocked(db.getRiderById).mockResolvedValue(makeRider() as any);
    vi.mocked(db.getPartnerCompanyById).mockResolvedValue(makePartner() as any);
    vi.mocked(db.getPartnerEarningByOrderId).mockResolvedValue({
      id: 99,
      orderId: 42,
      partnerCompanyId: 3,
      partnerAmount: "3500",
    } as any);

    const result = await processOrderSettlement(42);

    expect(result.success).toBe(false);
    expect(result.message).toBe("Settlement record already exists");
    // createPartnerEarning must NOT be called again
    expect(db.createPartnerEarning).not.toHaveBeenCalled();
  });

  // ── Order not found ────────────────────────────────────────────────────────

  it("returns failure when order does not exist", async () => {
    vi.mocked(db.getDb).mockResolvedValue(makeMockDb() as any);
    vi.mocked(db.getOrderById).mockResolvedValue(null);

    const result = await processOrderSettlement(999);

    expect(result.success).toBe(false);
    expect(result.message).toBe("Order not found");
    expect(db.createPartnerEarning).not.toHaveBeenCalled();
  });

  // ── Pending order: not settled ─────────────────────────────────────────────

  it("does not settle a pending order", async () => {
    vi.mocked(db.getDb).mockResolvedValue(makeMockDb() as any);
    vi.mocked(db.getOrderById).mockResolvedValue(
      makeDeliveredOrder({ status: "pending" }) as any
    );

    const result = await processOrderSettlement(42);

    expect(result.success).toBe(false);
    expect(result.message).toContain("not delivered");
    expect(db.createPartnerEarning).not.toHaveBeenCalled();
  });
});
