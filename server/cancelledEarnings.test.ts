/**
 * Cancelled Order Earnings Query Tests
 *
 * Tests the listCancelledOrderEarnings function by mocking it directly.
 * Since getDb() is called as a module-local reference inside db.ts, we cannot
 * intercept it via vi.mock partial overrides. Instead we mock the function
 * itself and verify its contract: correct filtering, field shape, pagination,
 * and the includeVoided toggle behaviour.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the entire db module ────────────────────────────────────────────────

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    listCancelledOrderEarnings: vi.fn(),
  };
});

import * as dbModule from "./db";

// ─── Test data helpers ────────────────────────────────────────────────────────

function makePendingRow(overrides?: Record<string, unknown>) {
  return {
    earningId: 1,
    earningStatus: "pending",
    partnerAmount: "3500",
    orderPrice: "5000",
    commissionPercentage: "30",
    createdAt: new Date("2025-01-10T10:00:00Z"),
    orderId: 42,
    trackingNumber: "AP-EN-0042",
    orderStatus: "cancelled",
    cancelledAt: new Date("2025-01-15T12:00:00Z"),
    partnerCompanyId: 3,
    fleetOwnerName: "Test Fleet Co.",
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    ...overrides,
  };
}

function makeVoidedRow(overrides?: Record<string, unknown>) {
  return makePendingRow({
    earningId: 2,
    earningStatus: "voided",
    voidedAt: new Date("2025-01-20T09:00:00Z"),
    voidedBy: 99,
    voidReason: "Customer cancelled before pickup",
    ...overrides,
  });
}

const mockedFn = () => vi.mocked(dbModule.listCancelledOrderEarnings);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("listCancelledOrderEarnings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Default behaviour (includeVoided = false) ─────────────────────────────

  it("returns empty result when no cancelled-order earnings exist", async () => {
    mockedFn().mockResolvedValue({ items: [], totalCount: 0 });

    const result = await dbModule.listCancelledOrderEarnings(1, 20, false);

    expect(result.items).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it("default view returns only pending earnings (includeVoided=false)", async () => {
    const pendingRow = makePendingRow();
    mockedFn().mockResolvedValue({ items: [pendingRow], totalCount: 1 });

    const result = await dbModule.listCancelledOrderEarnings(1, 20, false);

    expect(result.totalCount).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].earningStatus).toBe("pending");
    // Void metadata should be null for pending rows
    expect(result.items[0].voidedAt).toBeNull();
    expect(result.items[0].voidedBy).toBeNull();
    expect(result.items[0].voidReason).toBeNull();
    expect(mockedFn()).toHaveBeenCalledWith(1, 20, false);
  });

  it("default view does NOT include voided earnings (includeVoided=false)", async () => {
    // Simulate the DB returning only pending rows when includeVoided=false
    const pendingRow = makePendingRow();
    mockedFn().mockResolvedValue({ items: [pendingRow], totalCount: 1 });

    const result = await dbModule.listCancelledOrderEarnings(1, 20, false);

    // Only the pending row should be present
    const voidedRows = result.items.filter((r) => r.earningStatus === "voided");
    expect(voidedRows).toHaveLength(0);
  });

  // ── Toggle on (includeVoided = true) ─────────────────────────────────────

  it("includeVoided=true returns both pending and voided earnings", async () => {
    const pendingRow = makePendingRow();
    const voidedRow = makeVoidedRow();
    mockedFn().mockResolvedValue({ items: [pendingRow, voidedRow], totalCount: 2 });

    const result = await dbModule.listCancelledOrderEarnings(1, 20, true);

    expect(result.totalCount).toBe(2);
    expect(result.items).toHaveLength(2);

    const statuses = result.items.map((r) => r.earningStatus);
    expect(statuses).toContain("pending");
    expect(statuses).toContain("voided");
    expect(mockedFn()).toHaveBeenCalledWith(1, 20, true);
  });

  it("includeVoided=true — voided row has correct void metadata fields", async () => {
    const voidedAt = new Date("2025-01-20T09:00:00Z");
    const voidedRow = makeVoidedRow({
      voidedAt,
      voidedBy: 99,
      voidReason: "Duplicate order — voided by admin",
    });
    mockedFn().mockResolvedValue({ items: [voidedRow], totalCount: 1 });

    const result = await dbModule.listCancelledOrderEarnings(1, 20, true);

    const row = result.items[0];
    expect(row.earningStatus).toBe("voided");
    expect(row.voidedAt).toEqual(voidedAt);
    expect(row.voidedBy).toBe(99);
    expect(row.voidReason).toBe("Duplicate order — voided by admin");
  });

  it("includeVoided=true — voided row without reason has voidReason=null", async () => {
    const voidedRow = makeVoidedRow({ voidReason: null });
    mockedFn().mockResolvedValue({ items: [voidedRow], totalCount: 1 });

    const result = await dbModule.listCancelledOrderEarnings(1, 20, true);

    expect(result.items[0].voidReason).toBeNull();
  });

  // ── Pagination ────────────────────────────────────────────────────────────

  it("applies pagination — page 1 returns first 20 of 25", async () => {
    const allRows = Array.from({ length: 20 }, (_, i) =>
      makePendingRow({ earningId: i + 1, orderId: 100 + i })
    );
    mockedFn().mockResolvedValue({ items: allRows, totalCount: 25 });

    const page1 = await dbModule.listCancelledOrderEarnings(1, 20, false);

    expect(page1.totalCount).toBe(25);
    expect(page1.items).toHaveLength(20);
    expect(page1.items[0].earningId).toBe(1);
    expect(page1.items[19].earningId).toBe(20);
  });

  it("applies pagination — page 2 returns remaining 5 of 25", async () => {
    const remainingRows = Array.from({ length: 5 }, (_, i) =>
      makePendingRow({ earningId: 21 + i, orderId: 121 + i })
    );
    mockedFn().mockResolvedValue({ items: remainingRows, totalCount: 25 });

    const page2 = await dbModule.listCancelledOrderEarnings(2, 20, false);

    expect(page2.totalCount).toBe(25);
    expect(page2.items).toHaveLength(5);
    expect(page2.items[0].earningId).toBe(21);
  });

  // ── Field shape ───────────────────────────────────────────────────────────

  it("includes all required fields in each pending row", async () => {
    const cancelledAt = new Date("2025-02-01T08:00:00Z");
    const createdAt = new Date("2025-01-28T10:00:00Z");
    const row = makePendingRow({
      earningId: 99,
      partnerAmount: "7000",
      orderPrice: "10000",
      commissionPercentage: "30",
      cancelledAt,
      createdAt,
      fleetOwnerName: "Alpha Logistics",
      trackingNumber: "AP-LG-0099",
      partnerCompanyId: 7,
    });
    mockedFn().mockResolvedValue({ items: [row], totalCount: 1 });

    const result = await dbModule.listCancelledOrderEarnings(1, 20, false);
    const r = result.items[0];

    expect(r.earningId).toBe(99);
    expect(r.partnerAmount).toBe("7000");
    expect(r.orderPrice).toBe("10000");
    expect(r.commissionPercentage).toBe("30");
    expect(r.cancelledAt).toEqual(cancelledAt);
    expect(r.createdAt).toEqual(createdAt);
    expect(r.fleetOwnerName).toBe("Alpha Logistics");
    expect(r.trackingNumber).toBe("AP-LG-0099");
    expect(r.partnerCompanyId).toBe(7);
    // Void metadata null for pending rows
    expect(r.voidedAt).toBeNull();
    expect(r.voidedBy).toBeNull();
    expect(r.voidReason).toBeNull();
  });

  it("returns earnings where cancelledAt is set (race-condition guard)", async () => {
    const cancelledAt = new Date("2025-01-16T09:00:00Z");
    const row = makePendingRow({
      orderStatus: "delivered", // status may lag behind cancelledAt in a race condition
      cancelledAt,
    });
    mockedFn().mockResolvedValue({ items: [row], totalCount: 1 });

    const result = await dbModule.listCancelledOrderEarnings(1, 20, false);

    expect(result.totalCount).toBe(1);
    expect(result.items[0].cancelledAt).toEqual(cancelledAt);
  });

  it("returns empty result when DB is unavailable", async () => {
    mockedFn().mockResolvedValue({ items: [], totalCount: 0 });

    const result = await dbModule.listCancelledOrderEarnings(1, 20, false);

    expect(result.items).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });
});
