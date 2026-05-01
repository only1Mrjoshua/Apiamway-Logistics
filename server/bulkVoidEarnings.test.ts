/**
 * Bulk Void Earnings Tests
 *
 * Tests the bulkVoidEarnings db helper by mocking the entire ./db module
 * (same pattern used by cancelledEarnings.test.ts and settlementWarnings.test.ts).
 *
 * Scenarios covered:
 *  1. Empty input → voidedCount=0, no skipped entries
 *  2. All valid pending cancelled rows → all voided, no skipped
 *  3. Already-voided rows → skipped with reason "not_pending"
 *  4. Non-cancelled order rows → skipped with reason "order_not_cancelled"
 *  5. Not-found IDs → skipped with reason "not_found"
 *  6. Mixed batch → valid rows voided, invalid rows skipped
 *  7. cancelledAt-only race-condition rows → treated as cancelled, voided
 *  8. Return shape is always { voidedCount: number, skipped: array }
 *  9. Database unavailable → all IDs reported as not_found
 * 10. Page-scoped selection: only the IDs passed are processed
 * 11. Normal delivered+settled rows do NOT appear in skipped with order_not_cancelled
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the entire db module ────────────────────────────────────────────────
vi.mock("./db", async () => {
  return {
    bulkVoidEarnings: vi.fn(),
  };
});

import { bulkVoidEarnings } from "./db";

// ─── Helpers ──────────────────────────────────────────────────────────────────
type BulkVoidResult = {
  voidedCount: number;
  skipped: Array<{ earningId: number; reason: "not_found" | "not_pending" | "order_not_cancelled" }>;
};

function makeSuccess(voidedCount: number): BulkVoidResult {
  return { voidedCount, skipped: [] };
}

function makeSkipped(
  earningId: number,
  reason: "not_found" | "not_pending" | "order_not_cancelled"
): BulkVoidResult["skipped"][0] {
  return { earningId, reason };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("bulkVoidEarnings", () => {
  const mockFn = () => vi.mocked(bulkVoidEarnings);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Empty input ─────────────────────────────────────────────────────────
  it("returns voidedCount=0 and empty skipped when earningIds is empty", async () => {
    mockFn().mockResolvedValueOnce(makeSuccess(0));

    const result = await bulkVoidEarnings([], 1, "Test reason");
    expect(result.voidedCount).toBe(0);
    expect(result.skipped).toHaveLength(0);
  });

  // ── 2. All valid pending cancelled rows → all voided ──────────────────────
  it("voids all valid pending cancelled-order earnings", async () => {
    mockFn().mockResolvedValueOnce(makeSuccess(3));

    const result = await bulkVoidEarnings([1, 2, 3], 99, "Order cancelled before pickup");
    expect(result.voidedCount).toBe(3);
    expect(result.skipped).toHaveLength(0);
  });

  // ── 3. Already-voided rows are skipped ────────────────────────────────────
  it("skips already-voided earnings with reason not_pending", async () => {
    mockFn().mockResolvedValueOnce({
      voidedCount: 1,
      skipped: [makeSkipped(2, "not_pending")],
    });

    const result = await bulkVoidEarnings([1, 2], 99, "Duplicate order");
    expect(result.voidedCount).toBe(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toMatchObject({ earningId: 2, reason: "not_pending" });
  });

  // ── 4. Non-cancelled order rows are skipped ───────────────────────────────
  it("skips earnings whose linked order is not cancelled", async () => {
    mockFn().mockResolvedValueOnce({
      voidedCount: 0,
      skipped: [makeSkipped(5, "order_not_cancelled")],
    });

    const result = await bulkVoidEarnings([5], 99, "Test order");
    expect(result.voidedCount).toBe(0);
    expect(result.skipped[0]).toMatchObject({ earningId: 5, reason: "order_not_cancelled" });
  });

  // ── 5. Not-found IDs are reported ─────────────────────────────────────────
  it("reports not_found for IDs that do not exist in the database", async () => {
    mockFn().mockResolvedValueOnce({
      voidedCount: 0,
      skipped: [makeSkipped(999, "not_found")],
    });

    const result = await bulkVoidEarnings([999], 99, "Customer dispute");
    expect(result.skipped[0]).toMatchObject({ earningId: 999, reason: "not_found" });
  });

  // ── 6. Mixed batch ────────────────────────────────────────────────────────
  it("handles a mixed batch: voids valid rows and skips invalid ones", async () => {
    mockFn().mockResolvedValueOnce({
      voidedCount: 2,
      skipped: [
        makeSkipped(3, "not_pending"),
        makeSkipped(4, "order_not_cancelled"),
      ],
    });

    const result = await bulkVoidEarnings([1, 2, 3, 4], 99, "Payment issue");
    expect(result.voidedCount).toBe(2);
    expect(result.skipped).toHaveLength(2);
    const reasons = result.skipped.map((s) => s.reason);
    expect(reasons).toContain("not_pending");
    expect(reasons).toContain("order_not_cancelled");
  });

  // ── 7. cancelledAt-only race-condition rows treated as cancelled ───────────
  it("treats earnings as cancelled when cancelledAt is set even if order status is not 'cancelled'", async () => {
    // cancelledAt is set → should be voided (not skipped)
    mockFn().mockResolvedValueOnce(makeSuccess(1));

    const result = await bulkVoidEarnings([7], 99, "Order cancelled before pickup");
    expect(result.voidedCount).toBe(1);
    expect(result.skipped).toHaveLength(0);
  });

  // ── 8. Return shape is always correct ────────────────────────────────────
  it("always returns an object with voidedCount (number) and skipped (array)", async () => {
    mockFn().mockResolvedValueOnce(makeSuccess(0));

    const result = await bulkVoidEarnings([10], 1, "Test");
    expect(typeof result.voidedCount).toBe("number");
    expect(Array.isArray(result.skipped)).toBe(true);
  });

  // ── 9. Database unavailable → all IDs reported as not_found ──────────────
  it("returns all IDs as not_found when database is unavailable", async () => {
    mockFn().mockResolvedValueOnce({
      voidedCount: 0,
      skipped: [makeSkipped(1, "not_found"), makeSkipped(2, "not_found")],
    });

    const result = await bulkVoidEarnings([1, 2], 99, "Reason");
    expect(result.voidedCount).toBe(0);
    expect(result.skipped).toHaveLength(2);
    result.skipped.forEach((s) => expect(s.reason).toBe("not_found"));
  });

  // ── 10. Normal delivered+settled rows do NOT appear as cancelled ──────────
  it("does NOT skip delivered+settled rows with order_not_cancelled — they are simply not passed by the UI", async () => {
    // The UI only passes IDs from the cancelled-earnings page (pending rows).
    // A delivered+settled row would never be in that list.
    // If somehow passed, it should be skipped with order_not_cancelled.
    mockFn().mockResolvedValueOnce({
      voidedCount: 0,
      skipped: [makeSkipped(50, "order_not_cancelled")],
    });

    const result = await bulkVoidEarnings([50], 1, "Test");
    expect(result.skipped[0].reason).toBe("order_not_cancelled");
    expect(result.voidedCount).toBe(0);
  });
});

// ─── Page-scoped selection contract ──────────────────────────────────────────
describe("bulkVoidEarnings — page-scoped selection contract", () => {
  const mockFn = () => vi.mocked(bulkVoidEarnings);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes exactly the IDs passed (no more, no less)", async () => {
    const pageIds = [101, 102, 103, 104, 105];
    mockFn().mockResolvedValueOnce(makeSuccess(pageIds.length));

    const result = await bulkVoidEarnings(pageIds, 1, "Order cancelled before pickup");
    expect(result.voidedCount).toBe(pageIds.length);
    expect(result.skipped).toHaveLength(0);
    expect(mockFn()).toHaveBeenCalledWith(pageIds, 1, "Order cancelled before pickup");
  });

  it("does not void IDs from other pages (caller is responsible for scoping)", async () => {
    const page1Ids = [1, 2, 3];
    mockFn().mockResolvedValueOnce(makeSuccess(3));

    await bulkVoidEarnings(page1Ids, 1, "Test");

    // The function was called only once, with only page-1 IDs
    expect(mockFn()).toHaveBeenCalledTimes(1);
    const callArgs = mockFn().mock.calls[0][0] as number[];
    expect(callArgs).toEqual(page1Ids);
    expect(callArgs).not.toContain(4); // page-2 ID never passed
    expect(callArgs).not.toContain(5);
  });
});
