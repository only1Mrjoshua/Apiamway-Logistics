import { describe, it, expect } from "vitest";
import { initializePayment } from "./paystack";
import { getDevices } from "./traccar";

describe("Credentials Verification", () => {
  describe("Paystack Integration", () => {
    it("should initialize payment with valid credentials", async () => {
      const result = await initializePayment({
        email: "test@example.com",
        amount: 1000, // ₦10.00 in kobo
        metadata: {
          userId: "test-user-123",
          purpose: "wallet_topup",
        },
      });

      expect(result).toBeDefined();
      expect(result.status).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.authorization_url).toContain("paystack.com");
      expect(result.data.reference).toBeDefined();
    }, 15000); // 15s timeout for API call
  });

  describe("Traccar Integration", () => {
    it("should fetch devices with valid credentials", async () => {
      const devices = await getDevices();

      expect(devices).toBeDefined();
      expect(Array.isArray(devices)).toBe(true);
      // Demo server may have 0 or more devices
      console.log(`Traccar returned ${devices.length} devices`);
    }, 15000); // 15s timeout for API call
  });
});
