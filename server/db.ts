import { eq, desc, and, gte, lte, sql, or, inArray, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  InsertRider, riders, Rider,
  InsertDevice, devices, Device,
  InsertOrder, orders, Order,
  InsertTrackingToken, trackingTokens, TrackingToken,
  InsertOrderHistory, orderHistory,
  InsertPartnerCompany, partnerCompanies, PartnerCompany,
  InsertPartnerEarning, partnerEarnings, PartnerEarning,
  InsertDeviceMaintenanceEvent, deviceMaintenanceEvents, DeviceMaintenanceEvent
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { nanoid } from 'nanoid';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ==================== RIDER QUERIES ====================

export async function createRider(rider: InsertRider): Promise<Rider | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.insert(riders).values(rider);
  const result = await db.select().from(riders).where(eq(riders.phone, rider.phone)).limit(1);
  return result[0] || null;
}

export async function getRiders(filters?: {
  status?: "active" | "inactive" | "on_leave";
  searchQuery?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: Rider[]; totalCount: number }> {
  const db = await getDb();
  if (!db) return { items: [], totalCount: 0 };
  
  // Build where conditions
  const conditions = [];
  if (filters?.status) {
    conditions.push(eq(riders.status, filters.status));
  }
  if (filters?.searchQuery) {
    const searchTerm = `%${filters.searchQuery}%`;
    conditions.push(
      sql`(
        ${riders.name} LIKE ${searchTerm} OR
        ${riders.phone} LIKE ${searchTerm} OR
        CAST(${riders.id} AS CHAR) LIKE ${searchTerm}
      )`
    );
  }
  
  // Get total count
  let countQuery = db.select({ count: sql<number>`count(*)` }).from(riders);
  if (conditions.length > 0) {
    countQuery = countQuery.where(sql`${sql.join(conditions, sql` AND `)}`) as any;
  }
  const [{ count: totalCount }] = await countQuery;
  
  // Get paginated items
  let query = db.select().from(riders);
  if (conditions.length > 0) {
    query = query.where(sql`${sql.join(conditions, sql` AND `)}`) as any;
  }
  
  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
  }
  if (filters?.offset) {
    query = query.offset(filters.offset) as any;
  }
  
  const items = await query;
  return { items, totalCount };
}

export async function getRiderById(id: number): Promise<Rider | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(riders).where(eq(riders.id, id)).limit(1);
  return result[0] || null;
}

export async function getRiderByUserId(userId: number): Promise<Rider | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(riders).where(eq(riders.userId, userId)).limit(1);
  return result[0] || null;
}

export async function getRiderActiveOrder(riderId: number): Promise<Order | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Get active order assigned to this rider (assigned, picked_up, or in_transit)
  const result = await db.select()
    .from(orders)
    .where(
      and(
        eq(orders.riderId, riderId),
        or(
          eq(orders.status, "assigned"),
          eq(orders.status, "picked_up"),
          eq(orders.status, "in_transit")
        )
      )
    )
    .limit(1);
  
  return result[0] || null;
}

export async function updateRider(id: number, data: Partial<InsertRider>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(riders).set(data).where(eq(riders.id, id));
}

// ==================== DEVICE QUERIES ====================

export async function createDevice(device: InsertDevice): Promise<Device | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.insert(devices).values(device);
  const result = await db.select().from(devices).where(eq(devices.traccarDeviceId, device.traccarDeviceId)).limit(1);
  return result[0] || null;
}

export async function getDevices(filters?: {
  status?: "available" | "in_transit" | "maintenance" | "inactive";
  searchQuery?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: (Device & { partnerCompany?: PartnerCompany | null })[]; totalCount: number }> {
  const db = await getDb();
  if (!db) return { items: [], totalCount: 0 };
  
  // Build where conditions
  const conditions = [];
  if (filters?.status) {
    conditions.push(eq(devices.status, filters.status));
  }
  if (filters?.searchQuery) {
    const searchTerm = `%${filters.searchQuery}%`;
    conditions.push(
      sql`(
        ${devices.label} LIKE ${searchTerm} OR
        ${devices.traccarDeviceId} LIKE ${searchTerm} OR
        ${devices.status} LIKE ${searchTerm} OR
        ${partnerCompanies.name} LIKE ${searchTerm}
      )`
    );
  }
  
  // Get total count
  let countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(devices)
    .leftJoin(partnerCompanies, eq(devices.partnerCompanyId, partnerCompanies.id));
  if (conditions.length > 0) {
    countQuery = countQuery.where(sql`${sql.join(conditions, sql` AND `)}`) as any;
  }
  const [{ count: totalCount }] = await countQuery;
  
  // Get paginated items
  let query = db
    .select({
      id: devices.id,
      traccarDeviceId: devices.traccarDeviceId,
      name: devices.name,
      label: devices.label,
      status: devices.status,
      maintenanceReason: devices.maintenanceReason,
      maintenanceUntil: devices.maintenanceUntil,
      fleetType: devices.fleetType,
      partnerCompanyId: devices.partnerCompanyId,
      createdAt: devices.createdAt,
      updatedAt: devices.updatedAt,
      partnerCompany: partnerCompanies,
    })
    .from(devices)
    .leftJoin(partnerCompanies, eq(devices.partnerCompanyId, partnerCompanies.id));
  
  if (conditions.length > 0) {
    query = query.where(sql`${sql.join(conditions, sql` AND `)}`) as any;
  }
  
  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
  }
  if (filters?.offset) {
    query = query.offset(filters.offset) as any;
  }
  
  const items = await query;
  return { items, totalCount };
}

export async function getDeviceById(id: number): Promise<Device | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
  return result[0] || null;
}

export async function updateDevice(id: number, data: Partial<InsertDevice>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(devices).set(data).where(eq(devices.id, id));
}

// ==================== ORDER QUERIES ====================

function generateTrackingNumber(): string {
  const prefix = "AP";
  const city = "EN"; // Enugu
  // Use 6-digit random to give ~900,000 possible values and avoid collisions
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${city}-${random}`;
}

export async function createOrder(order: Omit<InsertOrder, "trackingNumber">): Promise<Order | null> {
  const db = await getDb();
  if (!db) return null;

  // Retry up to 5 times on duplicate tracking number collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const trackingNumber = generateTrackingNumber();
    try {
      await db.insert(orders).values({ ...order, trackingNumber });
      const result = await db.select().from(orders).where(eq(orders.trackingNumber, trackingNumber)).limit(1);
      return result[0] || null;
    } catch (err: any) {
      if (err?.cause?.code === "ER_DUP_ENTRY" || err?.code === "ER_DUP_ENTRY") {
        console.warn(`[createOrder] Tracking number collision on ${trackingNumber}, retrying (attempt ${attempt + 1})...`);
        continue;
      }
      throw err;
    }
  }

  console.error("[createOrder] Failed to generate a unique tracking number after 5 attempts");
  return null;
}

export async function getOrders(filters?: {
  status?: string;
  riderId?: number;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
}): Promise<{ items: Order[]; totalCount: number }> {
  const db = await getDb();
  if (!db) return { items: [], totalCount: 0 };
  
  const conditions = [];
  
  if (filters?.status) {
    conditions.push(eq(orders.status, filters.status as any));
  }
  if (filters?.riderId) {
    conditions.push(eq(orders.riderId, filters.riderId));
  }
  if (filters?.fromDate) {
    conditions.push(gte(orders.createdAt, filters.fromDate));
  }
  if (filters?.toDate) {
    conditions.push(lte(orders.createdAt, filters.toDate));
  }
  // By default, exclude archived orders
  if (!filters?.includeArchived) {
    conditions.push(sql`${orders.archivedAt} IS NULL`);
  }
  
  // Get total count with same filters
  let countQuery = db.select({ count: sql<number>`count(*)` }).from(orders);
  if (conditions.length > 0) {
    countQuery = countQuery.where(and(...conditions)) as any;
  }
  const [{ count: totalCount }] = await countQuery;
  
  // Get paginated items
  let query = db.select().from(orders);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  query = query.orderBy(desc(orders.createdAt)) as any;
  
  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
  }
  if (filters?.offset) {
    query = query.offset(filters.offset) as any;
  }
  
  const items = await query;
  return { items, totalCount };
}

export async function getOrderById(id: number): Promise<Order | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result[0] || null;
}

export async function getOrderByTrackingNumber(trackingNumber: string): Promise<Order | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(orders).where(eq(orders.trackingNumber, trackingNumber)).limit(1);
  return result[0] || null;
}

export async function updateOrder(id: number, data: Partial<InsertOrder>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(orders).set(data).where(eq(orders.id, id));
}

export async function cancelOrder(orderId: number, cancelledByUserId: number, reason?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(orders).set({
    status: "cancelled",
    cancellationReason: reason || null,
    cancelledAt: new Date(),
    cancelledBy: cancelledByUserId,
  }).where(eq(orders.id, orderId));
}

export async function archiveOrder(orderId: number, archivedByUserId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(orders).set({
    archivedAt: new Date(),
    archivedBy: archivedByUserId,
  }).where(eq(orders.id, orderId));
}

export async function unarchiveOrder(orderId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(orders).set({
    archivedAt: null,
    archivedBy: null,
  }).where(eq(orders.id, orderId));
}

export async function assignRiderToOrder(orderId: number, riderId: number, deviceId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(orders).set({
    riderId,
    deviceId,
    status: "assigned",
  }).where(eq(orders.id, orderId));
}

// ==================== TRACKING TOKEN QUERIES ====================

export async function createTrackingToken(orderId: number): Promise<TrackingToken | null> {
  const db = await getDb();
  if (!db) return null;
  
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  await db.insert(trackingTokens).values({
    orderId,
    token,
    isActive: false,
    expiresAt,
  });
  
  const result = await db.select().from(trackingTokens).where(eq(trackingTokens.token, token)).limit(1);
  return result[0] || null;
}

export async function getTrackingTokenByToken(token: string): Promise<TrackingToken | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(trackingTokens).where(eq(trackingTokens.token, token)).limit(1);
  return result[0] || null;
}

export async function getTrackingTokenByOrderId(orderId: number): Promise<TrackingToken | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(trackingTokens).where(eq(trackingTokens.orderId, orderId)).limit(1);
  return result[0] || null;
}

export async function activateTrackingToken(orderId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(trackingTokens).set({ isActive: true }).where(eq(trackingTokens.orderId, orderId));
}

export async function deactivateTrackingToken(orderId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(trackingTokens).set({ isActive: false }).where(eq(trackingTokens.orderId, orderId));
}

// ==================== ORDER HISTORY QUERIES ====================

export async function createOrderHistory(history: InsertOrderHistory): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(orderHistory).values(history);
}

export async function getOrderHistory(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(orderHistory).where(eq(orderHistory.orderId, orderId)).orderBy(desc(orderHistory.createdAt));
}

// ==================== DASHBOARD / REPORTING QUERIES ====================

export async function getOrderStats(fromDate?: Date, toDate?: Date) {
  const db = await getDb();
  if (!db) return null;
  
  const conditions = [];
  if (fromDate) conditions.push(gte(orders.createdAt, fromDate));
  if (toDate) conditions.push(lte(orders.createdAt, toDate));
  
  const baseQuery = conditions.length > 0 
    ? db.select().from(orders).where(and(...conditions))
    : db.select().from(orders);
  
  const allOrders = await baseQuery;
  
  const total = allOrders.length;
  const delivered = allOrders.filter(o => o.status === "delivered").length;
  const failed = allOrders.filter(o => o.status === "failed" || o.status === "returned").length;
  const pending = allOrders.filter(o => o.status === "pending").length;
  const inTransit = allOrders.filter(o => o.status === "in_transit" || o.status === "picked_up").length;
  
  const totalRevenue = allOrders
    .filter(o => o.status === "delivered")
    .reduce((sum, o) => sum + Number(o.price || 0), 0);
  
  return {
    total,
    delivered,
    failed,
    pending,
    inTransit,
    onTimeRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
    totalRevenue,
  };
}


// ==================== WALLET QUERIES ====================

import {
  wallets, Wallet, InsertWallet,
  walletTransactions, WalletTransaction, InsertWalletTransaction,
  payments, Payment, InsertPayment,
  referralCodes, ReferralCode, InsertReferralCode,
  referrals, Referral, InsertReferral
} from "../drizzle/schema";

export async function getOrCreateWallet(userId: number): Promise<Wallet | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Try to get existing wallet
  const existing = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  if (existing.length > 0) return existing[0];
  
  // Create new wallet
  await db.insert(wallets).values({ userId, balance: "0.00" });
  const result = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  return result[0] || null;
}

export async function getWalletByUserId(userId: number): Promise<Wallet | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  return result[0] || null;
}

export async function getAllWallets(
  page: number = 1,
  pageSize: number = 20
): Promise<{
  items: Array<{
    userId: number;
    userName: string | null;
    userEmail: string | null;
    balance: string;
    totalCredited: string;
    totalDebited: string;
  }>;
  totalCount: number;
  totalPages: number;
}> {
  const db = await getDb();
  if (!db) return { items: [], totalCount: 0, totalPages: 0 };
  
  const offset = (page - 1) * pageSize;
  
  // Get total count
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(wallets);
  const totalCount = Number(countResult[0]?.count || 0);
  const totalPages = Math.ceil(totalCount / pageSize);
  
  // Get paginated wallets with user info
  const allWallets = await db.select({
    id: wallets.id,
    userId: wallets.userId,
    userName: users.name,
    userEmail: users.email,
    balance: wallets.balance,
  })
    .from(wallets)
    .leftJoin(users, eq(wallets.userId, users.id))
    .limit(pageSize)
    .offset(offset);
  
  // Calculate totals for each wallet
  const walletsWithTotals = await Promise.all(
    allWallets.map(async (wallet) => {
      const transactions = await db.select({
        type: walletTransactions.type,
        amount: walletTransactions.amount,
      })
        .from(walletTransactions)
        .where(eq(walletTransactions.walletId, wallet.id));
      
      let totalCredited = 0;
      let totalDebited = 0;
      
      transactions.forEach((tx) => {
        const amount = parseFloat(tx.amount);
        if (tx.type === "credit" || tx.type === "bonus" || tx.type === "refund") {
          totalCredited += amount;
        } else if (tx.type === "debit") {
          totalDebited += amount;
        }
      });
      
      return {
        userId: wallet.userId,
        userName: wallet.userName,
        userEmail: wallet.userEmail,
        balance: wallet.balance,
        totalCredited: totalCredited.toFixed(2),
        totalDebited: totalDebited.toFixed(2),
      };
    })
  );
  
  return { items: walletsWithTotals, totalCount, totalPages };
}

export async function creditWallet(
  walletId: number,
  amount: number,
  description: string,
  referenceType?: string,
  referenceId?: string,
  adjustedByUserId?: number
): Promise<WalletTransaction | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Get current balance
  const wallet = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
  if (!wallet[0]) return null;
  
  const balanceBefore = Number(wallet[0].balance);
  const balanceAfter = balanceBefore + amount;
  
  // Update wallet balance
  await db.update(wallets).set({ balance: balanceAfter.toFixed(2) }).where(eq(wallets.id, walletId));
  
  // Create transaction record
  await db.insert(walletTransactions).values({
    walletId,
    type: "credit",
    amount: amount.toFixed(2),
    balanceBefore: balanceBefore.toFixed(2),
    balanceAfter: balanceAfter.toFixed(2),
    description,
    referenceType,
    referenceId,
    adjustedByUserId,
  });
  
  // Return the transaction
  const result = await db.select().from(walletTransactions)
    .where(eq(walletTransactions.walletId, walletId))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(1);
  
  return result[0] || null;
}

export async function debitWallet(
  walletId: number,
  amount: number,
  description: string,
  referenceType?: string,
  referenceId?: string,
  adjustedByUserId?: number
): Promise<WalletTransaction | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Get current balance
  const wallet = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
  if (!wallet[0]) return null;
  
  const balanceBefore = Number(wallet[0].balance);
  
  // Check sufficient balance
  if (balanceBefore < amount) {
    throw new Error("Insufficient wallet balance");
  }
  
  const balanceAfter = balanceBefore - amount;
  
  // Update wallet balance
  await db.update(wallets).set({ balance: balanceAfter.toFixed(2) }).where(eq(wallets.id, walletId));
  
  // Create transaction record
  await db.insert(walletTransactions).values({
    walletId,
    type: "debit",
    amount: amount.toFixed(2),
    balanceBefore: balanceBefore.toFixed(2),
    balanceAfter: balanceAfter.toFixed(2),
    description,
    referenceType,
    referenceId,
    adjustedByUserId,
  });
  
  // Return the transaction
  const result = await db.select().from(walletTransactions)
    .where(eq(walletTransactions.walletId, walletId))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(1);
  
  return result[0] || null;
}

export async function getWalletTransactions(walletId: number, limit: number = 50): Promise<WalletTransaction[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(walletTransactions)
    .where(eq(walletTransactions.walletId, walletId))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(limit);
}

// ==================== PAYMENT QUERIES ====================

export async function createPayment(payment: InsertPayment): Promise<Payment | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.insert(payments).values(payment);
  const result = await db.select().from(payments).where(eq(payments.reference, payment.reference)).limit(1);
  return result[0] || null;
}

export async function getPaymentByReference(reference: string): Promise<Payment | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(payments).where(eq(payments.reference, reference)).limit(1);
  return result[0] || null;
}

export async function updatePayment(reference: string, data: Partial<InsertPayment>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(payments).set(data).where(eq(payments.reference, reference));
}

export async function getUserPayments(userId: number, limit: number = 50): Promise<Payment[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(desc(payments.createdAt))
    .limit(limit);
}

// ==================== REFERRAL QUERIES ====================

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing chars
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function getOrCreateReferralCode(userId: number): Promise<ReferralCode | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Try to get existing code
  const existing = await db.select().from(referralCodes).where(eq(referralCodes.userId, userId)).limit(1);
  if (existing.length > 0) return existing[0];
  
  // Create new code
  const code = generateReferralCode();
  await db.insert(referralCodes).values({ userId, code });
  const result = await db.select().from(referralCodes).where(eq(referralCodes.userId, userId)).limit(1);
  return result[0] || null;
}

export async function getReferralCodeByCode(code: string): Promise<ReferralCode | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(referralCodes).where(eq(referralCodes.code, code.toUpperCase())).limit(1);
  return result[0] || null;
}

export async function createReferral(referral: InsertReferral): Promise<Referral | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.insert(referrals).values(referral);
  const result = await db.select().from(referrals).where(eq(referrals.referredUserId, referral.referredUserId)).limit(1);
  return result[0] || null;
}

export async function getReferralByReferredUserId(referredUserId: number): Promise<Referral | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(referrals).where(eq(referrals.referredUserId, referredUserId)).limit(1);
  return result[0] || null;
}

export async function updateReferral(id: number, data: Partial<InsertReferral>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(referrals).set(data).where(eq(referrals.id, id));
}

export async function getUserReferrals(referrerUserId: number): Promise<Referral[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(referrals)
    .where(eq(referrals.referrerUserId, referrerUserId))
    .orderBy(desc(referrals.createdAt));
}

export async function checkDuplicateReferral(deviceFingerprint?: string, ipAddress?: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  // Check if there's already a referral from this device/IP in the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const conditions = [];
  if (deviceFingerprint) {
    conditions.push(eq(referrals.deviceFingerprint, deviceFingerprint));
  }
  if (ipAddress) {
    conditions.push(eq(referrals.ipAddress, ipAddress));
  }
  
  if (conditions.length === 0) return false;
  
  const existing = await db.select().from(referrals)
    .where(and(
      gte(referrals.createdAt, thirtyDaysAgo),
      ...conditions
    ))
    .limit(1);
  
  return existing.length > 0;
}

export async function revokeReferral(
  referralId: number,
  revokedByUserId: number,
  reason: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(referrals).set({
    status: "revoked",
    revokedByUserId,
    revokedAt: new Date(),
    revokeReason: reason,
  }).where(eq(referrals.id, referralId));
}


// ==================== PARTNER COMPANIES ====================

export async function createPartnerCompany(data: InsertPartnerCompany): Promise<PartnerCompany | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result: any = await db.insert(partnerCompanies).values(data);
  if (!result.insertId) return null;
  
  return getPartnerCompanyById(Number(result.insertId));
}

export async function getPartnerCompanyById(id: number): Promise<PartnerCompany | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(partnerCompanies).where(eq(partnerCompanies.id, id));
  return result[0] || null;
}

export async function getPartnerByUserId(userId: number): Promise<PartnerCompany | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(partnerCompanies).where(eq(partnerCompanies.userId, userId));
  return result[0] || null;
}

export async function getAllPartnerCompanies(
  status?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ items: PartnerCompany[]; totalCount: number; totalPages: number }> {
  const db = await getDb();
  if (!db) return { items: [], totalCount: 0, totalPages: 0 };
  
  const offset = (page - 1) * pageSize;
  
  // Build base query
  const baseQuery = db.select().from(partnerCompanies);
  const baseCountQuery = db.select({ count: sql<number>`count(*)` }).from(partnerCompanies);
  
  // Apply status filter if provided
  const query = status ? baseQuery.where(eq(partnerCompanies.status, status as any)) : baseQuery;
  const countQuery = status ? baseCountQuery.where(eq(partnerCompanies.status, status as any)) : baseCountQuery;
  
  // Get total count
  const countResult = await countQuery;
  const totalCount = Number(countResult[0]?.count || 0);
  const totalPages = Math.ceil(totalCount / pageSize);
  
  // Get paginated items
  const items = await query.limit(pageSize).offset(offset);
  
  return { items, totalCount, totalPages };
}

export async function updatePartnerCompany(id: number, data: Partial<InsertPartnerCompany>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(partnerCompanies).set(data).where(eq(partnerCompanies.id, id));
}

export async function approvePartnerCompany(id: number, approvedByUserId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Get partner details before update
  const [partner] = await db.select().from(partnerCompanies).where(eq(partnerCompanies.id, id)).limit(1);
  
  await db.update(partnerCompanies).set({
    status: "approved",
    approvedByUserId,
    approvedAt: new Date(),
  }).where(eq(partnerCompanies.id, id));
  
  // Send approval email (non-blocking)
  if (partner && partner.contactEmail) {
    const { sendApplicationApprovedEmail, hasNotificationBeenSent } = await import("./fleetOwnerEmailNotifications");
    const alreadySent = await hasNotificationBeenSent(id, "approved");
    if (!alreadySent) {
      sendApplicationApprovedEmail(partner.contactEmail, partner.name, id).catch((error) => {
        console.error(`[Partner] Failed to send approval email:`, error);
      });
    }
  }
}

export async function rejectPartnerCompany(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Get partner details before update
  const [partner] = await db.select().from(partnerCompanies).where(eq(partnerCompanies.id, id)).limit(1);
  
  await db.update(partnerCompanies).set({
    status: "rejected",
  }).where(eq(partnerCompanies.id, id));
  
  // Send rejection email (non-blocking)
  if (partner && partner.contactEmail) {
    const { sendApplicationRejectedEmail, hasNotificationBeenSent } = await import("./fleetOwnerEmailNotifications");
    const alreadySent = await hasNotificationBeenSent(id, "rejected");
    if (!alreadySent) {
      sendApplicationRejectedEmail(partner.contactEmail, partner.name, id).catch((error) => {
        console.error(`[Partner] Failed to send rejection email:`, error);
      });
    }
  }
}

// ==================== PARTNER FLEET ====================

export async function getPartnerFleet(partnerCompanyId: number): Promise<{
  riders: Rider[];
  devices: Device[];
}> {
  const db = await getDb();
  if (!db) return { riders: [], devices: [] };
  
  const partnerRiders = await db.select().from(riders).where(eq(riders.partnerCompanyId, partnerCompanyId));
  const partnerDevices = await db.select().from(devices).where(eq(devices.partnerCompanyId, partnerCompanyId));
  
  return {
    riders: partnerRiders,
    devices: partnerDevices,
  };
}

export async function getPartnerOrders(partnerCompanyId: number, limit: number = 50): Promise<Order[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(orders)
    .where(eq(orders.partnerCompanyId, partnerCompanyId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

// ==================== PARTNER EARNINGS ====================

export async function createPartnerEarning(data: InsertPartnerEarning): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(partnerEarnings).values(data);
}

export async function getPartnerEarnings(partnerCompanyId: number, limit: number = 50): Promise<PartnerEarning[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(partnerEarnings)
    .where(eq(partnerEarnings.partnerCompanyId, partnerCompanyId))
    .orderBy(desc(partnerEarnings.createdAt))
    .limit(limit);
}

export async function getPartnerEarningsSummary(partnerCompanyId: number): Promise<{
  totalEarnings: number;
  pendingEarnings: number;
  creditedEarnings: number;
  paidOutEarnings: number;
}> {
  const db = await getDb();
  if (!db) return {
    totalEarnings: 0,
    pendingEarnings: 0,
    creditedEarnings: 0,
    paidOutEarnings: 0,
  };
  
  const earnings = await db.select().from(partnerEarnings).where(eq(partnerEarnings.partnerCompanyId, partnerCompanyId));
  
  const summary = earnings.reduce((acc, earning) => {
    const amount = Number(earning.partnerAmount);
    acc.totalEarnings += amount;
    
    if (earning.status === "pending") acc.pendingEarnings += amount;
    if (earning.status === "credited") acc.creditedEarnings += amount;
    if (earning.status === "paid_out") acc.paidOutEarnings += amount;
    
    return acc;
  }, {
    totalEarnings: 0,
    pendingEarnings: 0,
    creditedEarnings: 0,
    paidOutEarnings: 0,
  });
  
  return summary;
}

export async function creditPartnerEarning(earningId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(partnerEarnings).set({
    status: "credited",
    creditedAt: new Date(),
  }).where(eq(partnerEarnings.id, earningId));
}


export async function getPartnerEarningByOrderId(orderId: number): Promise<PartnerEarning | null> {
  const database = await getDb();
  if (!database) return null;
  
  const result = await database.select().from(partnerEarnings).where(eq(partnerEarnings.orderId, orderId));
  return result[0] || null;
}

export async function creditPartnerBalance(partnerCompanyId: number, amount: number): Promise<void> {
  const database = await getDb();
  if (!database) return;
  
  await database
    .update(partnerCompanies)
    .set({
      balance: sql`${partnerCompanies.balance} + ${amount}`,
    })
    .where(eq(partnerCompanies.id, partnerCompanyId));
}

// ==================== PARTNER FLEET ASSIGNMENT ====================

export async function assignRiderToPartner(riderId: number, partnerCompanyId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(riders).set({
    fleetType: "partner_fleet",
    partnerCompanyId,
  }).where(eq(riders.id, riderId));
}

export async function unassignRiderFromPartner(riderId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(riders).set({
    fleetType: "apiamway_owned",
    partnerCompanyId: null,
  }).where(eq(riders.id, riderId));
}

export async function assignDeviceToPartner(deviceId: number, partnerCompanyId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(devices).set({
    fleetType: "partner_fleet",
    partnerCompanyId,
  }).where(eq(devices.id, deviceId));
}

export async function unassignDeviceFromPartner(deviceId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(devices).set({
    fleetType: "apiamway_owned",
    partnerCompanyId: null,
  }).where(eq(devices.id, deviceId));
}


// ==================== USER MANAGEMENT ====================

export async function getAllUsersWithStats(filters?: {
  search?: string;
  accountType?: "shipper" | "fleet_owner" | "all";
  fleetOwnerStatus?: "pending" | "approved" | "suspended" | "rejected" | "all";
  limit?: number;
  offset?: number;
}): Promise<{ items: any[]; totalCount: number }> {
  const db = await getDb();
  if (!db) return { items: [], totalCount: 0 };

  try {
    // Get all users
    let usersQuery = db.select().from(users);
    const allUsers = await usersQuery;

    // Get all partner companies for Fleet Owner status
    const allPartners = await db.select().from(partnerCompanies);
    const partnersByUserId = new Map(
      allPartners.filter(p => p.userId).map(p => [p.userId!, p])
    );

    // Get order counts per user (match by email)
    const allOrders = await db.select().from(orders);
    const orderCountsByEmail = new Map<string, number>();
    allOrders.forEach(order => {
      if (order.customerEmail) {
        const email = order.customerEmail.toLowerCase();
        orderCountsByEmail.set(email, (orderCountsByEmail.get(email) || 0) + 1);
      }
    });

    // Get wallet balances
    const { wallets } = await import("../drizzle/schema");
    const allWallets = await db.select().from(wallets);
    const walletsByUserId = new Map(allWallets.map(w => [w.userId, w]));

    // Build user list with stats
    let results = allUsers.map(user => {
      const partner = partnersByUserId.get(user.id);
      const wallet = walletsByUserId.get(user.id);
      const orderCount = user.email ? orderCountsByEmail.get(user.email.toLowerCase()) || 0 : 0;

      return {
        id: user.id,
        name: user.name || "Unknown",
        email: user.email || "",
        phone: "", // Not stored in users table
        accountTypeIntent: user.accountTypeIntent || "shipper",
        fleetOwnerStatus: partner?.status || null,
        walletBalance: wallet?.balance || 0,
        totalOrders: orderCount,
        createdAt: user.createdAt,
      };
    });

    // Apply filters
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(u =>
        u.name.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower)
      );
    }

    if (filters?.accountType && filters.accountType !== "all") {
      if (filters.accountType === "fleet_owner") {
        results = results.filter(u => u.accountTypeIntent === "fleet_owner" || u.fleetOwnerStatus);
      } else if (filters.accountType === "shipper") {
        results = results.filter(u => !u.fleetOwnerStatus);
      }
    }

    if (filters?.fleetOwnerStatus && filters.fleetOwnerStatus !== "all") {
      results = results.filter(u => u.fleetOwnerStatus === filters.fleetOwnerStatus);
    }

    const totalCount = results.length;
    
    // Apply pagination
    if (filters?.limit) {
      const offset = filters.offset || 0;
      results = results.slice(offset, offset + filters.limit);
    }

    return { items: results, totalCount };
  } catch (error) {
    console.error("[Database] Error getting users with stats:", error);
    return { items: [], totalCount: 0 };
  }
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || user.length === 0) return null;

    // Get partner company if exists
    const partner = await db.select().from(partnerCompanies).where(eq(partnerCompanies.userId, userId)).limit(1);

    return {
      ...user[0],
      fleetOwnerApplication: partner && partner.length > 0 ? partner[0] : null,
    };
  } catch (error) {
    console.error("[Database] Error getting user by ID:", error);
    return null;
  }
}

export async function getUserOrders(userId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    // Get user email first
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || user.length === 0 || !user[0].email) return [];

    // Match orders by email
    const userEmail = user[0].email.toLowerCase();
    const allOrders = await db.select().from(orders);
    return allOrders.filter(order => 
      order.customerEmail && order.customerEmail.toLowerCase() === userEmail
    );
  } catch (error) {
    console.error("[Database] Error getting user orders:", error);
    return [];
  }
}

export async function getUserWalletTransactions(userId: number) {
  const db = await getDb();
  if (!db) return { wallet: null, transactions: [] };

  try {
    const { wallets, walletTransactions } = await import("../drizzle/schema");
    
    // Get wallet
    const wallet = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
    
    // Get transactions
    const transactions = wallet && wallet.length > 0
      ? await db.select().from(walletTransactions).where(eq(walletTransactions.walletId, wallet[0].id))
      : [];

    return {
      wallet: wallet && wallet.length > 0 ? wallet[0] : null,
      transactions,
    };
  } catch (error) {
    console.error("[Database] Error getting user wallet transactions:", error);
    return { wallet: null, transactions: [] };
  }
}

export async function getUserReferralStats(userId: number) {
  const db = await getDb();
  if (!db) return { referralCode: null, referrals: [], totalBonus: 0 };

  try {
    const { referralCodes, referrals, walletTransactions } = await import("../drizzle/schema");
    
    // Get referral code
    const code = await db.select().from(referralCodes).where(eq(referralCodes.userId, userId)).limit(1);
    
    // Get referrals
    const userReferrals = code && code.length > 0
      ? await db.select().from(referrals).where(eq(referrals.referralCodeId, code[0].id))
      : [];

    // Get referral bonuses from wallet transactions
    const { wallets } = await import("../drizzle/schema");
    const wallet = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
    
    const referralTransactions = wallet && wallet.length > 0
      ? await db.select().from(walletTransactions)
          .where(eq(walletTransactions.walletId, wallet[0].id))
      : [];

    const totalBonus = referralTransactions
      .filter(t => t.type === "credit" && t.description?.includes("referral"))
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    return {
      referralCode: code && code.length > 0 ? code[0] : null,
      referrals: userReferrals,
      totalBonus,
      referralTransactions: referralTransactions.filter(t => t.description?.includes("referral")),
    };
  } catch (error) {
    console.error("[Database] Error getting user referral stats:", error);
    return { referralCode: null, referrals: [], totalBonus: 0, referralTransactions: [] };
  }
}

export async function updateUserProfile(userId: number, data: { name?: string; phone?: string }): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update user profile: database not available");
    return;
  }

  try {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;

    if (Object.keys(updateData).length === 0) {
      return; // Nothing to update
    }

    await db.update(users).set(updateData).where(eq(users.id, userId));
  } catch (error) {
    console.error("[Database] Error updating user profile:", error);
    throw new Error("Failed to update user profile");
  }
}

// ==================== DEVICE MAINTENANCE EVENTS ====================

/**
 * Log a maintenance event (set_maintenance or mark_available)
 */
export async function createMaintenanceEvent(event: InsertDeviceMaintenanceEvent): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create maintenance event: database not available");
    return;
  }

  try {
    await db.insert(deviceMaintenanceEvents).values(event);
  } catch (error) {
    console.error("[Database] Error creating maintenance event:", error);
    throw new Error("Failed to log maintenance event");
  }
}

/**
 * Get maintenance history for a device (newest first)
 */
export async function getDeviceMaintenanceHistory(deviceId: number): Promise<(DeviceMaintenanceEvent & { performedBy: { id: number; name: string | null } | null })[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const events = await db
      .select({
        id: deviceMaintenanceEvents.id,
        deviceId: deviceMaintenanceEvents.deviceId,
        actionType: deviceMaintenanceEvents.actionType,
        reason: deviceMaintenanceEvents.reason,
        maintenanceUntil: deviceMaintenanceEvents.maintenanceUntil,
        performedByUserId: deviceMaintenanceEvents.performedByUserId,
        createdAt: deviceMaintenanceEvents.createdAt,
        performedBy: {
          id: users.id,
          name: users.name,
        },
      })
      .from(deviceMaintenanceEvents)
      .leftJoin(users, eq(deviceMaintenanceEvents.performedByUserId, users.id))
      .where(eq(deviceMaintenanceEvents.deviceId, deviceId))
      .orderBy(desc(deviceMaintenanceEvents.id));

    return events;
  } catch (error) {
    console.error("[Database] Error getting device maintenance history:", error);
    return [];
  }
}


// ==================== CANCELLED ORDER EARNINGS ====================

export interface CancelledOrderEarning {
  earningId: number;
  earningStatus: string;
  partnerAmount: string;
  orderPrice: string;
  commissionPercentage: string;
  createdAt: Date | null;
  orderId: number | null;
  trackingNumber: string | null;
  orderStatus: string | null;
  cancelledAt: Date | null;
  partnerCompanyId: number;
  fleetOwnerName: string | null;
  // Void metadata (null for pending rows)
  voidedAt: Date | null;
  voidedBy: number | null;
  voidReason: string | null;
}

/**
 * Return earnings whose linked order is cancelled.
 * Used by the admin "Cancelled Order Earnings" review panel.
 *
 * @param includeVoided - When true, also return voided earnings (default: false = pending only).
 */
export async function listCancelledOrderEarnings(
  page: number = 1,
  pageSize: number = 20,
  includeVoided: boolean = false
): Promise<{ items: CancelledOrderEarning[]; totalCount: number }> {
  const database = await getDb();
  if (!database) return { items: [], totalCount: 0 };

  const offset = (page - 1) * pageSize;

  // Build the status filter: pending only, or pending + voided
  const statusFilter = includeVoided
    ? or(eq(partnerEarnings.status, "pending"), eq(partnerEarnings.status, "voided"))
    : eq(partnerEarnings.status, "pending");

  // Fetch earnings joined with their order and partner company
  const rows = await database
    .select({
      earningId: partnerEarnings.id,
      earningStatus: partnerEarnings.status,
      partnerAmount: partnerEarnings.partnerAmount,
      orderPrice: partnerEarnings.orderPrice,
      commissionPercentage: partnerEarnings.commissionPercentage,
      createdAt: partnerEarnings.createdAt,
      orderId: partnerEarnings.orderId,
      trackingNumber: orders.trackingNumber,
      orderStatus: orders.status,
      cancelledAt: orders.cancelledAt,
      partnerCompanyId: partnerEarnings.partnerCompanyId,
      fleetOwnerName: partnerCompanies.name,
      voidedAt: partnerEarnings.voidedAt,
      voidedBy: partnerEarnings.voidedBy,
      voidReason: partnerEarnings.voidReason,
    })
    .from(partnerEarnings)
    .leftJoin(orders, eq(partnerEarnings.orderId, orders.id))
    .leftJoin(partnerCompanies, eq(partnerEarnings.partnerCompanyId, partnerCompanies.id))
    .where(
      and(
        statusFilter,
        or(
          eq(orders.status, "cancelled"),
          sql`${orders.cancelledAt} IS NOT NULL`
        )
      )
    )
    .orderBy(desc(partnerEarnings.id));

  const totalCount = rows.length;
  const items = rows.slice(offset, offset + pageSize) as CancelledOrderEarning[];

  return { items, totalCount };
}

// ─── Void Earning ─────────────────────────────────────────────────────────────

export type VoidEarningResult =
  | { success: true }
  | { success: false; error: "not_found" | "not_pending" | "order_not_cancelled" };

/**
 * Void a cancelled-order earning.
 *
 * Safety rules:
 *  1. Earning must exist.
 *  2. Earning status must be "pending" (not already credited, paid_out, or voided).
 *  3. Linked order must be cancelled (status === "cancelled" OR cancelledAt IS NOT NULL).
 *
 * On success, sets status = "voided" and records voidedAt / voidedBy / voidReason.
 * The record is never deleted — full audit trail is preserved.
 */
export async function voidEarning(
  earningId: number,
  adminUserId: number,
  reason?: string
): Promise<VoidEarningResult> {
  const database = await getDb();
  if (!database) return { success: false, error: "not_found" };

  // Fetch earning with its linked order in a single join
  const rows = await database
    .select({
      earningId: partnerEarnings.id,
      earningStatus: partnerEarnings.status,
      orderId: partnerEarnings.orderId,
      orderStatus: orders.status,
      cancelledAt: orders.cancelledAt,
    })
    .from(partnerEarnings)
    .leftJoin(orders, eq(partnerEarnings.orderId, orders.id))
    .where(eq(partnerEarnings.id, earningId));

  if (rows.length === 0) return { success: false, error: "not_found" };

  const row = rows[0];

  // Guard 1: earning must be pending
  if (row.earningStatus !== "pending") {
    return { success: false, error: "not_pending" };
  }

  // Guard 2: linked order must be cancelled
  const orderIsCancelled =
    row.orderStatus === "cancelled" || row.cancelledAt !== null;
  if (!orderIsCancelled) {
    return { success: false, error: "order_not_cancelled" };
  }

  // Apply void
  await database
    .update(partnerEarnings)
    .set({
      status: "voided",
      voidedAt: new Date(),
      voidedBy: adminUserId,
      voidReason: reason ?? null,
    })
    .where(eq(partnerEarnings.id, earningId));

  console.log(
    `[Earning VOIDED] earningId=${earningId} voidedBy=${adminUserId}${reason ? ` reason="${reason}"` : ""}`
  );

  return { success: true };
}

// ─── Export Cancelled Order Earnings (no pagination) ──────────────────────────

/**
 * Return ALL earnings whose linked order is cancelled — no pagination.
 * Used for CSV export from the admin "Cancelled Order Earnings" panel.
 */
export async function exportCancelledOrderEarnings(
  includeVoided: boolean = false
): Promise<CancelledOrderEarning[]> {
  const database = await getDb();
  if (!database) return [];

  const statusFilter = includeVoided
    ? or(eq(partnerEarnings.status, "pending"), eq(partnerEarnings.status, "voided"))
    : eq(partnerEarnings.status, "pending");

  const rows = await database
    .select({
      earningId: partnerEarnings.id,
      earningStatus: partnerEarnings.status,
      partnerAmount: partnerEarnings.partnerAmount,
      orderPrice: partnerEarnings.orderPrice,
      commissionPercentage: partnerEarnings.commissionPercentage,
      createdAt: partnerEarnings.createdAt,
      orderId: partnerEarnings.orderId,
      trackingNumber: orders.trackingNumber,
      orderStatus: orders.status,
      cancelledAt: orders.cancelledAt,
      partnerCompanyId: partnerEarnings.partnerCompanyId,
      fleetOwnerName: partnerCompanies.name,
      voidedAt: partnerEarnings.voidedAt,
      voidedBy: partnerEarnings.voidedBy,
      voidReason: partnerEarnings.voidReason,
    })
    .from(partnerEarnings)
    .leftJoin(orders, eq(partnerEarnings.orderId, orders.id))
    .leftJoin(partnerCompanies, eq(partnerEarnings.partnerCompanyId, partnerCompanies.id))
    .where(
      and(
        statusFilter,
        or(
          eq(orders.status, "cancelled"),
          sql`${orders.cancelledAt} IS NOT NULL`
        )
      )
    )
    .orderBy(desc(partnerEarnings.id));

  return rows as CancelledOrderEarning[];
}

// ─── Settlement Warnings (cancelled orders with existing settlement records) ───

export interface SettlementWarning {
  earningId: number;
  earningStatus: string;
  orderPrice: string;
  commissionPercentage: string;
  partnerAmount: string;
  apiamwayAmount: string;
  earningCreatedAt: Date;
  orderId: number;
  trackingNumber: string | null;
  orderStatus: string | null;
  cancelledAt: Date | null;
  partnerCompanyId: number;
  fleetOwnerName: string | null;
}

export interface SettlementWarningsResult {
  rows: SettlementWarning[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Return earnings that are NOT voided but whose linked order is cancelled.
 * These are "settlement warnings" — settlement ran before the order was cancelled.
 */
export async function listSettlementWarnings(
  page: number = 1,
  pageSize: number = 20
): Promise<SettlementWarningsResult> {
  const database = await getDb();
  if (!database) {
    return { rows: [], totalCount: 0, page, pageSize, totalPages: 0 };
  }

  // Earnings that are NOT voided (i.e. settlement ran) on cancelled orders
  const warningFilter = and(
    inArray(partnerEarnings.status, ["pending", "credited", "paid_out"]),
    or(
      eq(orders.status, "cancelled"),
      sql`${orders.cancelledAt} IS NOT NULL`
    )
  );

  const allRows = await database
    .select({
      earningId: partnerEarnings.id,
      earningStatus: partnerEarnings.status,
      orderPrice: partnerEarnings.orderPrice,
      commissionPercentage: partnerEarnings.commissionPercentage,
      partnerAmount: partnerEarnings.partnerAmount,
      apiamwayAmount: partnerEarnings.apiamwayAmount,
      earningCreatedAt: partnerEarnings.createdAt,
      orderId: partnerEarnings.orderId,
      trackingNumber: orders.trackingNumber,
      orderStatus: orders.status,
      cancelledAt: orders.cancelledAt,
      partnerCompanyId: partnerEarnings.partnerCompanyId,
      fleetOwnerName: partnerCompanies.name,
    })
    .from(partnerEarnings)
    .leftJoin(orders, eq(partnerEarnings.orderId, orders.id))
    .leftJoin(partnerCompanies, eq(partnerEarnings.partnerCompanyId, partnerCompanies.id))
    .where(warningFilter)
    .orderBy(desc(partnerEarnings.id));

  const totalCount = allRows.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const offset = (page - 1) * pageSize;
  const rows = allRows.slice(offset, offset + pageSize) as SettlementWarning[];

  return { rows, totalCount, page, pageSize, totalPages };
}

// ─── Bulk Void Cancelled-Order Earnings ───────────────────────────────────────

export interface BulkVoidResult {
  /** Number of earnings successfully voided in this call. */
  voidedCount: number;
  /** Earnings that were skipped and why. */
  skipped: Array<{
    earningId: number;
    reason: "not_found" | "not_pending" | "order_not_cancelled";
  }>;
}

/**
 * Void multiple earnings in a single admin action.
 *
 * Validation per earning (same rules as single voidEarning):
 *   1. Must exist.
 *   2. Status must be "pending".
 *   3. Linked order must be cancelled (status = "cancelled" OR cancelledAt IS NOT NULL).
 *
 * Invalid rows are skipped and reported in `skipped`; they do NOT abort the batch.
 * Successfully voided rows get: status="voided", voidedAt, voidedBy, voidReason.
 */
export async function bulkVoidEarnings(
  earningIds: number[],
  adminUserId: number,
  reason: string
): Promise<BulkVoidResult> {
  const database = await getDb();
  if (!database) {
    return {
      voidedCount: 0,
      skipped: earningIds.map((id) => ({ earningId: id, reason: "not_found" as const })),
    };
  }

  if (earningIds.length === 0) {
    return { voidedCount: 0, skipped: [] };
  }

  // Fetch all requested earnings with their linked order status in one query
  const rows = await database
    .select({
      earningId: partnerEarnings.id,
      earningStatus: partnerEarnings.status,
      orderStatus: orders.status,
      cancelledAt: orders.cancelledAt,
    })
    .from(partnerEarnings)
    .leftJoin(orders, eq(partnerEarnings.orderId, orders.id))
    .where(inArray(partnerEarnings.id, earningIds));

  const foundIds = new Set(rows.map((r) => r.earningId));
  const skipped: BulkVoidResult["skipped"] = [];
  const validIds: number[] = [];

  // Validate each requested earning
  for (const id of earningIds) {
    if (!foundIds.has(id)) {
      skipped.push({ earningId: id, reason: "not_found" });
      continue;
    }
    const row = rows.find((r) => r.earningId === id)!;

    if (row.earningStatus !== "pending") {
      skipped.push({ earningId: id, reason: "not_pending" });
      continue;
    }

    const orderIsCancelled =
      row.orderStatus === "cancelled" || row.cancelledAt !== null;
    if (!orderIsCancelled) {
      skipped.push({ earningId: id, reason: "order_not_cancelled" });
      continue;
    }

    validIds.push(id);
  }

  if (validIds.length === 0) {
    return { voidedCount: 0, skipped };
  }

  // Apply void to all valid earnings in one UPDATE
  await database
    .update(partnerEarnings)
    .set({
      status: "voided",
      voidedAt: new Date(),
      voidedBy: adminUserId,
      voidReason: reason,
    })
    .where(inArray(partnerEarnings.id, validIds));

  console.log(
    `[Bulk Void] ${validIds.length} earnings voided by adminUserId=${adminUserId} ` +
      `reason="${reason}" ids=[${validIds.join(",")}]` +
      (skipped.length > 0 ? ` skipped=${skipped.length}` : "")
  );

  return { voidedCount: validIds.length, skipped };
}

// ─── Void Reason Analytics ────────────────────────────────────────────────────

export interface VoidReasonCount {
  reason: string;
  count: number;
}

/**
 * Return the count of voided earnings grouped by voidReason.
 * Only earnings with status = "voided" are included.
 * Rows where voidReason is NULL are grouped under the label "(no reason)".
 */
export async function getVoidReasonCounts(): Promise<VoidReasonCount[]> {
  const database = await getDb();
  if (!database) return [];

  const rows = await database
    .select({
      reason: sql<string>`COALESCE(${partnerEarnings.voidReason}, '(no reason)')`,
      count: count(),
    })
    .from(partnerEarnings)
    .where(eq(partnerEarnings.status, "voided"))
    .groupBy(sql`COALESCE(${partnerEarnings.voidReason}, '(no reason)')`);

  // Sort descending by count so the most common reason appears first
  return (rows as VoidReasonCount[]).sort((a, b) => b.count - a.count);
}
