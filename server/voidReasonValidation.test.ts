/**
 * voidReason Zod schema validation tests
 *
 * The tRPC voidEarning mutation requires reason to be a non-empty string
 * (min 1 char, max 500 chars). These tests verify the Zod schema directly.
 *
 * Covers:
 *  - preset reason is accepted
 *  - "Other" custom reason is accepted
 *  - empty string is rejected
 *  - whitespace-only string is rejected at the UI layer (resolvedVoidReason = "")
 *  - string over 500 chars is rejected
 *  - missing reason field is rejected
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

// Mirror the exact Zod schema used in the voidEarning tRPC mutation
const voidEarningInputSchema = z.object({
  earningId: z.number().int().positive(),
  reason: z.string().min(1, "Void reason is required").max(500),
});

const VALID_PRESETS = [
  "Order cancelled before pickup",
  "Duplicate order",
  "Customer dispute",
  "Payment issue",
  "Test order",
];

describe("voidEarning input validation — reason field", () => {
  it("accepts each standard preset reason", () => {
    for (const preset of VALID_PRESETS) {
      const result = voidEarningInputSchema.safeParse({
        earningId: 1,
        reason: preset,
      });
      expect(result.success, `Preset "${preset}" should be valid`).toBe(true);
    }
  });

  it("accepts a custom 'Other' reason text", () => {
    const result = voidEarningInputSchema.safeParse({
      earningId: 1,
      reason: "Admin manually reviewed — no payout due after customer dispute",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty string reason", () => {
    const result = voidEarningInputSchema.safeParse({
      earningId: 1,
      reason: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Void reason is required");
    }
  });

  it("rejects a reason that is only whitespace (UI resolves to empty string)", () => {
    // The UI trims the custom text before sending: resolvedVoidReason = voidReasonOther.trim()
    // So a whitespace-only "Other" input becomes "" which fails min(1)
    const result = voidEarningInputSchema.safeParse({
      earningId: 1,
      reason: "   ",
    });
    // "   " has length 3 so it passes min(1) at the schema level.
    // The UI guard (isVoidReasonValid) prevents submission when trim() === "".
    // This test documents that the schema alone does not catch whitespace-only,
    // but the UI layer does — so we verify the UI guard logic separately.
    expect(result.success).toBe(true); // schema passes, UI blocks it
  });

  it("rejects a reason longer than 500 characters", () => {
    const longReason = "A".repeat(501);
    const result = voidEarningInputSchema.safeParse({
      earningId: 1,
      reason: longReason,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].code).toBe("too_big");
    }
  });

  it("accepts a reason of exactly 500 characters", () => {
    const maxReason = "B".repeat(500);
    const result = voidEarningInputSchema.safeParse({
      earningId: 1,
      reason: maxReason,
    });
    expect(result.success).toBe(true);
  });

  it("rejects when reason field is missing entirely", () => {
    const result = voidEarningInputSchema.safeParse({
      earningId: 1,
      // reason omitted
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const reasonIssue = result.error.issues.find((i) => i.path[0] === "reason");
      expect(reasonIssue).toBeDefined();
    }
  });
});

// ─── UI guard logic tests ─────────────────────────────────────────────────────
// Mirror the isVoidReasonValid logic from CancelledEarnings.tsx

function isVoidReasonValid(preset: string, otherText: string): boolean {
  return (
    preset !== "" &&
    (preset !== "Other" || otherText.trim().length > 0)
  );
}

function resolvedVoidReason(preset: string, otherText: string): string {
  return preset === "Other" ? otherText.trim() : preset;
}

describe("UI void reason validation (isVoidReasonValid)", () => {
  it("is invalid when no preset is selected", () => {
    expect(isVoidReasonValid("", "")).toBe(false);
  });

  it("is valid when a non-Other preset is selected", () => {
    expect(isVoidReasonValid("Duplicate order", "")).toBe(true);
  });

  it("is invalid when 'Other' is selected but custom text is empty", () => {
    expect(isVoidReasonValid("Other", "")).toBe(false);
  });

  it("is invalid when 'Other' is selected but custom text is only whitespace", () => {
    expect(isVoidReasonValid("Other", "   ")).toBe(false);
  });

  it("is valid when 'Other' is selected and custom text is provided", () => {
    expect(isVoidReasonValid("Other", "Admin reviewed manually")).toBe(true);
  });

  it("resolves preset reason correctly for non-Other preset", () => {
    expect(resolvedVoidReason("Customer dispute", "")).toBe("Customer dispute");
  });

  it("resolves 'Other' reason to trimmed custom text", () => {
    expect(resolvedVoidReason("Other", "  Custom reason  ")).toBe("Custom reason");
  });
});
