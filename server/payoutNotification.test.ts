/**
 * Payout Batch Report Notification Tests
 *
 * Verifies that processWeeklyPayouts calls notifyOwner after every run
 * with a summary that includes totalPaid, processed, blocked, and voided counts.
 * Also confirms that the notification does NOT break normal payout flow.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { processWeeklyPayouts } from "./weeklyPayout";

// ─── Mock: db module ─────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn(),
  getOrderById: vi.fn(),
  getPartnerCompanyById: vi.fn(),
  creditPartnerBalance: vi.fn(),
}));

// ─── Mock: notifyOwner ───────────────────────────────────────────────────────
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

import * as db from "./db";
import { notifyOwner } from "./_core/notification";

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

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("Payout batch report notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.creditPartnerBalance).mockResolvedValue(undefined as any);
  });

  // ── notifyOwner is called even when there are no pending earnings ──────────
  it("calls notifyOwner when there are no pending earnings", async () => {
    vi.mocked(db.getDb).mockResolvedValue(makeMockDb([]) as any);

    const result = await processWeeklyPayouts();

    expect(result.success).toBe(true);
    expect(result.totalAmount).toBe(0);
    expect(notifyOwner).toHaveBeenCalledOnce();

    const call = vi.mocked(notifyOwner).mock.calls[0][0];
    expect(call.title).toContain("Weekly Payout Complete");
    expect(call.content).toContain("Total Paid Out: ₦0.00");
    expect(call.content).toContain("Earnings Processed: 0");
    expect(call.content).toContain("Earnings Blocked (cancelled orders): 0");
  });

  // ── notifyOwner is called after a normal payout run ───────────────────────
  it("calls notifyOwner after a successful payout run with valid earnings", async () => {
    const earning = makeEarning({ id: 10, orderId: 42, partnerCompanyId: 3, partnerAmount: "4500" });
    const mockDb = makeMockDb([earning]);
    // chain for update().set().where() — needs to return something awaitable
    mockDb.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
    vi.mocked(db.getOrderById).mockResolvedValue(makeOrder({ id: 42 }) as any);
    vi.mocked(db.getPartnerCompanyById).mockResolvedValue(makePartner(3) as any);

    const result = await processWeeklyPayouts();

    expect(result.success).toBe(true);
    expect(result.totalAmount).toBe(4500);
    expect(result.totalOrders).toBe(1);
    expect(result.totalBlocked).toBe(0);
    expect(notifyOwner).toHaveBeenCalledOnce();

    const call = vi.mocked(notifyOwner).mock.calls[0][0];
    expect(call.title).toContain("Weekly Payout Complete");
    expect(call.content).toContain("Total Paid Out: ₦4500.00");
    expect(call.content).toContain("Earnings Processed: 1");
    expect(call.content).toContain("Earnings Blocked (cancelled orders): 0");
    expect(call.content).toContain("Test Fleet Co.");
  });

  // ── Summary includes correct blocked count ────────────────────────────────
  it("includes blocked cancelled-order count in notification", async () => {
    const validEarning = makeEarning({ id: 1, orderId: 10, partnerCompanyId: 3, partnerAmount: "2000" });
    const blockedEarning = makeEarning({ id: 2, orderId: 11, partnerCompanyId: 3, partnerAmount: "1500" });
    const mockDb = makeMockDb([validEarning, blockedEarning]);
    mockDb.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
    vi.mocked(db.getPartnerCompanyById).mockResolvedValue(makePartner(3) as any);
    vi.mocked(db.getOrderById).mockImplementation(async (id: number) => {
      if (id === 10) return makeOrder({ id: 10, status: "delivered", cancelledAt: null }) as any;
      if (id === 11) return makeOrder({ id: 11, status: "cancelled", cancelledAt: new Date() }) as any;
      return null;
    });

    const result = await processWeeklyPayouts();

    expect(result.success).toBe(true);
    expect(result.totalBlocked).toBe(1);
    expect(result.totalOrders).toBe(1);
    expect(notifyOwner).toHaveBeenCalledOnce();

    const call = vi.mocked(notifyOwner).mock.calls[0][0];
    expect(call.content).toContain("Earnings Blocked (cancelled orders): 1");
    expect(call.content).toContain("Earnings Processed: 1");
  });

  // ── Notification failure does NOT break payout result ─────────────────────
  it("does not break payout flow if notifyOwner throws", async () => {
    vi.mocked(notifyOwner).mockRejectedValueOnce(new Error("Notification service down"));

    const earning = makeEarning({ id: 20, orderId: 50, partnerCompanyId: 5, partnerAmount: "3000" });
    const mockDb = makeMockDb([earning]);
    mockDb.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
    vi.mocked(db.getOrderById).mockResolvedValue(makeOrder({ id: 50 }) as any);
    vi.mocked(db.getPartnerCompanyById).mockResolvedValue(makePartner(5) as any);

    const result = await processWeeklyPayouts();

    // Payout must still succeed even though notifyOwner threw
    expect(result.success).toBe(true);
    expect(result.totalAmount).toBe(3000);
    expect(result.errors).toHaveLength(0);
  });

  // ── Notification failure on empty-earnings path also non-fatal ────────────
  it("does not break empty-earnings path if notifyOwner throws", async () => {
    vi.mocked(notifyOwner).mockRejectedValueOnce(new Error("Network error"));
    vi.mocked(db.getDb).mockResolvedValue(makeMockDb([]) as any);

    const result = await processWeeklyPayouts();

    expect(result.success).toBe(true);
    expect(result.totalAmount).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  // ── Summary log line is emitted ───────────────────────────────────────────
  it("emits [Payout Summary] log line with correct values", async () => {
    const consoleSpy = vi.spyOn(console, "log");
    const earning = makeEarning({ id: 30, orderId: 60, partnerCompanyId: 7, partnerAmount: "5000" });
    const mockDb = makeMockDb([earning]);
    mockDb.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
    vi.mocked(db.getOrderById).mockResolvedValue(makeOrder({ id: 60 }) as any);
    vi.mocked(db.getPartnerCompanyById).mockResolvedValue(makePartner(7) as any);

    await processWeeklyPayouts();

    const summaryLog = consoleSpy.mock.calls.find((args) =>
      typeof args[0] === "string" && args[0].startsWith("[Payout Summary]")
    );
    expect(summaryLog).toBeDefined();
    const logLine = summaryLog![0] as string;
    expect(logLine).toContain("totalPaid=5000.00");
    expect(logLine).toContain("processed=1");
    expect(logLine).toContain("blocked=0");
    expect(logLine).toContain("voided=0");
  });

  // ── PayoutBatchResult now exposes totalBlocked and totalVoided ────────────
  it("result object includes totalBlocked and totalVoided fields", async () => {
    vi.mocked(db.getDb).mockResolvedValue(makeMockDb([]) as any);

    const result = await processWeeklyPayouts();

    expect(result).toHaveProperty("totalBlocked");
    expect(result).toHaveProperty("totalVoided");
    expect(typeof result.totalBlocked).toBe("number");
    expect(typeof result.totalVoided).toBe("number");
  });

  // ── Per-owner breakdown appears in notification content ───────────────────
  it("notification content includes per-owner breakdown", async () => {
    const earning = makeEarning({ id: 40, orderId: 70, partnerCompanyId: 9, partnerAmount: "7500" });
    const mockDb = makeMockDb([earning]);
    mockDb.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
    vi.mocked(db.getOrderById).mockResolvedValue(makeOrder({ id: 70 }) as any);
    vi.mocked(db.getPartnerCompanyById).mockResolvedValue(makePartner(9) as any);

    await processWeeklyPayouts();

    const call = vi.mocked(notifyOwner).mock.calls[0][0];
    expect(call.content).toContain("Per-Owner Breakdown:");
    expect(call.content).toContain("Test Fleet Co.");
    expect(call.content).toContain("₦7500.00");
    expect(call.content).toContain("1 order");
  });
});
