import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

describe("orders.createPublic", () => {
  const caller = appRouter.createCaller({ user: null } as any);

  it("should create order with valid data", async () => {
    const result = await caller.orders.createPublic({
      pickupAddress: "123 Ogui Road, Enugu",
      pickupContactName: "John Doe",
      pickupContactPhone: "08012345678",
      deliveryAddress: "456 Nike Lake Road, Enugu",
      deliveryContactName: "Jane Smith",
      deliveryContactPhone: "08087654321",
      packageDescription: "Documents",
      weightCategory: "0-2kg",
      declaredValue: "5000",
      isFragile: false,
      serviceType: "standard",
      originCity: "Enugu",
      destinationCity: "Enugu",
    });

    expect(result).toBeDefined();
    expect(result.trackingNumber).toBeDefined();
    expect(result.trackingNumber).toMatch(/^AP-EN-\d+$/);
    expect(result.price).toBe(1800); // Base price for standard service
    expect(result.trackingToken).toBeDefined();
  });

  it("should calculate correct price for express service", async () => {
    const result = await caller.orders.createPublic({
      pickupAddress: "123 Ogui Road, Enugu",
      pickupContactName: "John Doe",
      pickupContactPhone: "08012345678",
      deliveryAddress: "456 Nike Lake Road, Enugu",
      deliveryContactName: "Jane Smith",
      deliveryContactPhone: "08087654321",
      serviceType: "express",
      originCity: "Enugu",
      destinationCity: "Enugu",
    });

    expect(result.price).toBe(2800); // Express service price
  });

  it("should calculate correct price with weight surcharge", async () => {
    const result = await caller.orders.createPublic({
      pickupAddress: "123 Ogui Road, Enugu",
      pickupContactName: "John Doe",
      pickupContactPhone: "08012345678",
      deliveryAddress: "456 Nike Lake Road, Enugu",
      deliveryContactName: "Jane Smith",
      deliveryContactPhone: "08087654321",
      serviceType: "standard",
      weightCategory: "5-10kg",
      originCity: "Enugu",
      destinationCity: "Enugu",
    });

    expect(result.price).toBe(2300); // Base 1800 + 500 weight surcharge
  });

  it("should reject order with invalid pickup address", async () => {
    await expect(
      caller.orders.createPublic({
        pickupAddress: "abc", // Too short
        pickupContactName: "John Doe",
        pickupContactPhone: "08012345678",
        deliveryAddress: "456 Nike Lake Road, Enugu",
        deliveryContactName: "Jane Smith",
        deliveryContactPhone: "08087654321",
        serviceType: "standard",
        originCity: "Enugu",
        destinationCity: "Enugu",
      })
    ).rejects.toThrow();
  });

  it("should reject order with invalid phone number", async () => {
    await expect(
      caller.orders.createPublic({
        pickupAddress: "123 Ogui Road, Enugu",
        pickupContactName: "John Doe",
        pickupContactPhone: "123", // Invalid phone
        deliveryAddress: "456 Nike Lake Road, Enugu",
        deliveryContactName: "Jane Smith",
        deliveryContactPhone: "08087654321",
        serviceType: "standard",
        originCity: "Enugu",
        destinationCity: "Enugu",
      })
    ).rejects.toThrow();
  });

  it("should reject order with missing delivery contact name", async () => {
    await expect(
      caller.orders.createPublic({
        pickupAddress: "123 Ogui Road, Enugu",
        pickupContactName: "John Doe",
        pickupContactPhone: "08012345678",
        deliveryAddress: "456 Nike Lake Road, Enugu",
        deliveryContactName: "A", // Too short
        deliveryContactPhone: "08087654321",
        serviceType: "standard",
        originCity: "Enugu",
        destinationCity: "Enugu",
      })
    ).rejects.toThrow();
  });

  it("should create order with optional fields omitted", async () => {
    const result = await caller.orders.createPublic({
      pickupAddress: "123 Ogui Road, Enugu",
      pickupContactName: "John Doe",
      pickupContactPhone: "08012345678",
      deliveryAddress: "456 Nike Lake Road, Enugu",
      deliveryContactName: "Jane Smith",
      deliveryContactPhone: "08087654321",
      serviceType: "standard",
      originCity: "Enugu",
      destinationCity: "Enugu",
    });

    expect(result).toBeDefined();
    expect(result.trackingNumber).toBeDefined();
    expect(result.price).toBe(1800);
  });

  it("should create order with fragile package", async () => {
    const result = await caller.orders.createPublic({
      pickupAddress: "123 Ogui Road, Enugu",
      pickupContactName: "John Doe",
      pickupContactPhone: "08012345678",
      deliveryAddress: "456 Nike Lake Road, Enugu",
      deliveryContactName: "Jane Smith",
      deliveryContactPhone: "08087654321",
      packageDescription: "Glassware",
      isFragile: true,
      serviceType: "standard",
      originCity: "Enugu",
      destinationCity: "Enugu",
    });

    expect(result).toBeDefined();
    expect(result.trackingNumber).toBeDefined();
  });
});
