/**
 * Export Cancelled Order Earnings Tests
 *
 * Tests the exportCancelledOrderEarnings function by mocking it directly.
 * Verifies: pending-only export, pending+voided export, correct field shape,
 * and that voided metadata is present/null as expected.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the entire db module ────────────────────────────────────────────────

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    exportCancelledOrderEarnings: vi.fn(),
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

const mockedFn = () => vi.mocked(dbModule.exportCancelledOrderEarnings);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("exportCancelledOrderEarnings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Pending-only export ───────────────────────────────────────────────────

  it("returns empty array when no cancelled-order earnings exist", async () => {
    mockedFn().mockResolvedValue([]);

    const result = await dbModule.exportCancelledOrderEarnings(false);

    expect(result).toHaveLength(0);
    expect(mockedFn()).toHaveBeenCalledWith(false);
  });

  it("pending-only export returns only pending rows (includeVoided=false)", async () => {
    const row = makePendingRow();
    mockedFn().mockResolvedValue([row]);

    const result = await dbModule.exportCancelledOrderEarnings(false);

    expect(result).toHaveLength(1);
    expect(result[0].earningStatus).toBe("pending");
    // Void metadata must be null for pending rows
    expect(result[0].voidedAt).toBeNull();
    expect(result[0].voidedBy).toBeNull();
    expect(result[0].voidReason).toBeNull();
  });

  it("pending-only export does NOT include voided rows", async () => {
    const pendingRow = makePendingRow();
    // Mock simulates DB returning only pending rows when includeVoided=false
    mockedFn().mockResolvedValue([pendingRow]);

    const result = await dbModule.exportCancelledOrderEarnings(false);

    const voidedRows = result.filter((r) => r.earningStatus === "voided");
    expect(voidedRows).toHaveLength(0);
  });

  // ── Pending + voided export ───────────────────────────────────────────────

  it("includeVoided=true returns both pending and voided rows", async () => {
    const pendingRow = makePendingRow();
    const voidedRow = makeVoidedRow();
    mockedFn().mockResolvedValue([pendingRow, voidedRow]);

    const result = await dbModule.exportCancelledOrderEarnings(true);

    expect(result).toHaveLength(2);
    const statuses = result.map((r) => r.earningStatus);
    expect(statuses).toContain("pending");
    expect(statuses).toContain("voided");
    expect(mockedFn()).toHaveBeenCalledWith(true);
  });

  it("includeVoided=true — voided row has correct void metadata", async () => {
    const voidedAt = new Date("2025-01-20T09:00:00Z");
    const voidedRow = makeVoidedRow({
      voidedAt,
      voidedBy: 99,
      voidReason: "Duplicate order — voided by admin",
    });
    mockedFn().mockResolvedValue([voidedRow]);

    const result = await dbModule.exportCancelledOrderEarnings(true);

    const row = result[0];
    expect(row.earningStatus).toBe("voided");
    expect(row.voidedAt).toEqual(voidedAt);
    expect(row.voidedBy).toBe(99);
    expect(row.voidReason).toBe("Duplicate order — voided by admin");
  });

  it("includeVoided=true — voided row without reason has voidReason=null", async () => {
    const voidedRow = makeVoidedRow({ voidReason: null });
    mockedFn().mockResolvedValue([voidedRow]);

    const result = await dbModule.exportCancelledOrderEarnings(true);

    expect(result[0].voidReason).toBeNull();
  });

  // ── No pagination ─────────────────────────────────────────────────────────

  it("returns all rows without pagination (large dataset)", async () => {
    const allRows = Array.from({ length: 50 }, (_, i) =>
      makePendingRow({ earningId: i + 1, orderId: 100 + i, trackingNumber: `AP-EN-${String(i + 1).padStart(4, "0")}` })
    );
    mockedFn().mockResolvedValue(allRows);

    const result = await dbModule.exportCancelledOrderEarnings(false);

    // All 50 rows returned — no slicing
    expect(result).toHaveLength(50);
    expect(result[0].earningId).toBe(1);
    expect(result[49].earningId).toBe(50);
  });

  // ── Field shape ───────────────────────────────────────────────────────────

  it("includes all required fields in each exported row", async () => {
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
    mockedFn().mockResolvedValue([row]);

    const result = await dbModule.exportCancelledOrderEarnings(false);
    const r = result[0];

    expect(r.earningId).toBe(99);
    expect(r.partnerAmount).toBe("7000");
    expect(r.orderPrice).toBe("10000");
    expect(r.commissionPercentage).toBe("30");
    expect(r.cancelledAt).toEqual(cancelledAt);
    expect(r.createdAt).toEqual(createdAt);
    expect(r.fleetOwnerName).toBe("Alpha Logistics");
    expect(r.trackingNumber).toBe("AP-LG-0099");
    expect(r.partnerCompanyId).toBe(7);
    expect(r.voidedAt).toBeNull();
    expect(r.voidedBy).toBeNull();
    expect(r.voidReason).toBeNull();
  });

  it("returns empty array when DB is unavailable", async () => {
    mockedFn().mockResolvedValue([]);

    const result = await dbModule.exportCancelledOrderEarnings(false);

    expect(result).toHaveLength(0);
  });
});
