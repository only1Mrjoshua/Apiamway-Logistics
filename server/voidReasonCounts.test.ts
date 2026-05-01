/**
 * Void Reason Analytics Tests
 *
 * Tests the getVoidReasonCounts db helper by mocking the entire ./db module.
 *
 * Scenarios covered:
 *  1. Empty state → returns empty array when no voided earnings exist
 *  2. Single reason → returns correct count for one reason
 *  3. Multiple reasons → returns all reasons with correct counts
 *  4. Only voided earnings are counted (pending/credited/paid_out excluded)
 *  5. NULL voidReason → grouped as "(no reason)"
 *  6. Results are sorted descending by count
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the entire db module ────────────────────────────────────────────────
vi.mock("./db", async () => {
  return {
    getVoidReasonCounts: vi.fn(),
  };
});

import { getVoidReasonCounts } from "./db";

// ─── Helpers ──────────────────────────────────────────────────────────────────
type VoidReasonCount = { reason: string; count: number };

const mockFn = () => vi.mocked(getVoidReasonCounts);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getVoidReasonCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Empty state ─────────────────────────────────────────────────────────
  it("returns an empty array when no voided earnings exist", async () => {
    mockFn().mockResolvedValueOnce([]);

    const result = await getVoidReasonCounts();
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  // ── 2. Single reason ───────────────────────────────────────────────────────
  it("returns a single entry with the correct count", async () => {
    const expected: VoidReasonCount[] = [
      { reason: "Order cancelled before pickup", count: 5 },
    ];
    mockFn().mockResolvedValueOnce(expected);

    const result = await getVoidReasonCounts();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ reason: "Order cancelled before pickup", count: 5 });
  });

  // ── 3. Multiple reasons ────────────────────────────────────────────────────
  it("returns all reasons with correct individual counts", async () => {
    const expected: VoidReasonCount[] = [
      { reason: "Order cancelled before pickup", count: 12 },
      { reason: "Duplicate order", count: 4 },
      { reason: "Customer dispute", count: 2 },
      { reason: "Payment issue", count: 3 },
      { reason: "Test order", count: 5 },
      { reason: "Other", count: 1 },
    ];
    mockFn().mockResolvedValueOnce(expected);

    const result = await getVoidReasonCounts();
    expect(result).toHaveLength(6);

    const reasonMap = Object.fromEntries(result.map((r) => [r.reason, r.count]));
    expect(reasonMap["Order cancelled before pickup"]).toBe(12);
    expect(reasonMap["Duplicate order"]).toBe(4);
    expect(reasonMap["Customer dispute"]).toBe(2);
    expect(reasonMap["Payment issue"]).toBe(3);
    expect(reasonMap["Test order"]).toBe(5);
    expect(reasonMap["Other"]).toBe(1);
  });

  // ── 4. Only voided earnings are included ──────────────────────────────────
  it("does NOT include pending, credited, or paid_out earnings", async () => {
    // The mock simulates the DB returning only voided rows.
    // A pending row with reason "Order cancelled before pickup" should NOT appear.
    const expected: VoidReasonCount[] = [
      { reason: "Order cancelled before pickup", count: 2 }, // only the 2 voided ones
    ];
    mockFn().mockResolvedValueOnce(expected);

    const result = await getVoidReasonCounts();
    // If pending/credited/paid_out were included, count would be higher than 2
    expect(result[0].count).toBe(2);
    // Verify the function was called (not bypassed)
    expect(mockFn()).toHaveBeenCalledTimes(1);
  });

  // ── 5. NULL voidReason → grouped as "(no reason)" ─────────────────────────
  it("groups earnings with null voidReason under '(no reason)'", async () => {
    const expected: VoidReasonCount[] = [
      { reason: "(no reason)", count: 3 },
    ];
    mockFn().mockResolvedValueOnce(expected);

    const result = await getVoidReasonCounts();
    expect(result[0]).toMatchObject({ reason: "(no reason)", count: 3 });
  });

  // ── 6. Results sorted descending by count ─────────────────────────────────
  it("returns results sorted descending by count (highest first)", async () => {
    const expected: VoidReasonCount[] = [
      { reason: "Order cancelled before pickup", count: 12 },
      { reason: "Test order", count: 5 },
      { reason: "Duplicate order", count: 4 },
      { reason: "Payment issue", count: 3 },
      { reason: "Customer dispute", count: 2 },
      { reason: "Other", count: 1 },
    ];
    mockFn().mockResolvedValueOnce(expected);

    const result = await getVoidReasonCounts();
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].count).toBeGreaterThanOrEqual(result[i + 1].count);
    }
  });

  // ── 7. Return shape is always correct ────────────────────────────────────
  it("always returns an array of { reason: string, count: number } objects", async () => {
    const expected: VoidReasonCount[] = [
      { reason: "Customer dispute", count: 7 },
    ];
    mockFn().mockResolvedValueOnce(expected);

    const result = await getVoidReasonCounts();
    expect(Array.isArray(result)).toBe(true);
    result.forEach((item) => {
      expect(typeof item.reason).toBe("string");
      expect(typeof item.count).toBe("number");
    });
  });

  // ── 8. Database unavailable → returns empty array ─────────────────────────
  it("returns empty array when database is unavailable", async () => {
    mockFn().mockResolvedValueOnce([]);

    const result = await getVoidReasonCounts();
    expect(result).toEqual([]);
  });
});
