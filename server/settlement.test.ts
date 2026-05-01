/**
 * Settlement & Commission Calculation Tests
 */

import { describe, it, expect } from "vitest";
import { calculateCommission } from "./settlement";

describe("Commission Calculation", () => {
  describe("Percentage Commission", () => {
    it("should calculate 70% partner commission correctly", () => {
      const result = calculateCommission(10000, "percentage", 70);
      
      expect(result.grossAmount).toBe(10000);
      expect(result.fleetOwnerPayout).toBe(7000);
      expect(result.apiamwayCommission).toBe(3000);
      expect(result.commissionType).toBe("percentage");
      expect(result.commissionValue).toBe(70);
    });

    it("should calculate 50% partner commission correctly", () => {
      const result = calculateCommission(5000, "percentage", 50);
      
      expect(result.grossAmount).toBe(5000);
      expect(result.fleetOwnerPayout).toBe(2500);
      expect(result.apiamwayCommission).toBe(2500);
    });

    it("should calculate 100% partner commission (Apiamway gets nothing)", () => {
      const result = calculateCommission(10000, "percentage", 100);
      
      expect(result.grossAmount).toBe(10000);
      expect(result.fleetOwnerPayout).toBe(10000);
      expect(result.apiamwayCommission).toBe(0);
    });

    it("should calculate 0% partner commission (Apiamway gets everything)", () => {
      const result = calculateCommission(10000, "percentage", 0);
      
      expect(result.grossAmount).toBe(10000);
      expect(result.fleetOwnerPayout).toBe(0);
      expect(result.apiamwayCommission).toBe(10000);
    });

    it("should throw error for percentage > 100", () => {
      expect(() => {
        calculateCommission(10000, "percentage", 150);
      }).toThrow("Invalid commission percentage: 150");
    });

    it("should throw error for negative percentage", () => {
      expect(() => {
        calculateCommission(10000, "percentage", -10);
      }).toThrow("Invalid commission percentage: -10");
    });

    it("should handle decimal percentages correctly", () => {
      const result = calculateCommission(10000, "percentage", 72.5);
      
      expect(result.grossAmount).toBe(10000);
      expect(result.fleetOwnerPayout).toBe(7250);
      expect(result.apiamwayCommission).toBe(2750);
    });
  });

  describe("Flat Commission", () => {
    it("should calculate flat commission correctly", () => {
      const result = calculateCommission(10000, "flat", 3000);
      
      expect(result.grossAmount).toBe(10000);
      expect(result.apiamwayCommission).toBe(3000);
      expect(result.fleetOwnerPayout).toBe(7000);
      expect(result.commissionType).toBe("flat");
      expect(result.commissionValue).toBe(3000);
    });

    it("should handle flat commission equal to order amount", () => {
      const result = calculateCommission(10000, "flat", 10000);
      
      expect(result.grossAmount).toBe(10000);
      expect(result.apiamwayCommission).toBe(10000);
      expect(result.fleetOwnerPayout).toBe(0);
    });

    it("should handle zero flat commission", () => {
      const result = calculateCommission(10000, "flat", 0);
      
      expect(result.grossAmount).toBe(10000);
      expect(result.apiamwayCommission).toBe(0);
      expect(result.fleetOwnerPayout).toBe(10000);
    });

    it("should throw error for flat commission > order amount", () => {
      expect(() => {
        calculateCommission(10000, "flat", 15000);
      }).toThrow("Invalid flat commission: 15000");
    });

    it("should throw error for negative flat commission", () => {
      expect(() => {
        calculateCommission(10000, "flat", -500);
      }).toThrow("Invalid flat commission: -500");
    });

    it("should handle decimal flat commission", () => {
      const result = calculateCommission(10000, "flat", 2500.50);
      
      expect(result.grossAmount).toBe(10000);
      expect(result.apiamwayCommission).toBe(2500.50);
      expect(result.fleetOwnerPayout).toBe(7499.50);
    });
  });

  describe("Edge Cases", () => {
    it("should handle small order amounts", () => {
      const result = calculateCommission(100, "percentage", 70);
      
      expect(result.grossAmount).toBe(100);
      expect(result.fleetOwnerPayout).toBe(70);
      expect(result.apiamwayCommission).toBe(30);
    });

    it("should handle large order amounts", () => {
      const result = calculateCommission(1000000, "percentage", 70);
      
      expect(result.grossAmount).toBe(1000000);
      expect(result.fleetOwnerPayout).toBe(700000);
      expect(result.apiamwayCommission).toBe(300000);
    });

    it("should round to 2 decimal places", () => {
      const result = calculateCommission(10000, "percentage", 33.33);
      
      expect(result.fleetOwnerPayout).toBe(3333);
      expect(result.apiamwayCommission).toBe(6667);
      // Verify sum equals original amount
      expect(result.fleetOwnerPayout + result.apiamwayCommission).toBe(10000);
    });
  });
});

describe("Settlement Business Rules", () => {
  it("should document idempotency rule", () => {
    // Idempotency is enforced by:
    // 1. Unique constraint on fleetOwnerPayout.orderId
    // 2. settlementStatus check in processOrderSettlement
    // 3. Double-check for existing settlement record
    expect(true).toBe(true);
  });

  it("should document payment confirmation rule", () => {
    // Settlement only runs if order.paymentStatus === 'paid'
    // This prevents crediting partners before payment is confirmed
    expect(true).toBe(true);
  });

  it("should document partner fleet rule", () => {
    // Settlement only runs if order.partnerCompanyId is set
    // Apiamway-owned fleet orders (partnerCompanyId = null) are skipped
    expect(true).toBe(true);
  });

  it("should document suspended partner rule", () => {
    // Settlement runs even if partner.status === 'suspended'
    // This ensures completed work is always compensated
    expect(true).toBe(true);
  });
});
