import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";

// Mock the database module
vi.mock("./db", () => ({
  getOrderById: vi.fn(),
  cancelOrder: vi.fn(),
  archiveOrder: vi.fn(),
  unarchiveOrder: vi.fn(),
  getOrders: vi.fn(),
  updateOrder: vi.fn(),
  createOrderHistory: vi.fn(),
  getOrderHistory: vi.fn(),
  getOrderStats: vi.fn(),
  createOrder: vi.fn(),
  assignRiderToOrder: vi.fn(),
  createTrackingToken: vi.fn(),
  activateTrackingToken: vi.fn(),
  deactivateTrackingToken: vi.fn(),
  getTrackingTokenByToken: vi.fn(),
  getRiders: vi.fn(),
  getRiderById: vi.fn(),
  createRider: vi.fn(),
  updateRider: vi.fn(),
  getDevices: vi.fn(),
  getDeviceById: vi.fn(),
  createDevice: vi.fn(),
  updateDevice: vi.fn(),
  getOrderByTrackingNumber: vi.fn(),
}));

// Mock device status sync
vi.mock("./deviceStatusSync", () => ({
  syncDeviceStatus: vi.fn(),
}));

// Mock settlement
vi.mock("./settlement", () => ({
  onOrderDelivered: vi.fn(),
}));

// Mock traccar
vi.mock("./_core/traccar", () => ({
  default: { getDevicePosition: vi.fn() },
}));

import * as db from "./db";
import { appRouter } from "./routers";

// ─── Context helpers ────────────────────────────────────────────────────────

function makeAdminCtx(overrides?: Partial<TrpcContext["user"]>): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-open-id",
      email: "admin@apiamway.com",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...overrides,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function makeDispatcherCtx(): TrpcContext {
  return makeAdminCtx({ role: "dispatcher", id: 2, openId: "dispatcher-open-id" });
}

function makePendingOrder(overrides?: Record<string, unknown>) {
  return {
    id: 10,
    trackingNumber: "AP-EN-1001",
    customerName: "Test Customer",
    customerPhone: "08011111111",
    pickupAddress: "1 Pickup St",
    deliveryAddress: "2 Delivery Ave",
    price: "2500",
    status: "pending",
    serviceType: "intra-city",
    originCity: "Enugu",
    destinationCity: "Enugu",
    riderId: null,
    deviceId: null,
    partnerCompanyId: null,
    archivedAt: null,
    archivedBy: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    settlementStatus: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Cancel Order Tests ──────────────────────────────────────────────────────

describe("orders.cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancels a normal pending order successfully", async () => {
    vi.mocked(db.getOrderById).mockResolvedValue(makePendingOrder() as any);
    vi.mocked(db.cancelOrder).mockResolvedValue(undefined);
    vi.mocked(db.createOrderHistory).mockResolvedValue(undefined as any);

    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.orders.cancel({ orderId: 10, reason: "Customer requested" });

    expect(result).toEqual({ success: true });
    expect(db.cancelOrder).toHaveBeenCalledWith(10, 1, "Customer requested");
    expect(db.createOrderHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 10,
        previousStatus: "pending",
        newStatus: "cancelled",
        note: "Cancelled: Customer requested",
      })
    );
  });

  it("cancels an assigned order without reason", async () => {
    vi.mocked(db.getOrderById).mockResolvedValue(makePendingOrder({ status: "assigned", deviceId: 5 }) as any);
    vi.mocked(db.cancelOrder).mockResolvedValue(undefined);
    vi.mocked(db.createOrderHistory).mockResolvedValue(undefined as any);

    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.orders.cancel({ orderId: 10 });

    expect(result).toEqual({ success: true });
    expect(db.cancelOrder).toHaveBeenCalledWith(10, 1, undefined);
    expect(db.createOrderHistory).toHaveBeenCalledWith(
      expect.objectContaining({ note: "Cancelled by admin" })
    );
  });

  it("rejects cancellation of a delivered order without force=true", async () => {
    vi.mocked(db.getOrderById).mockResolvedValue(
      makePendingOrder({ status: "delivered", settlementStatus: "settled" }) as any
    );

    const caller = appRouter.createCaller(makeAdminCtx());

    await expect(
      caller.orders.cancel({ orderId: 10, force: false })
    ).rejects.toThrow(TRPCError);

    await expect(
      caller.orders.cancel({ orderId: 10, force: false })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(db.cancelOrder).not.toHaveBeenCalled();
  });

  it("allows force-cancellation of a delivered order when force=true", async () => {
    vi.mocked(db.getOrderById).mockResolvedValue(
      makePendingOrder({ status: "delivered", settlementStatus: "settled" }) as any
    );
    vi.mocked(db.cancelOrder).mockResolvedValue(undefined);
    vi.mocked(db.createOrderHistory).mockResolvedValue(undefined as any);

    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.orders.cancel({ orderId: 10, force: true, reason: "Admin override" });

    expect(result).toEqual({ success: true });
    expect(db.cancelOrder).toHaveBeenCalledWith(10, 1, "Admin override");
  });

  it("rejects cancellation of an already-cancelled order", async () => {
    vi.mocked(db.getOrderById).mockResolvedValue(
      makePendingOrder({ status: "cancelled" }) as any
    );

    const caller = appRouter.createCaller(makeAdminCtx());

    await expect(
      caller.orders.cancel({ orderId: 10 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(db.cancelOrder).not.toHaveBeenCalled();
  });

  it("rejects cancellation of an archived order", async () => {
    vi.mocked(db.getOrderById).mockResolvedValue(
      makePendingOrder({ archivedAt: new Date() }) as any
    );

    const caller = appRouter.createCaller(makeAdminCtx());

    await expect(
      caller.orders.cancel({ orderId: 10 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(db.cancelOrder).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when order does not exist", async () => {
    vi.mocked(db.getOrderById).mockResolvedValue(null);

    const caller = appRouter.createCaller(makeAdminCtx());

    await expect(
      caller.orders.cancel({ orderId: 999 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("is not accessible to dispatcher role", async () => {
    const caller = appRouter.createCaller(makeDispatcherCtx());

    await expect(
      caller.orders.cancel({ orderId: 10 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ─── Archive Order Tests ─────────────────────────────────────────────────────

describe("orders.archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("archives an active order successfully", async () => {
    vi.mocked(db.getOrderById).mockResolvedValue(makePendingOrder() as any);
    vi.mocked(db.archiveOrder).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.orders.archive({ orderId: 10 });

    expect(result).toEqual({ success: true });
    expect(db.archiveOrder).toHaveBeenCalledWith(10, 1);
  });

  it("archives a delivered order (financial records preserved)", async () => {
    vi.mocked(db.getOrderById).mockResolvedValue(
      makePendingOrder({ status: "delivered", settlementStatus: "settled" }) as any
    );
    vi.mocked(db.archiveOrder).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.orders.archive({ orderId: 10 });

    expect(result).toEqual({ success: true });
    // archiveOrder only sets archivedAt/archivedBy — does NOT touch settlement or financial data
    expect(db.archiveOrder).toHaveBeenCalledWith(10, 1);
  });

  it("rejects archiving an already-archived order", async () => {
    vi.mocked(db.getOrderById).mockResolvedValue(
      makePendingOrder({ archivedAt: new Date() }) as any
    );

    const caller = appRouter.createCaller(makeAdminCtx());

    await expect(
      caller.orders.archive({ orderId: 10 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(db.archiveOrder).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when order does not exist", async () => {
    vi.mocked(db.getOrderById).mockResolvedValue(null);

    const caller = appRouter.createCaller(makeAdminCtx());

    await expect(
      caller.orders.archive({ orderId: 999 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("is not accessible to dispatcher role", async () => {
    const caller = appRouter.createCaller(makeDispatcherCtx());

    await expect(
      caller.orders.archive({ orderId: 10 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ─── Unarchive Order Tests ───────────────────────────────────────────────────

describe("orders.unarchive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores an archived order successfully", async () => {
    vi.mocked(db.getOrderById).mockResolvedValue(
      makePendingOrder({ archivedAt: new Date(), archivedBy: 1 }) as any
    );
    vi.mocked(db.unarchiveOrder).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.orders.unarchive({ orderId: 10 });

    expect(result).toEqual({ success: true });
    expect(db.unarchiveOrder).toHaveBeenCalledWith(10);
  });

  it("rejects unarchiving a non-archived order", async () => {
    vi.mocked(db.getOrderById).mockResolvedValue(makePendingOrder() as any);

    const caller = appRouter.createCaller(makeAdminCtx());

    await expect(
      caller.orders.unarchive({ orderId: 10 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(db.unarchiveOrder).not.toHaveBeenCalled();
  });
});

// ─── Archive Filter Tests ────────────────────────────────────────────────────

describe("orders.list archive filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("excludes archived orders by default (includeArchived=false)", async () => {
    const activeOrders = [
      makePendingOrder({ id: 1, trackingNumber: "AP-EN-0001" }),
      makePendingOrder({ id: 2, trackingNumber: "AP-EN-0002" }),
    ];

    vi.mocked(db.getOrders).mockResolvedValue({ items: activeOrders, totalCount: 2 } as any);

    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.orders.list({ page: 1, pageSize: 20, includeArchived: false });

    expect(db.getOrders).toHaveBeenCalledWith(
      expect.objectContaining({ includeArchived: false })
    );
    expect(result.items).toHaveLength(2);
  });

  it("includes archived orders when includeArchived=true", async () => {
    const allOrders = [
      makePendingOrder({ id: 1, trackingNumber: "AP-EN-0001" }),
      makePendingOrder({ id: 2, trackingNumber: "AP-EN-0002", archivedAt: new Date() }),
    ];

    vi.mocked(db.getOrders).mockResolvedValue({ items: allOrders, totalCount: 2 } as any);

    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.orders.list({ page: 1, pageSize: 20, includeArchived: true });

    expect(db.getOrders).toHaveBeenCalledWith(
      expect.objectContaining({ includeArchived: true })
    );
    expect(result.items).toHaveLength(2);
  });

  it("defaults to includeArchived=false when no input is provided", async () => {
    vi.mocked(db.getOrders).mockResolvedValue({ items: [], totalCount: 0 } as any);

    const caller = appRouter.createCaller(makeAdminCtx());
    await caller.orders.list();

    expect(db.getOrders).toHaveBeenCalledWith(
      expect.objectContaining({ includeArchived: false })
    );
  });
});
