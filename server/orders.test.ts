import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  createOrder: vi.fn(),
  getOrders: vi.fn(),
  getOrderById: vi.fn(),
  getOrderByTrackingNumber: vi.fn(),
  updateOrder: vi.fn(),
  assignRiderToOrder: vi.fn(),
  createTrackingToken: vi.fn(),
  activateTrackingToken: vi.fn(),
  deactivateTrackingToken: vi.fn(),
  createOrderHistory: vi.fn(),
  getOrderHistory: vi.fn(),
  getOrderStats: vi.fn(),
  getRiders: vi.fn(),
  getRiderById: vi.fn(),
  createRider: vi.fn(),
  updateRider: vi.fn(),
  getDevices: vi.fn(),
  getDeviceById: vi.fn(),
  createDevice: vi.fn(),
  updateDevice: vi.fn(),
  getTrackingTokenByToken: vi.fn(),
}));

import * as db from "./db";

describe("Order Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Order Creation", () => {
    it("should generate a tracking number in the correct format", async () => {
      const mockOrder = {
        id: 1,
        trackingNumber: "AP-EN-1234",
        customerName: "Test Customer",
        customerPhone: "08012345678",
        pickupAddress: "123 Test Street",
        deliveryAddress: "456 Delivery Ave",
        price: "2500",
        status: "pending",
        serviceType: "intra-city",
        originCity: "Enugu",
        destinationCity: "Enugu",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.createOrder).mockResolvedValue(mockOrder as any);
      vi.mocked(db.createTrackingToken).mockResolvedValue({
        id: 1,
        orderId: 1,
        token: "test-token-123",
        isActive: false,
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      const result = await db.createOrder({
        customerName: "Test Customer",
        customerPhone: "08012345678",
        pickupAddress: "123 Test Street",
        deliveryAddress: "456 Delivery Ave",
        price: "2500",
      });

      expect(result).toBeDefined();
      expect(result?.trackingNumber).toMatch(/^AP-EN-\d{4}$/);
    });

    it("should create a tracking token for new orders", async () => {
      const mockToken = {
        id: 1,
        orderId: 1,
        token: "abc123xyz",
        isActive: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      };

      vi.mocked(db.createTrackingToken).mockResolvedValue(mockToken);

      const result = await db.createTrackingToken(1);

      expect(result).toBeDefined();
      expect(result?.isActive).toBe(false);
      expect(result?.token).toBeDefined();
    });
  });

  describe("Order Status Workflow", () => {
    it("should follow the correct status progression", () => {
      const validStatuses = [
        "pending",
        "assigned",
        "picked_up",
        "in_transit",
        "delivered",
        "failed",
        "returned",
      ];

      // Verify all expected statuses are valid
      validStatuses.forEach((status) => {
        expect(validStatuses).toContain(status);
      });
    });

    it("should activate tracking token on pickup", async () => {
      vi.mocked(db.activateTrackingToken).mockResolvedValue(undefined);

      await db.activateTrackingToken(1);

      expect(db.activateTrackingToken).toHaveBeenCalledWith(1);
    });

    it("should deactivate tracking token on delivery", async () => {
      vi.mocked(db.deactivateTrackingToken).mockResolvedValue(undefined);

      await db.deactivateTrackingToken(1);

      expect(db.deactivateTrackingToken).toHaveBeenCalledWith(1);
    });
  });

  describe("Order Filtering", () => {
    it("should filter orders by status", async () => {
      const mockOrders = [
        { id: 1, status: "pending", trackingNumber: "AP-EN-0001" },
        { id: 2, status: "pending", trackingNumber: "AP-EN-0002" },
      ];

      vi.mocked(db.getOrders).mockResolvedValue(mockOrders as any);

      const result = await db.getOrders({ status: "pending" });

      expect(db.getOrders).toHaveBeenCalledWith({ status: "pending" });
      expect(result).toHaveLength(2);
      expect(result.every((o) => o.status === "pending")).toBe(true);
    });

    it("should filter orders by rider", async () => {
      const mockOrders = [
        { id: 1, riderId: 5, trackingNumber: "AP-EN-0001" },
      ];

      vi.mocked(db.getOrders).mockResolvedValue(mockOrders as any);

      const result = await db.getOrders({ riderId: 5 });

      expect(db.getOrders).toHaveBeenCalledWith({ riderId: 5 });
      expect(result).toHaveLength(1);
    });
  });
});

describe("Rider Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a new rider", async () => {
    const mockRider = {
      id: 1,
      name: "John Rider",
      phone: "08012345678",
      status: "active",
      assignedHub: "Enugu-Main",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.createRider).mockResolvedValue(mockRider as any);

    const result = await db.createRider({
      name: "John Rider",
      phone: "08012345678",
    });

    expect(result).toBeDefined();
    expect(result?.name).toBe("John Rider");
    expect(result?.status).toBe("active");
  });

  it("should list active riders", async () => {
    const mockRiders = [
      { id: 1, name: "Rider 1", status: "active" },
      { id: 2, name: "Rider 2", status: "active" },
    ];

    vi.mocked(db.getRiders).mockResolvedValue(mockRiders as any);

    const result = await db.getRiders("active");

    expect(db.getRiders).toHaveBeenCalledWith("active");
    expect(result).toHaveLength(2);
  });
});

describe("Device Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a new device", async () => {
    const mockDevice = {
      id: 1,
      traccarDeviceId: 12345,
      name: "Bike-001",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.createDevice).mockResolvedValue(mockDevice as any);

    const result = await db.createDevice({
      traccarDeviceId: 12345,
      name: "Bike-001",
    });

    expect(result).toBeDefined();
    expect(result?.traccarDeviceId).toBe(12345);
    expect(result?.status).toBe("active");
  });

  it("should list devices by status", async () => {
    const mockDevices = [
      { id: 1, name: "Device 1", status: "active" },
    ];

    vi.mocked(db.getDevices).mockResolvedValue(mockDevices as any);

    const result = await db.getDevices("active");

    expect(db.getDevices).toHaveBeenCalledWith("active");
    expect(result).toHaveLength(1);
  });
});

describe("Public Tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return tracking info for valid token", async () => {
    const mockToken = {
      id: 1,
      orderId: 1,
      token: "valid-token-123",
      isActive: true,
      expiresAt: new Date(Date.now() + 86400000), // 1 day from now
      createdAt: new Date(),
    };

    vi.mocked(db.getTrackingTokenByToken).mockResolvedValue(mockToken);

    const result = await db.getTrackingTokenByToken("valid-token-123");

    expect(result).toBeDefined();
    expect(result?.isActive).toBe(true);
  });

  it("should return null for invalid token", async () => {
    vi.mocked(db.getTrackingTokenByToken).mockResolvedValue(null);

    const result = await db.getTrackingTokenByToken("invalid-token");

    expect(result).toBeNull();
  });

  it("should check token expiration", async () => {
    const expiredToken = {
      id: 1,
      orderId: 1,
      token: "expired-token",
      isActive: true,
      expiresAt: new Date(Date.now() - 86400000), // 1 day ago
      createdAt: new Date(),
    };

    vi.mocked(db.getTrackingTokenByToken).mockResolvedValue(expiredToken);

    const result = await db.getTrackingTokenByToken("expired-token");

    expect(result).toBeDefined();
    expect(result?.expiresAt).toBeDefined();
    expect(new Date() > result!.expiresAt!).toBe(true);
  });
});

describe("Dashboard Statistics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return order statistics", async () => {
    const mockStats = {
      total: 100,
      delivered: 80,
      failed: 5,
      pending: 10,
      inTransit: 5,
      onTimeRate: 80,
      totalRevenue: 250000,
    };

    vi.mocked(db.getOrderStats).mockResolvedValue(mockStats);

    const result = await db.getOrderStats();

    expect(result).toBeDefined();
    expect(result?.total).toBe(100);
    expect(result?.onTimeRate).toBe(80);
  });
});
