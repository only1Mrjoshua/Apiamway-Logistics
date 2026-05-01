import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { getDb } from "./db";
import { orders, partnerEarnings } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import * as traccar from "./traccar";
import { geocodeAddress } from "./geocoding";
import * as paystack from "./paystack";
import * as opay from "./opay";
import { onOrderDelivered } from "./settlement";
import { processWeeklyPayouts, getFleetOwnerPayoutHistory, getFleetOwnerPendingEarnings } from "./weeklyPayout";
import { listCancelledOrderEarnings, exportCancelledOrderEarnings, voidEarning, bulkVoidEarnings, listSettlementWarnings, getVoidReasonCounts } from "./db";
import { fleetOwnerRouter } from "./fleetOwnerRouter";
import { syncDeviceStatus } from "./deviceStatusSync";

// Dispatcher procedure - allows admin and dispatcher roles
const dispatcherProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user || !["admin", "dispatcher"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Dispatcher access required" });
  }
  return next({ ctx });
});

// Validation helpers
const validatePhoneNumber = (phone: string): boolean => {
  const cleaned = phone.replace(/\s/g, '');
  // Nigerian phone: 11 digits starting with 0, or 13 digits starting with +234
  return /^0[789][01]\d{8}$/.test(cleaned) || /^\+234[789][01]\d{8}$/.test(cleaned) || cleaned.length >= 10;
};

// Reusable validation schema for route details
const routeValidationSchema = z.object({
  pickupAddress: z.string().min(5, "Pickup address must be at least 5 characters"),
  pickupContactName: z.string().min(2, "Pickup contact name is required"),
  pickupContactPhone: z.string().min(10, "Valid pickup phone number is required").refine(validatePhoneNumber, "Invalid phone number format"),
  deliveryAddress: z.string().min(5, "Delivery address must be at least 5 characters"),
  deliveryContactName: z.string().min(2, "Delivery contact name is required"),
  deliveryContactPhone: z.string().min(10, "Valid delivery phone number is required").refine(validatePhoneNumber, "Invalid phone number format"),
});

export const appRouter = router({
  system: systemRouter,
  fleetOwner: fleetOwnerRouter,
  
  // ==================== USER MANAGEMENT ====================
  users: router({
    // Admin: Get all users with stats
    getAll: adminProcedure
      .input(z.object({
        search: z.string().optional(),
        accountType: z.enum(["shipper", "fleet_owner", "all"]).optional(),
        fleetOwnerStatus: z.enum(["pending", "approved", "suspended", "rejected", "all"]).optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      }).optional())
      .query(async ({ input }) => {
        const page = input?.page || 1;
        const pageSize = input?.pageSize || 20;
        const offset = (page - 1) * pageSize;
        
        const result = await db.getAllUsersWithStats({
          ...input,
          limit: pageSize,
          offset,
        });
        
        return {
          items: result.items,
          totalCount: result.totalCount,
          page,
          pageSize,
          totalPages: Math.ceil(result.totalCount / pageSize),
        };
      }),
    
    // Admin: Get user by ID with full details
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getUserById(input.id);
      }),
    
    // Admin: Get user's orders
    getOrders: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getUserOrders(input.userId);
      }),
    
    // Admin: Get user's wallet transactions
    getWalletTransactions: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getUserWalletTransactions(input.userId);
      }),
    
    // Admin: Get user's referral stats
    getReferralStats: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getUserReferralStats(input.userId);
      }),

    // User: Update own profile (name, phone)
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().min(2, "Name must be at least 2 characters").optional(),
        phone: z.string().min(10, "Valid phone number is required").refine(validatePhoneNumber, "Invalid phone number format").optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const updateData: { name?: string; phone?: string } = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.phone !== undefined) updateData.phone = input.phone;

        await db.updateUserProfile(ctx.user.id, updateData);
        return { success: true };
      }),
  }),
  
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.req.session?.destroy((error) => {
        if (error) {
          console.error("[Auth] Failed to destroy session:", error);
        }
      });

      ctx.res.clearCookie("connect.sid");

      return { success: true } as const;
    }),
  }),

  // ==================== RIDER MANAGEMENT ====================
  riders: router({
    list: dispatcherProcedure
      .input(z.object({
        status: z.enum(["active", "inactive", "on_leave"]).optional(),
        searchQuery: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      }).optional())
      .query(async ({ input }) => {
        const page = input?.page || 1;
        const pageSize = input?.pageSize || 20;
        const offset = (page - 1) * pageSize;
        
        const result = await db.getRiders({
          status: input?.status,
          searchQuery: input?.searchQuery,
          limit: pageSize,
          offset,
        });
        
        return {
          items: result.items,
          totalCount: result.totalCount,
          page,
          pageSize,
          totalPages: Math.ceil(result.totalCount / pageSize),
        };
      }),
    
    getById: dispatcherProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getRiderById(input.id);
      }),
    
    create: adminProcedure
      .input(z.object({
        name: z.string().min(2),
        phone: z.string().min(10),
        status: z.enum(["active", "inactive", "on_leave"]).default("active"),
        assignedHub: z.string().default("Enugu-Main"),
      }))
      .mutation(async ({ input }) => {
        return db.createRider(input);
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(2).optional(),
        phone: z.string().min(10).optional(),
        status: z.enum(["active", "inactive", "on_leave"]).optional(),
        currentDeviceId: z.number().nullable().optional(),
        assignedHub: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateRider(id, data);
        return { success: true };
      }),
    
    // Link user account to rider
    linkUser: adminProcedure
      .input(z.object({
        riderId: z.number(),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        // Check if userId is already linked to another rider
        const existingRider = await db.getRiderByUserId(input.userId);
        if (existingRider && existingRider.id !== input.riderId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This user is already linked to another rider",
          });
        }
        
        // Check if rider exists
        const rider = await db.getRiderById(input.riderId);
        if (!rider) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Rider not found",
          });
        }
        
        // Link user to rider
        await db.updateRider(input.riderId, { userId: input.userId });
        return { success: true };
      }),
    
    // Unlink user account from rider
    unlinkUser: adminProcedure
      .input(z.object({
        riderId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.updateRider(input.riderId, { userId: null });
        return { success: true };
      }),
  }),

  // ==================== DEVICE MANAGEMENT ====================
  devices: router({
    list: dispatcherProcedure
      .input(z.object({
        status: z.enum(["available", "in_transit", "maintenance", "inactive"]).optional(),
        searchQuery: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      }).optional())
      .query(async ({ input }) => {
        const page = input?.page || 1;
        const pageSize = input?.pageSize || 20;
        const offset = (page - 1) * pageSize;
        
        const result = await db.getDevices({
          status: input?.status,
          searchQuery: input?.searchQuery,
          limit: pageSize,
          offset,
        });
        
        return {
          items: result.items,
          totalCount: result.totalCount,
          page,
          pageSize,
          totalPages: Math.ceil(result.totalCount / pageSize),
        };
      }),
    
    getById: dispatcherProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getDeviceById(input.id);
      }),
    
    getMaintenanceHistory: adminProcedure
      .input(z.object({ deviceId: z.number() }))
      .query(async ({ input }) => {
        return db.getDeviceMaintenanceHistory(input.deviceId);
      }),
    
    create: adminProcedure
      .input(z.object({
        traccarDeviceId: z.number(),
        name: z.string().min(2),
        label: z.string().min(1).optional(),
        status: z.enum(["available", "in_transit", "maintenance", "inactive"]).default("available"),
      }))
      .mutation(async ({ input }) => {
        return db.createDevice(input);
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        traccarDeviceId: z.number().optional(),
        name: z.string().min(2).optional(),
        label: z.string().min(1).optional(),
        status: z.enum(["available", "in_transit", "maintenance", "inactive"]).optional(),
        maintenanceReason: z.string().nullable().optional(),
        maintenanceUntil: z.string().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, maintenanceUntil, status, maintenanceReason, ...data } = input;
        const updateData: any = { ...data };
        
        // Convert maintenanceUntil string to Date if provided
        if (maintenanceUntil !== undefined) {
          updateData.maintenanceUntil = maintenanceUntil ? new Date(maintenanceUntil) : null;
        }
        if (status !== undefined) {
          updateData.status = status;
        }
        if (maintenanceReason !== undefined) {
          updateData.maintenanceReason = maintenanceReason;
        }
        
        // Log maintenance events
        if (status === "maintenance" && ctx.user) {
          await db.createMaintenanceEvent({
            deviceId: id,
            actionType: "set_maintenance",
            reason: maintenanceReason || null,
            maintenanceUntil: maintenanceUntil ? new Date(maintenanceUntil) : null,
            performedByUserId: ctx.user.id,
          });
        } else if (status === "available" && maintenanceReason === null && ctx.user) {
          // Only log mark_available if we're clearing maintenance (maintenanceReason set to null)
          await db.createMaintenanceEvent({
            deviceId: id,
            actionType: "mark_available",
            reason: null,
            maintenanceUntil: null,
            performedByUserId: ctx.user.id,
          });
        }
        
        await db.updateDevice(id, updateData);
        return { success: true };
      }),
  }),

  // ==================== ORDER MANAGEMENT ====================
  orders: router({
    list: dispatcherProcedure
      .input(z.object({
        status: z.string().optional(),
        riderId: z.number().optional(),
        fromDate: z.date().optional(),
        toDate: z.date().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        includeArchived: z.boolean().default(false),
      }).optional())
      .query(async ({ input }) => {
        const page = input?.page || 1;
        const pageSize = input?.pageSize || 20;
        const offset = (page - 1) * pageSize;
        
        const result = await db.getOrders({
          ...input,
          limit: pageSize,
          offset,
          includeArchived: input?.includeArchived ?? false,
        });
        
        return {
          items: result.items,
          totalCount: result.totalCount,
          page,
          pageSize,
          totalPages: Math.ceil(result.totalCount / pageSize),
        };
      }),
    
    getById: dispatcherProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const order = await db.getOrderById(input.id);
        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        return order;
      }),
    
    getByTrackingNumber: publicProcedure
      .input(z.object({ trackingNumber: z.string() }))
      .query(async ({ input }) => {
        const order = await db.getOrderByTrackingNumber(input.trackingNumber);
        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        
        // Get rider info if assigned
        let riderPhone: string | null = null;
        let riderLocation: { lat: number; lng: number; timestamp: Date } | null = null;
        
        if (order.riderId && order.status === "in_transit") {
          const rider = await db.getRiderById(order.riderId);
          if (rider) {
            riderPhone = rider.phone;
            
            // Get live location from Traccar if device is assigned
            if (rider.currentDeviceId) {
              try {
                const position = await traccar.getDevicePosition(rider.currentDeviceId);
                if (position) {
                  riderLocation = {
                    lat: position.latitude,
                    lng: position.longitude,
                    timestamp: new Date(position.deviceTime || position.serverTime),
                  };
                }
              } catch (error) {
                console.error("Failed to fetch rider location:", error);
              }
            }
          }
        }
        
        return {
          trackingNumber: order.trackingNumber,
          status: order.status,
          originCity: order.originCity,
          destinationCity: order.destinationCity,
          serviceType: order.serviceType,
          createdAt: order.createdAt,
          pickedUpAt: order.actualPickupAt,
          deliveredAt: order.actualDeliveryAt,
          pickupAddress: order.pickupAddress,
          pickupLat: order.pickupLat,
          pickupLng: order.pickupLng,
          pickupContactName: order.pickupContactName,
          deliveryAddress: order.deliveryAddress,
          deliveryLat: order.deliveryLat,
          deliveryLng: order.deliveryLng,
          deliveryContactName: order.deliveryContactName,
          riderPhone,
          riderLocation,
        };
      }),
    
    // Admin/Dispatcher order creation
    create: dispatcherProcedure
      .input(z.object({
        customerName: z.string().min(2),
        customerPhone: z.string().min(10).refine(validatePhoneNumber, "Invalid phone number"),
        customerEmail: z.string().email().optional(),
        pickupAddress: z.string().min(5, "Pickup address is required"),
        pickupZone: z.string().optional(),
        pickupContactName: z.string().min(2, "Pickup contact name is required"),
        pickupContactPhone: z.string().min(10).refine(validatePhoneNumber, "Invalid pickup phone"),
        deliveryAddress: z.string().min(5, "Delivery address is required"),
        deliveryZone: z.string().optional(),
        deliveryContactName: z.string().min(2, "Delivery contact name is required"),
        deliveryContactPhone: z.string().min(10).refine(validatePhoneNumber, "Invalid delivery phone"),
        serviceType: z.enum(["intra-city", "inter-city-air", "inter-city-ground"]).default("intra-city"),
        originCity: z.string().default("Enugu"),
        destinationCity: z.string().default("Enugu"),
        weightKg: z.string().optional(),
        price: z.string(),
        paymentMethod: z.string().optional(),
        packageDescription: z.string().optional(),
        declaredValue: z.string().optional(),
        scheduledPickupAt: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Geocode addresses
        const [pickupGeo, deliveryGeo] = await Promise.all([
          geocodeAddress(input.pickupAddress),
          geocodeAddress(input.deliveryAddress),
        ]);
        
        const order = await db.createOrder({
          ...input,
          pickupLat: pickupGeo?.lat.toString(),
          pickupLng: pickupGeo?.lng.toString(),
          deliveryLat: deliveryGeo?.lat.toString(),
          deliveryLng: deliveryGeo?.lng.toString(),
        });
        if (!order) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create order" });
        }
        
        // Create tracking token
        await db.createTrackingToken(order.id);
        
        // Log history
        await db.createOrderHistory({
          orderId: order.id,
          newStatus: "pending",
          changedByUserId: ctx.user.id,
          note: "Order created",
        });
        
        return order;
      }),
    
    // Public order creation (for customer booking)
    createPublic: publicProcedure
      .input(z.object({
        // Pickup details - ALL REQUIRED
        pickupAddress: z.string().min(5, "Pickup address is required"),
        pickupContactName: z.string().min(2, "Pickup contact name is required"),
        pickupContactPhone: z.string().min(10, "Pickup phone is required").refine(validatePhoneNumber, "Invalid phone number"),
        // Delivery details - ALL REQUIRED
        deliveryAddress: z.string().min(5, "Delivery address is required"),
        deliveryContactName: z.string().min(2, "Delivery contact name is required"),
        deliveryContactPhone: z.string().min(10, "Delivery phone is required").refine(validatePhoneNumber, "Invalid phone number"),
        // Package details
        packageDescription: z.string().optional(),
        weightCategory: z.string().default("0-2kg"),
        declaredValue: z.string().optional(),
        isFragile: z.boolean().default(false),
        // Service selection
        serviceType: z.enum(["standard", "express"]).default("standard"),
        // Origin/destination (defaults to Enugu for intra-city)
        originCity: z.string().default("Enugu"),
        destinationCity: z.string().default("Enugu"),
      }))
      .mutation(async ({ input }) => {
        // Backend validation: Reject if pickup or dropoff is missing
        if (!input.pickupAddress || input.pickupAddress.trim().length < 5) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Valid pickup address is required" });
        }
        if (!input.pickupContactName || input.pickupContactName.trim().length < 2) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Pickup contact name is required" });
        }
        if (!input.pickupContactPhone || !validatePhoneNumber(input.pickupContactPhone)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Valid pickup phone number is required" });
        }
        if (!input.deliveryAddress || input.deliveryAddress.trim().length < 5) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Valid delivery address is required" });
        }
        if (!input.deliveryContactName || input.deliveryContactName.trim().length < 2) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Delivery contact name is required" });
        }
        if (!input.deliveryContactPhone || !validatePhoneNumber(input.deliveryContactPhone)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Valid delivery phone number is required" });
        }
        
        // Calculate price based on service type
        let price = 1800; // Base price
        if (input.serviceType === "express") {
          price = 2800;
        }
        // Add weight surcharge
        if (input.weightCategory === "5-10kg") {
          price += 500;
        } else if (input.weightCategory === ">10kg") {
          price += 1000;
        }
        
        // Convert weight category to numeric value (midpoint of range)
        let weightKgNumeric: string;
        if (input.weightCategory === "0-2kg") {
          weightKgNumeric = "1"; // Midpoint
        } else if (input.weightCategory === "2-5kg") {
          weightKgNumeric = "3.5";
        } else if (input.weightCategory === "5-10kg") {
          weightKgNumeric = "7.5";
        } else if (input.weightCategory === ">10kg") {
          weightKgNumeric = "15"; // Estimate
        } else {
          weightKgNumeric = "1"; // Default
        }
        
        const order = await db.createOrder({
          customerName: input.pickupContactName,
          customerPhone: input.pickupContactPhone,
          pickupAddress: input.pickupAddress,
          pickupContactName: input.pickupContactName,
          pickupContactPhone: input.pickupContactPhone,
          deliveryAddress: input.deliveryAddress,
          deliveryContactName: input.deliveryContactName,
          deliveryContactPhone: input.deliveryContactPhone,
          serviceType: input.serviceType === "express" ? "intra-city" : "intra-city",
          originCity: input.originCity,
          destinationCity: input.destinationCity,
          weightKg: weightKgNumeric,
          price: price.toString(),
          packageDescription: input.packageDescription,
          declaredValue: input.declaredValue,
        });
        
        if (!order) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create order" });
        }
        
        // Create tracking token
        const trackingToken = await db.createTrackingToken(order.id);
        
        // Log history
        await db.createOrderHistory({
          orderId: order.id,
          newStatus: "pending",
          note: "Order created via public booking",
        });
        
        return {
          trackingNumber: order.trackingNumber,
          price: price,
          trackingToken: trackingToken?.token,
        };
      }),
    
    // Calculate price without creating order (for preview)
    calculatePrice: publicProcedure
      .input(z.object({
        pickupAddress: z.string().min(5, "Pickup address is required"),
        deliveryAddress: z.string().min(5, "Delivery address is required"),
        serviceType: z.enum(["standard", "express"]).default("standard"),
        weightCategory: z.string().default("0-2kg"),
        originCity: z.string().default("Enugu"),
        destinationCity: z.string().default("Enugu"),
      }))
      .query(async ({ input }) => {
        // Backend validation: Reject if pickup or dropoff is missing
        if (!input.pickupAddress || input.pickupAddress.trim().length < 5) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Valid pickup address is required to calculate price" });
        }
        if (!input.deliveryAddress || input.deliveryAddress.trim().length < 5) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Valid delivery address is required to calculate price" });
        }
        
        // Calculate price
        let price = 1800; // Base price for standard intra-city
        
        if (input.serviceType === "express") {
          price = 2800;
        }
        
        // Weight surcharge
        if (input.weightCategory === "5-10kg") {
          price += 500;
        } else if (input.weightCategory === ">10kg") {
          price += 1000;
        }
        
        // Inter-city surcharge (if different cities)
        if (input.originCity !== input.destinationCity) {
          price += 2000;
        }
        
        return {
          price,
          breakdown: {
            base: input.serviceType === "express" ? 2800 : 1800,
            weightSurcharge: input.weightCategory === "5-10kg" ? 500 : input.weightCategory === ">10kg" ? 1000 : 0,
            interCitySurcharge: input.originCity !== input.destinationCity ? 2000 : 0,
          },
          currency: "NGN",
        };
      }),
    
    assignRider: dispatcherProcedure
      .input(z.object({
        orderId: z.number(),
        riderId: z.number(),
        deviceId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        
        // Validate device is not in maintenance
        const device = await db.getDeviceById(input.deviceId);
        if (!device) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Device not found" });
        }
        if (device.status === "maintenance") {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: `Cannot assign bike in maintenance. Reason: ${device.maintenanceReason || "Under maintenance"}` 
          });
        }
        if (device.status === "inactive") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot assign inactive bike" });
        }
        
        await db.assignRiderToOrder(input.orderId, input.riderId, input.deviceId);
        
        // Sync device status to in_transit
        await syncDeviceStatus(input.deviceId, "assigned");
        
        await db.createOrderHistory({
          orderId: input.orderId,
          previousStatus: order.status,
          newStatus: "assigned",
          changedByUserId: ctx.user.id,
          note: `Assigned to rider ${input.riderId} with device ${input.deviceId}`,
        });
        
        return { success: true };
      }),
    
    updateStatus: dispatcherProcedure
      .input(z.object({
        orderId: z.number(),
        status: z.enum(["pending", "assigned", "picked_up", "in_transit", "delivered", "failed", "returned"]),
        note: z.string().optional(),
        proofOfDeliveryUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        
        const updateData: Record<string, any> = { status: input.status };
        
        // Handle status-specific updates
        if (input.status === "picked_up") {
          updateData.actualPickupAt = new Date();
          // Activate tracking token
          await db.activateTrackingToken(input.orderId);
        }
        
        if (input.status === "delivered") {
          updateData.actualDeliveryAt = new Date();
          if (input.proofOfDeliveryUrl) {
            updateData.proofOfDeliveryUrl = input.proofOfDeliveryUrl;
          }
          // Deactivate tracking token
          await db.deactivateTrackingToken(input.orderId);
          
          // Trigger settlement for partner fleet orders
          // This will calculate commission and credit partner balance
          // Runs asynchronously to avoid blocking the status update
          onOrderDelivered(input.orderId).catch(err => {
            console.error(`[Settlement] Failed for order ${input.orderId}:`, err);
          });
        }
        
        if (input.status === "failed" || input.status === "returned") {
          // Deactivate tracking token
          await db.deactivateTrackingToken(input.orderId);
        }
        
        if (input.note) {
          updateData.deliveryNote = input.note;
        }
        
        await db.updateOrder(input.orderId, updateData);
        
        // Sync device status based on new order status
        await syncDeviceStatus(order.deviceId, input.status);
        
        await db.createOrderHistory({
          orderId: input.orderId,
          previousStatus: order.status,
          newStatus: input.status,
          changedByUserId: ctx.user.id,
          note: input.note,
        });
        
        return { success: true };
      }),
    
    getHistory: dispatcherProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        return db.getOrderHistory(input.orderId);
      }),

    cancel: adminProcedure
      .input(z.object({
        orderId: z.number(),
        reason: z.string().optional(),
        force: z.boolean().default(false),
      }))
      .mutation(async ({ input, ctx }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        if (order.archivedAt) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot cancel an archived order" });
        }
        if (order.status === "cancelled") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Order is already cancelled" });
        }
        // Block cancellation of delivered orders unless force override is provided
        if (order.status === "delivered" && !input.force) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot cancel a delivered order. Use force=true to override (settlement and financial records will be preserved).",
          });
        }
        await db.cancelOrder(input.orderId, ctx.user.id, input.reason);
        // Sync device status back to available if a device was assigned
        if (order.deviceId) {
          await syncDeviceStatus(order.deviceId, "cancelled");
        }
        await db.createOrderHistory({
          orderId: input.orderId,
          previousStatus: order.status,
          newStatus: "cancelled",
          changedByUserId: ctx.user.id,
          note: input.reason ? `Cancelled: ${input.reason}` : "Cancelled by admin",
        });
        return { success: true };
      }),

    archive: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        if (order.archivedAt) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Order is already archived" });
        }
        await db.archiveOrder(input.orderId, ctx.user.id);
        return { success: true };
      }),

    unarchive: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        if (!order.archivedAt) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Order is not archived" });
        }
        await db.unarchiveOrder(input.orderId);
        return { success: true };
      }),
  }),

  // ==================== TRACKING (PUBLIC) ====================
  tracking: router({
    getByToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const trackingToken = await db.getTrackingTokenByToken(input.token);
        if (!trackingToken) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Invalid tracking link" });
        }
        
        // Check if token is expired
        if (trackingToken.expiresAt && new Date() > trackingToken.expiresAt) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Tracking link has expired" });
        }
        
        const order = await db.getOrderById(trackingToken.orderId);
        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        
        // Get rider info if assigned
        let riderPhone: string | null = null;
        if (order.riderId) {
          const rider = await db.getRiderById(order.riderId);
          if (rider) {
            riderPhone = rider.phone;
          }
        }
        
        // Get live location from Traccar if tracking is active
        let liveLocation = null;
        if (trackingToken.isActive && order.status === "in_transit" && order.deviceId) {
          // Get the Traccar device ID from our internal device record
          const device = await db.getDeviceById(order.deviceId);
          if (device && device.traccarDeviceId) {
            liveLocation = await traccar.getPublicTrackingData(device.traccarDeviceId);
          }
        }
        
        return {
          trackingNumber: order.trackingNumber,
          status: order.status,
          isLiveTrackingActive: trackingToken.isActive && order.status === "in_transit",
          originCity: order.originCity,
          destinationCity: order.destinationCity,
          serviceType: order.serviceType,
          deliveryAddress: order.deliveryAddress,
          estimatedDeliveryAt: order.estimatedDeliveryAt,
          actualPickupAt: order.actualPickupAt,
          actualDeliveryAt: order.actualDeliveryAt,
          riderPhone: trackingToken.isActive ? riderPhone : null,
          // NEVER expose internal device IDs to customers
          liveLocation,
        };
      }),
    
    // Get live location update (for polling during active tracking)
    getLiveLocation: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const trackingToken = await db.getTrackingTokenByToken(input.token);
        if (!trackingToken || !trackingToken.isActive) {
          return { available: false, location: null };
        }
        
        // Check if token is expired
        if (trackingToken.expiresAt && new Date() > trackingToken.expiresAt) {
          return { available: false, location: null };
        }
        
        const order = await db.getOrderById(trackingToken.orderId);
        if (!order || order.status !== "in_transit" || !order.deviceId) {
          return { available: false, location: null };
        }
        
        // Get the Traccar device ID from our internal device record
        const device = await db.getDeviceById(order.deviceId);
        if (!device || !device.traccarDeviceId) {
          return { available: false, location: null };
        }
        
        const location = await traccar.getPublicTrackingData(device.traccarDeviceId);
        return {
          available: !!location,
          location,
        };
      }),
  }),
  
  // ==================== TRACCAR ADMIN (INTERNAL) ====================
  traccar: router({
    // Health check for Traccar connection
    health: dispatcherProcedure.query(async () => {
      return traccar.checkTraccarHealth();
    }),
    
    // Get all devices from Traccar (for device mapping)
    getDevices: adminProcedure.query(async () => {
      if (!traccar.isTraccarConfigured()) {
        return { configured: false, devices: [] };
      }
      const devices = await traccar.getDevices();
      return { configured: true, devices };
    }),
    
    // Get device position (for admin monitoring)
    getDevicePosition: dispatcherProcedure
      .input(z.object({ traccarDeviceId: z.number() }))
      .query(async ({ input }) => {
        return traccar.getDeviceWithPosition(input.traccarDeviceId);
      }),
  }),

  // ==================== DASHBOARD / REPORTS ====================
  dashboard: router({
    stats: dispatcherProcedure
      .input(z.object({
        fromDate: z.date().optional(),
        toDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getOrderStats(input?.fromDate, input?.toDate);
      }),
    
    recentOrders: dispatcherProcedure
      .input(z.object({ limit: z.number().min(1).max(20).default(10) }).optional())
      .query(async ({ input }) => {
        return db.getOrders({ limit: input?.limit || 10 });
      }),
  }),

  // ==================== WALLET ====================
  wallet: router({
    // Get current user's wallet
    get: protectedProcedure.query(async ({ ctx }) => {
      const wallet = await db.getOrCreateWallet(ctx.user.id);
      if (!wallet) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get wallet" });
      }
      return wallet;
    }),
    
    // Get wallet transactions
    transactions: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
      .query(async ({ ctx, input }) => {
        const wallet = await db.getWalletByUserId(ctx.user.id);
        if (!wallet) return [];
        return db.getWalletTransactions(wallet.id, input?.limit || 50);
      }),
    
    // Admin: Get all wallets
    getAllWallets: adminProcedure
      .input(z.object({
        page: z.number().default(1),
        pageSize: z.number().default(20),
      }).optional())
      .query(async ({ input }) => {
        const page = input?.page || 1;
        const pageSize = input?.pageSize || 20;
        return db.getAllWallets(page, pageSize);
      }),
    
    // Admin: Credit or debit user wallet
    adminAdjust: adminProcedure
      .input(z.object({
        userId: z.number(),
        amount: z.string(),
        type: z.enum(["credit", "debit"]),
        reason: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const wallet = await db.getOrCreateWallet(input.userId);
        if (!wallet) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User wallet not found" });
        }
        
        const amount = parseFloat(input.amount);
        if (isNaN(amount) || amount <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid amount" });
        }
        
        if (input.type === "credit") {
          const transaction = await db.creditWallet(
            wallet.id,
            amount,
            input.reason,
            "admin_adjustment",
            undefined,
            ctx.user.id
          );
          return { success: true, transaction };
        } else {
          const transaction = await db.debitWallet(
            wallet.id,
            amount,
            input.reason,
            "admin_adjustment",
            undefined,
            ctx.user.id
          );
          return { success: true, transaction };
        }
      }),
    
    // Admin: Credit user wallet (bonus, adjustment) - DEPRECATED, use adminAdjust
    adminCredit: adminProcedure
      .input(z.object({
        userId: z.number(),
        amount: z.number().positive(),
        description: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const wallet = await db.getOrCreateWallet(input.userId);
        if (!wallet) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User wallet not found" });
        }
        
        const transaction = await db.creditWallet(
          wallet.id,
          input.amount,
          input.description,
          "admin_adjustment",
          undefined,
          ctx.user.id
        );
        
        return { success: true, transaction };
      }),
  }),

  // ==================== PAYMENTS (PAYSTACK) ====================
  payments: router({
    // Get Paystack public key for frontend
    getPublicKey: publicProcedure.query(() => {
      return { publicKey: paystack.getPublicKey() };
    }),
    
    // Initialize wallet top-up payment
    initializeTopup: protectedProcedure
      .input(z.object({
        amount: z.number().min(100, "Minimum top-up is ₦100").max(1000000, "Maximum top-up is ₦1,000,000"),
        callbackUrl: z.string().url().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!paystack.isPaystackConfigured()) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Payment system not configured" });
        }
        
        const reference = paystack.generateReference("TOP");
        const amountInKobo = Math.round(input.amount * 100);
        
        // Get user email
        const email = ctx.user.email || `user${ctx.user.id}@apiamway.com`;
        
        // Create payment record
        await db.createPayment({
          userId: ctx.user.id,
          reference,
          amount: input.amount.toFixed(2),
          purpose: "wallet_topup",
          status: "pending",
        });
        
        // Initialize Paystack payment
        const response = await paystack.initializePayment({
          email,
          amount: amountInKobo,
          reference,
          metadata: {
            userId: ctx.user.id,
            purpose: "wallet_topup",
          },
          callbackUrl: input.callbackUrl,
        });
        
        return {
          reference,
          authorizationUrl: response.data.authorization_url,
          accessCode: response.data.access_code,
        };
      }),
    
    // Verify payment and credit wallet
    verify: protectedProcedure
      .input(z.object({ reference: z.string() }))
      .mutation(async ({ input, ctx }) => {
        // Get payment record
        const payment = await db.getPaymentByReference(input.reference);
        if (!payment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Payment not found" });
        }
        
        // Check ownership
        if (payment.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
        }
        
        // Already processed?
        if (payment.status === "success") {
          return { success: true, message: "Payment already processed" };
        }
        
        // Verify with Paystack
        const verification = await paystack.verifyPayment(input.reference);
        
        if (verification.data.status === "success") {
          // Update payment record
          await db.updatePayment(input.reference, {
            status: "success",
            paystackTransactionId: verification.data.id.toString(),
            channel: verification.data.channel,
          });
          
          // Credit wallet
          const wallet = await db.getOrCreateWallet(ctx.user.id);
          if (wallet) {
            await db.creditWallet(
              wallet.id,
              Number(payment.amount),
              `Wallet top-up via ${verification.data.channel}`,
              "payment",
              input.reference
            );
          }
          
          return { success: true, message: "Payment verified and wallet credited" };
        } else {
          // Update payment status
          await db.updatePayment(input.reference, {
            status: verification.data.status === "failed" ? "failed" : "abandoned",
          });
          
          throw new TRPCError({ code: "BAD_REQUEST", message: `Payment ${verification.data.status}` });
        }
      }),
    
    // Get user's payment history
    history: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
      .query(async ({ ctx, input }) => {
        return db.getUserPayments(ctx.user.id, input?.limit || 50);
      }),
    
    // Health check for payment system (Paystack)
    health: adminProcedure.query(async () => {
      return paystack.checkPaystackHealth();
    }),

    // ── OPay procedures ──────────────────────────────────────────────────────

    // Check if OPay is configured (safe for frontend)
    opayStatus: publicProcedure.query(() => {
      return {
        configured: opay.isOpayConfigured(),
        publicKey: opay.getOpayPublicKey(),
      };
    }),

    // Initialize OPay hosted checkout for wallet top-up
    initializeOpayTopup: protectedProcedure
      .input(z.object({
        amount: z.number().min(100, "Minimum top-up is ₦100").max(1000000, "Maximum top-up is ₦1,000,000"),
        callbackUrl: z.string().url(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!opay.isOpayConfigured()) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "OPay is not configured yet. Please use Paystack to top up your wallet.",
          });
        }

        const reference = opay.generateOpayReference("OPY");
        const amountInKobo = Math.round(input.amount * 100);
        const email = ctx.user.email || `user${ctx.user.id}@apiamway.com`;

        // Create payment record (provider = opay)
        await db.createPayment({
          userId: ctx.user.id,
          reference,
          amount: input.amount.toFixed(2),
          purpose: "wallet_topup",
          status: "pending",
          paymentProvider: "opay",
        });

        const response = await opay.initializeOpayPayment({
          reference,
          amount: amountInKobo,
          email,
          callbackUrl: input.callbackUrl,
          metadata: { userId: ctx.user.id, purpose: "wallet_topup" },
        });

        if (response.code !== "00000" || !response.data?.cashierUrl) {
          // Clean up the pending payment record on failure
          await db.updatePayment(reference, { status: "failed" });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: response.message || "Failed to initialize OPay payment",
          });
        }

        return {
          reference,
          cashierUrl: response.data.cashierUrl,
          provider: "opay" as const,
        };
      }),

    // Verify OPay payment and credit wallet (idempotent)
    verifyOpay: protectedProcedure
      .input(z.object({ reference: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const payment = await db.getPaymentByReference(input.reference);
        if (!payment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Payment not found" });
        }
        if (payment.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
        }
        // Idempotency guard
        if (payment.status === "success") {
          return { success: true, message: "Payment already processed" };
        }

        const verification = await opay.verifyOpayPayment(input.reference);

        if (verification.data?.status === "SUCCESS") {
          await db.updatePayment(input.reference, {
            status: "success",
            channel: verification.data.payChannel || "opay",
          });

          const wallet = await db.getOrCreateWallet(ctx.user.id);
          if (wallet) {
            await db.creditWallet(
              wallet.id,
              Number(payment.amount),
              `Wallet top-up via OPay (${verification.data.payChannel || "transfer"})`,
              "payment",
              input.reference
            );
          }

          return { success: true, message: "OPay payment verified and wallet credited" };
        } else {
          const opayStatus = verification.data?.status;
          await db.updatePayment(input.reference, {
            status: opayStatus === "FAIL" || opayStatus === "CLOSE" ? "failed" : "abandoned",
          });
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `OPay payment ${opayStatus?.toLowerCase() || "not successful"}`,
          });
        }
      }),

    // Health check for OPay (admin only)
    opayHealth: adminProcedure.query(async () => {
      return opay.checkOpayHealth();
    }),
  }),

  // ==================== REFERRALS ====================
  referrals: router({
    // Get current user's referral code
    getMyCode: protectedProcedure.query(async ({ ctx }) => {
      const code = await db.getOrCreateReferralCode(ctx.user.id);
      if (!code) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get referral code" });
      }
      return code;
    }),
    
    // Get user's referral stats
    getMyStats: protectedProcedure.query(async ({ ctx }) => {
      const referrals = await db.getUserReferrals(ctx.user.id);
      
      const total = referrals.length;
      const pending = referrals.filter(r => r.status === "pending").length;
      const qualified = referrals.filter(r => r.status === "qualified" || r.status === "rewarded").length;
      const rewarded = referrals.filter(r => r.status === "rewarded").length;
      const totalEarned = referrals
        .filter(r => r.status === "rewarded")
        .reduce((sum, r) => sum + Number(r.referrerRewardAmount || 0), 0);
      
      return {
        total,
        pending,
        qualified,
        rewarded,
        totalEarned,
        referrals,
      };
    }),
    
    // Apply referral code (for new users)
    applyCode: protectedProcedure
      .input(z.object({
        code: z.string().min(1),
        deviceFingerprint: z.string().optional(),
        ipAddress: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check if user already has a referral
        const existingReferral = await db.getReferralByReferredUserId(ctx.user.id);
        if (existingReferral) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You have already used a referral code" });
        }
        
        // Find the referral code
        const referralCode = await db.getReferralCodeByCode(input.code);
        if (!referralCode || !referralCode.isActive) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or inactive referral code" });
        }
        
        // Can't refer yourself
        if (referralCode.userId === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot use your own referral code" });
        }
        
        // Check for duplicate referrals (anti-abuse)
        const isDuplicate = await db.checkDuplicateReferral(input.deviceFingerprint, input.ipAddress);
        if (isDuplicate) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Suspicious activity detected" });
        }
        
        // Create the referral
        const referral = await db.createReferral({
          referrerUserId: referralCode.userId,
          referredUserId: ctx.user.id,
          referralCodeId: referralCode.id,
          status: "pending",
          deviceFingerprint: input.deviceFingerprint,
          ipAddress: input.ipAddress,
        });
        
        return { success: true, referral };
      }),
    
    // Admin: Revoke a referral
    adminRevoke: adminProcedure
      .input(z.object({
        referralId: z.number(),
        reason: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.revokeReferral(input.referralId, ctx.user.id, input.reason);
        return { success: true };
      }),
  }),

  // ==================== PARTNER MANAGEMENT ====================
  partners: router({
    // Admin: Get all partners
    getAll: adminProcedure
      .input(z.object({
        status: z.enum(["pending", "approved", "suspended", "rejected"]).optional(),
        page: z.number().default(1),
        pageSize: z.number().default(20),
      }).optional())
      .query(async ({ input }) => {
        const page = input?.page || 1;
        const pageSize = input?.pageSize || 20;
        const result = await db.getAllPartnerCompanies(input?.status, page, pageSize);
        
        // Add fleet size for each partner
        const partnersWithFleet = await Promise.all(
          result.items.map(async (partner) => {
            const fleet = await db.getPartnerFleet(partner.id);
            return {
              ...partner,
              fleetSize: fleet.riders.length + fleet.devices.length,
            };
          })
        );
        
        return {
          items: partnersWithFleet,
          totalCount: result.totalCount,
          totalPages: result.totalPages,
        };
      }),
    
    // Admin: Get partner by ID
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const partner = await db.getPartnerCompanyById(input.id);
        if (!partner) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Partner not found" });
        }
        return partner;
      }),
    
    // Admin: Create partner
    create: adminProcedure
      .input(z.object({
        name: z.string().min(2),
        contactName: z.string().min(2),
        contactPhone: z.string().min(10),
        contactEmail: z.string().email().optional(),
        commissionType: z.enum(["percentage", "flat"]).default("percentage"),
        commissionValue: z.number().min(0),
      }))
      .mutation(async ({ input }) => {
        const { commissionType, commissionValue, ...rest } = input;
        
        // Validate commission value based on type
        if (commissionType === "percentage" && commissionValue > 100) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "Commission percentage cannot exceed 100%" 
          });
        }
        
        const partner = await db.createPartnerCompany({
          ...rest,
          commissionType,
          commissionValue: commissionValue.toString(),
          status: "pending",
        });
        return partner;
      }),
    
    // Admin: Approve partner
    approve: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.approvePartnerCompany(input.id, ctx.user.id);
        return { success: true };
      }),
    
    // Admin: Reject partner
    reject: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.rejectPartnerCompany(input.id);
        return { success: true };
      }),
    
    // Admin: Update partner
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(2).optional(),
        contactName: z.string().min(2).optional(),
        contactPhone: z.string().min(10).optional(),
        contactEmail: z.string().email().optional(),
        commissionPercentage: z.number().min(0).max(100).optional(),
        status: z.enum(["pending", "approved", "suspended", "rejected"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, commissionPercentage, ...data } = input;
        const updateData: any = { ...data };
        if (commissionPercentage !== undefined) {
          updateData.commissionPercentage = commissionPercentage.toString();
        }
        await db.updatePartnerCompany(id, updateData);
        return { success: true };
      }),
    
    // Admin: Get partner fleet (bikes, riders, devices)
    getFleet: adminProcedure
      .input(z.object({ partnerCompanyId: z.number() }))
      .query(async ({ input }) => {
        return db.getPartnerFleet(input.partnerCompanyId);
      }),
    
    // Admin: Get partner orders
    getOrders: adminProcedure
      .input(z.object({ 
        partnerCompanyId: z.number(),
        limit: z.number().default(50),
      }))
      .query(async ({ input }) => {
        return db.getPartnerOrders(input.partnerCompanyId, input.limit);
      }),
    
    // Admin: Get partner earnings
    getEarnings: adminProcedure
      .input(z.object({ 
        partnerCompanyId: z.number(),
        limit: z.number().default(50),
      }))
      .query(async ({ input }) => {
        return db.getPartnerEarnings(input.partnerCompanyId, input.limit);
      }),
    
    // Admin: Get partner earnings summary
    getEarningsSummary: adminProcedure
      .input(z.object({ partnerCompanyId: z.number() }))
      .query(async ({ input }) => {
        return db.getPartnerEarningsSummary(input.partnerCompanyId);
      }),
    
    // Admin: Assign rider to partner
    assignRider: adminProcedure
      .input(z.object({ 
        riderId: z.number(),
        partnerCompanyId: z.number(),
      }))
      .mutation(async ({ input }) => {
        // Verify partner exists and is approved
        const partner = await db.getPartnerCompanyById(input.partnerCompanyId);
        if (!partner) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Partner not found" });
        }
        if (partner.status !== "approved") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Partner must be approved before assignment" });
        }
        
        await db.assignRiderToPartner(input.riderId, input.partnerCompanyId);
        return { success: true };
      }),
    
    // Admin: Unassign rider from partner
    unassignRider: adminProcedure
      .input(z.object({ riderId: z.number() }))
      .mutation(async ({ input }) => {
        await db.unassignRiderFromPartner(input.riderId);
        return { success: true };
      }),
    
    // Admin: Assign device to partner
    assignDevice: adminProcedure
      .input(z.object({ 
        deviceId: z.number(),
        partnerCompanyId: z.number(),
      }))
      .mutation(async ({ input }) => {
        // Verify partner exists and is approved
        const partner = await db.getPartnerCompanyById(input.partnerCompanyId);
        if (!partner) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Partner not found" });
        }
        if (partner.status !== "approved") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Partner must be approved before assignment" });
        }
        
        await db.assignDeviceToPartner(input.deviceId, input.partnerCompanyId);
        return { success: true };
      }),
    
    // Admin: Unassign device from partner
    unassignDevice: adminProcedure
      .input(z.object({ deviceId: z.number() }))
      .mutation(async ({ input }) => {
        await db.unassignDeviceFromPartner(input.deviceId);
        return { success: true };
      }),
    
    // Admin: Manual settlement trigger (DEBUG ONLY)
    triggerSettlement: adminProcedure
      .input(z.object({ 
        orderId: z.number().optional(),
        trackingNumber: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        let resolvedOrderId: number;

        if (!database) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database not available'
          });
        }

        // Resolve order ID from tracking number if provided
        if (input.trackingNumber) {
          console.log(`[Settlement DEBUG] Manual trigger called with tracking number: ${input.trackingNumber}`);
          const orderResult = await database.select().from(orders).where(eq(orders.trackingNumber, input.trackingNumber)).limit(1);

          if (orderResult.length === 0) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `Order not found for tracking number: ${input.trackingNumber}`
            });
          }

          resolvedOrderId = orderResult[0].id;
          console.log(`[Settlement DEBUG] Resolved tracking number ${input.trackingNumber} to order ID ${resolvedOrderId}`);
        } else if (input.orderId) {
          resolvedOrderId = input.orderId;
          console.log(`[Settlement DEBUG] Manual trigger called for order ID ${resolvedOrderId}`);
        } else {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Either orderId or trackingNumber must be provided'
          });
        }

        // Verify order exists and is delivered
        const orderResult = await database.select().from(orders).where(eq(orders.id, resolvedOrderId)).limit(1);

        if (orderResult.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Order not found with ID: ${resolvedOrderId}`
          });
        }

        const order = orderResult[0];

        if (order.status !== 'delivered') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Order must be DELIVERED (current status: ${order.status})`
          });
        }

        // Check if already settled
        const existingSettlementResult = await database.select().from(partnerEarnings).where(eq(partnerEarnings.orderId, resolvedOrderId)).limit(1);

        if (existingSettlementResult.length > 0) {
          return {
            success: false,
            orderId: resolvedOrderId,
            message: 'Order already settled',
            existingSettlement: existingSettlementResult[0]
          };
        }

        // Trigger settlement
        const result = await onOrderDelivered(resolvedOrderId);
        return { 
          success: true, 
          orderId: resolvedOrderId,
          message: "Settlement triggered successfully. Check server logs for details.",
          result
        };
      }),
    
    // Admin: Process weekly payouts (runs every Friday, or manually)
    processWeeklyPayouts: adminProcedure
      .mutation(async () => {
        console.log(`[Weekly Payout] Manual trigger called`);
        const result = await processWeeklyPayouts();
        return result;
      }),
    
    // Admin: Get payout history for a Fleet Owner
    getPayoutHistory: adminProcedure
      .input(z.object({ partnerCompanyId: z.number() }))
      .query(async ({ input }) => {
        return await getFleetOwnerPayoutHistory(input.partnerCompanyId);
      }),
    
    // Admin: Get pending earnings for a Fleet Owner
    getPendingEarnings: adminProcedure
      .input(z.object({ partnerCompanyId: z.number() }))
      .query(async ({ input }) => {
        return await getFleetOwnerPendingEarnings(input.partnerCompanyId);
      }),

    // Admin: List all pending earnings linked to cancelled orders (read-only review panel)
    listCancelledEarnings: adminProcedure
      .input(z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        includeVoided: z.boolean().default(false),
      }))
      .query(async ({ input }) => {
        return await listCancelledOrderEarnings(input.page, input.pageSize, input.includeVoided);
      }),

    // Admin: Export ALL cancelled-order earnings as a flat array for CSV download
    exportCancelledEarnings: adminProcedure
      .input(z.object({
        includeVoided: z.boolean().default(false),
      }))
      .query(async ({ input }) => {
        return await exportCancelledOrderEarnings(input.includeVoided);
      }),

    voidEarning: adminProcedure
      .input(z.object({
        earningId: z.number().int().positive(),
        reason: z.string().min(1, "Void reason is required").max(500),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await voidEarning(
          input.earningId,
          ctx.user.id,
          input.reason
        );
        if (!result.success) {
          const messages: Record<string, string> = {
            not_found: "Earning record not found",
            not_pending: "Only pending earnings can be voided",
            order_not_cancelled: "Earning can only be voided if the linked order is cancelled",
          };
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: messages[result.error] ?? "Cannot void earning",
          });
        }
        return { success: true };
      }),

    bulkVoidEarnings: adminProcedure
      .input(z.object({
        earningIds: z.array(z.number().int().positive()).min(1, "Select at least one earning").max(200, "Cannot void more than 200 earnings at once"),
        reason: z.string().min(1, "Void reason is required").max(500),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await bulkVoidEarnings(
          input.earningIds,
          ctx.user.id,
          input.reason
        );
        return result;
      }),

    voidReasonCounts: adminProcedure
      .query(async () => {
        return getVoidReasonCounts();
      }),

    listWarnings: adminProcedure
      .input(z.object({
        page: z.number().int().positive().default(1),
        pageSize: z.number().int().positive().max(100).default(20),
      }))
      .query(async ({ input }) => {
        return listSettlementWarnings(input.page, input.pageSize);
      }),
  }),
  
  // ==================== RIDER PORTAL ====================
  riderPortal: router({
    // Get current rider's profile and active order
    getMyInfo: protectedProcedure.query(async ({ ctx }) => {
      const rider = await db.getRiderByUserId(ctx.user.id);
      if (!rider) {
        throw new TRPCError({ code: "NOT_FOUND", message: "You are not registered as a rider" });
      }
      return rider;
    }),
    
    // Get rider's active assigned order
    getActiveOrder: protectedProcedure.query(async ({ ctx }) => {
      const rider = await db.getRiderByUserId(ctx.user.id);
      if (!rider) {
        throw new TRPCError({ code: "NOT_FOUND", message: "You are not registered as a rider" });
      }
      
      // Get active order assigned to this rider
      const activeOrder = await db.getRiderActiveOrder(rider.id);
      return activeOrder;
    }),
    
    // Confirm pickup
    confirmPickup: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const rider = await db.getRiderByUserId(ctx.user.id);
        if (!rider) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized as rider" });
        }
        
        // Verify order is assigned to this rider
        const order = await db.getOrderById(input.orderId);
        if (!order || order.riderId !== rider.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Order not assigned to you" });
        }
        
        // Update order status to picked_up
        await db.updateOrder(input.orderId, { status: "picked_up" });
        
        // Sync device status (triggers bike status update to in_transit)
        await syncDeviceStatus(order.deviceId, "picked_up");
        
        return { success: true };
      }),
    
    // Confirm delivery
    confirmDelivery: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const rider = await db.getRiderByUserId(ctx.user.id);
        if (!rider) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized as rider" });
        }
        
        // Verify order is assigned to this rider
        const order = await db.getOrderById(input.orderId);
        if (!order || order.riderId !== rider.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Order not assigned to you" });
        }
        
        // Update order status to delivered
        await db.updateOrder(input.orderId, { status: "delivered" });
        
        // Sync device status (triggers bike status update to available)
        await syncDeviceStatus(order.deviceId, "delivered");
        
        // Run settlement (existing hook)
        await onOrderDelivered(input.orderId);
        
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
