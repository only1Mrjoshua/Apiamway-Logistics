import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "dispatcher", "support"]).default("user").notNull(),
  /** Account type intent: shipper (default) or fleet_owner */
  accountTypeIntent: mysqlEnum("accountTypeIntent", ["shipper", "fleet_owner"]).default("shipper"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Riders table - stores information about delivery riders
 */
export const riders = mysqlTable("riders", {
  id: int("id").autoincrement().primaryKey(),
  /** Link to user account for rider portal access (nullable for legacy riders) */
  userId: int("userId"),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  status: mysqlEnum("status", ["active", "inactive", "on_leave"]).default("active").notNull(),
  currentDeviceId: int("currentDeviceId"),
  assignedHub: varchar("assignedHub", { length: 100 }).default("Enugu-Main"),
  // Partner Fleet fields
  fleetType: mysqlEnum("fleetType", ["apiamway_owned", "partner_fleet"]).default("apiamway_owned").notNull(),
  partnerCompanyId: int("partnerCompanyId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Rider = typeof riders.$inferSelect;
export type InsertRider = typeof riders.$inferInsert;

/**
 * Devices table - stores GPS tracker/device information
 */
export const devices = mysqlTable("devices", {
  id: int("id").autoincrement().primaryKey(),
  traccarDeviceId: int("traccarDeviceId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  /** Human-readable bike/vehicle label (e.g., PTNR-02, BIKE-001) */
  label: varchar("label", { length: 50 }),
  /** Device/bike operational status */
  status: mysqlEnum("status", ["available", "in_transit", "maintenance", "inactive"]).default("available").notNull(),
  /** Maintenance reason (only set when status is maintenance) */
  maintenanceReason: text("maintenanceReason"),
  /** Estimated maintenance completion date */
  maintenanceUntil: timestamp("maintenanceUntil"),
  // Partner Fleet fields
  fleetType: mysqlEnum("fleetType", ["apiamway_owned", "partner_fleet"]).default("apiamway_owned").notNull(),
  partnerCompanyId: int("partnerCompanyId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Device = typeof devices.$inferSelect;
export type InsertDevice = typeof devices.$inferInsert;

/**
 * Device Maintenance Events table - audit log for all maintenance actions
 */
export const deviceMaintenanceEvents = mysqlTable("deviceMaintenanceEvents", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId").notNull(),
  /** Action type: setting to maintenance or marking as available */
  actionType: mysqlEnum("actionType", ["set_maintenance", "mark_available"]).notNull(),
  /** Maintenance reason (only for set_maintenance action) */
  reason: text("reason"),
  /** Estimated maintenance completion date (only for set_maintenance action) */
  maintenanceUntil: timestamp("maintenanceUntil"),
  /** Admin user who performed the action */
  performedByUserId: int("performedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DeviceMaintenanceEvent = typeof deviceMaintenanceEvents.$inferSelect;
export type InsertDeviceMaintenanceEvent = typeof deviceMaintenanceEvents.$inferInsert;

/**
 * Orders table - stores delivery orders
 */
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  trackingNumber: varchar("trackingNumber", { length: 20 }).notNull().unique(),
  
  // Customer Information
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 20 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }),
  
  // Pickup Details
  pickupAddress: text("pickupAddress").notNull(),
  pickupLat: decimal("pickupLat", { precision: 10, scale: 7 }),
  pickupLng: decimal("pickupLng", { precision: 10, scale: 7 }),
  pickupZone: varchar("pickupZone", { length: 50 }),
  pickupContactName: varchar("pickupContactName", { length: 255 }),
  pickupContactPhone: varchar("pickupContactPhone", { length: 20 }),
  
  // Delivery Details
  deliveryAddress: text("deliveryAddress").notNull(),
  deliveryLat: decimal("deliveryLat", { precision: 10, scale: 7 }),
  deliveryLng: decimal("deliveryLng", { precision: 10, scale: 7 }),
  deliveryZone: varchar("deliveryZone", { length: 50 }),
  deliveryContactName: varchar("deliveryContactName", { length: 255 }),
  deliveryContactPhone: varchar("deliveryContactPhone", { length: 20 }),
  
  // Service & Pricing
  serviceType: mysqlEnum("serviceType", ["intra-city", "inter-city-air", "inter-city-ground"]).default("intra-city").notNull(),
  originCity: varchar("originCity", { length: 100 }).default("Enugu"),
  destinationCity: varchar("destinationCity", { length: 100 }).default("Enugu"),
  weightKg: decimal("weightKg", { precision: 10, scale: 2 }),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid", "refunded"]).default("pending").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  
  // Package Details
  packageDescription: text("packageDescription"),
  declaredValue: decimal("declaredValue", { precision: 10, scale: 2 }),
  
  // Status & Assignment
  status: mysqlEnum("status", ["pending", "assigned", "picked_up", "in_transit", "delivered", "failed", "returned", "cancelled"]).default("pending").notNull(),
  riderId: int("riderId"),
  deviceId: int("deviceId"),
  partnerCompanyId: int("partnerCompanyId"),
  
  // Settlement status for partner commission
  settlementStatus: mysqlEnum("settlementStatus", ["pending", "settled", "failed"]).default("pending").notNull(),
  
  // Proof of Delivery
  proofOfDeliveryUrl: text("proofOfDeliveryUrl"),
  deliveryNote: text("deliveryNote"),
  
  // Cancellation fields
  cancellationReason: text("cancellationReason"),
  cancelledAt: timestamp("cancelledAt"),
  cancelledBy: int("cancelledBy"),

  // Archive fields
  archivedAt: timestamp("archivedAt"),
  archivedBy: int("archivedBy"),

  // Timestamps
  scheduledPickupAt: timestamp("scheduledPickupAt"),
  actualPickupAt: timestamp("actualPickupAt"),
  estimatedDeliveryAt: timestamp("estimatedDeliveryAt"),
  actualDeliveryAt: timestamp("actualDeliveryAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * Tracking Tokens table - stores secure tokens for public tracking links
 */
export const trackingTokens = mysqlTable("trackingTokens", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  isActive: boolean("isActive").default(false).notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TrackingToken = typeof trackingTokens.$inferSelect;
export type InsertTrackingToken = typeof trackingTokens.$inferInsert;

/**
 * Order History table - audit trail for order status changes
 */
export const orderHistory = mysqlTable("orderHistory", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  previousStatus: varchar("previousStatus", { length: 50 }),
  newStatus: varchar("newStatus", { length: 50 }).notNull(),
  changedByUserId: int("changedByUserId"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderHistory = typeof orderHistory.$inferSelect;
export type InsertOrderHistory = typeof orderHistory.$inferInsert;


/**
 * Wallets table - stores customer wallet balances
 * Each customer has exactly one wallet
 */
export const wallets = mysqlTable("wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  balance: decimal("balance", { precision: 12, scale: 2 }).default("0.00").notNull(),
  currency: varchar("currency", { length: 3 }).default("NGN").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = typeof wallets.$inferInsert;

/**
 * Wallet Transactions table - full audit trail of all wallet movements
 */
export const walletTransactions = mysqlTable("walletTransactions", {
  id: int("id").autoincrement().primaryKey(),
  walletId: int("walletId").notNull(),
  type: mysqlEnum("type", ["credit", "debit", "refund", "bonus", "adjustment"]).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  balanceBefore: decimal("balanceBefore", { precision: 12, scale: 2 }).notNull(),
  balanceAfter: decimal("balanceAfter", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  // Reference to related entity (order, payment, referral, etc.)
  referenceType: varchar("referenceType", { length: 50 }),
  referenceId: varchar("referenceId", { length: 100 }),
  // For admin adjustments
  adjustedByUserId: int("adjustedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = typeof walletTransactions.$inferInsert;

/**
 * Payments table - stores payment records (Paystack and OPay)
 */
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Paystack reference (unique per transaction)
  reference: varchar("reference", { length: 100 }).notNull().unique(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("NGN").notNull(),
  status: mysqlEnum("status", ["pending", "success", "failed", "abandoned"]).default("pending").notNull(),
  // Paystack response data
  paystackTransactionId: varchar("paystackTransactionId", { length: 100 }),
  paystackAuthorizationCode: varchar("paystackAuthorizationCode", { length: 100 }),
  channel: varchar("channel", { length: 50 }),
  // Payment provider used for this transaction
  paymentProvider: mysqlEnum("paymentProvider", ["paystack", "opay"]).default("paystack").notNull(),
  // Purpose of payment
  purpose: mysqlEnum("purpose", ["wallet_topup", "order_payment"]).default("wallet_topup").notNull(),
  orderId: int("orderId"),
  // Webhook verification
  webhookVerified: boolean("webhookVerified").default(false).notNull(),
  webhookReceivedAt: timestamp("webhookReceivedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

/**
 * Referral Codes table - unique referral codes per user
 */
export const referralCodes = mysqlTable("referralCodes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReferralCode = typeof referralCodes.$inferSelect;
export type InsertReferralCode = typeof referralCodes.$inferInsert;

/**
 * Referrals table - tracks referral relationships and rewards
 */
export const referrals = mysqlTable("referrals", {
  id: int("id").autoincrement().primaryKey(),
  // The user who referred (owns the referral code)
  referrerUserId: int("referrerUserId").notNull(),
  // The user who was referred (used the code)
  referredUserId: int("referredUserId").notNull().unique(),
  referralCodeId: int("referralCodeId").notNull(),
  // Status of the referral
  status: mysqlEnum("status", ["pending", "qualified", "rewarded", "revoked"]).default("pending").notNull(),
  // First paid delivery by referred user
  qualifyingOrderId: int("qualifyingOrderId"),
  qualifiedAt: timestamp("qualifiedAt"),
  // Reward details
  referrerRewardAmount: decimal("referrerRewardAmount", { precision: 10, scale: 2 }),
  referredRewardAmount: decimal("referredRewardAmount", { precision: 10, scale: 2 }),
  rewardedAt: timestamp("rewardedAt"),
  // Anti-abuse tracking
  deviceFingerprint: varchar("deviceFingerprint", { length: 255 }),
  ipAddress: varchar("ipAddress", { length: 45 }),
  // Admin actions
  revokedByUserId: int("revokedByUserId"),
  revokedAt: timestamp("revokedAt"),
  revokeReason: text("revokeReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

/**
 * Partner Companies table - companies/individuals who provide bikes, riders, and devices
 * Apiamway controls operations, pricing, and dispatch
 */
export const partnerCompanies = mysqlTable("partnerCompanies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }).notNull(),
  contactPhone: varchar("contactPhone", { length: 20 }).notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }),
  // Commission configuration
  commissionType: mysqlEnum("commissionType", ["percentage", "flat"]).default("percentage").notNull(),
  commissionValue: decimal("commissionValue", { precision: 10, scale: 2 }).default("70.00").notNull(),
  // Legacy field (deprecated, use commissionValue instead)
  commissionPercentage: decimal("commissionPercentage", { precision: 5, scale: 2 }).default("70.00").notNull(),
  // Partner wallet balance
  balance: decimal("balance", { precision: 12, scale: 2 }).default("0.00").notNull(),
  // Approval status
  status: mysqlEnum("status", ["pending", "approved", "suspended", "rejected"]).default("pending").notNull(),
  approvedByUserId: int("approvedByUserId"),
  approvedAt: timestamp("approvedAt"),
  // Authentication for partner portal
  userId: int("userId"), // Links to users table for login
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PartnerCompany = typeof partnerCompanies.$inferSelect;
export type InsertPartnerCompany = typeof partnerCompanies.$inferInsert;

/**
 * Fleet Owner Notifications table - tracks email notifications sent to prevent duplicates
 */
export const fleetOwnerNotifications = mysqlTable("fleetOwnerNotifications", {
  id: int("id").autoincrement().primaryKey(),
  partnerCompanyId: int("partnerCompanyId").notNull(),
  notificationType: mysqlEnum("notificationType", ["submitted", "approved", "rejected"]).notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  email: varchar("email", { length: 255 }).notNull(),
});

export type FleetOwnerNotification = typeof fleetOwnerNotifications.$inferSelect;
export type InsertFleetOwnerNotification = typeof fleetOwnerNotifications.$inferInsert;

/**
 * Partner Earnings table - tracks earnings per completed order
 */
export const partnerEarnings = mysqlTable("partnerEarnings", {
  id: int("id").autoincrement().primaryKey(),
  partnerCompanyId: int("partnerCompanyId").notNull(),
  orderId: int("orderId").notNull().unique(), // Unique constraint for idempotency
  orderPrice: decimal("orderPrice", { precision: 12, scale: 2 }).notNull(),
  commissionPercentage: decimal("commissionPercentage", { precision: 5, scale: 2 }).notNull(),
  partnerAmount: decimal("partnerAmount", { precision: 12, scale: 2 }).notNull(),
  apiamwayAmount: decimal("apiamwayAmount", { precision: 12, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "credited", "paid_out", "voided"]).default("pending").notNull(),
  creditedAt: timestamp("creditedAt"),
  paidOutAt: timestamp("paidOutAt"),
  // Void fields (set when admin voids a cancelled-order earning)
  voidedAt: timestamp("voidedAt"),
  voidedBy: int("voidedBy"),
  voidReason: text("voidReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PartnerEarning = typeof partnerEarnings.$inferSelect;
export type InsertPartnerEarning = typeof partnerEarnings.$inferInsert;
