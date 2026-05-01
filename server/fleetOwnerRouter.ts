import { z } from "zod";
import { getDb } from "./db";
import { partnerCompanies, users } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { sendApplicationSubmittedEmail, hasNotificationBeenSent } from "./fleetOwnerEmailNotifications";

/**
 * Fleet Owner Router
 * Handles Fleet Owner onboarding and application status
 */

export const fleetOwnerRouter = router({
  /**
   * Submit Fleet Owner onboarding application
   * Creates a Fleet Owner application linked to the current user
   */
  submitOnboarding: protectedProcedure
    .input(
      z.object({
        companyType: z.enum(["individual", "company"]),
        companyName: z.string().min(1).optional(),
        address: z.string().min(1),
        operatingCities: z.string().min(1), // Comma-separated list
        estimatedBikes: z.number().int().min(1),
        contactPerson: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Check if user already has a Fleet Owner application
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const existing = await db
        .select()
        .from(partnerCompanies)
        .where(eq(partnerCompanies.userId, userId))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You have already submitted a Fleet Owner application",
        });
      }

      // Create Fleet Owner application
      const companyName = input.companyName || ctx.user.name || "Fleet Owner";
      const contactName = input.contactPerson || ctx.user.name || "Owner";

      const [application] = await db!.insert(partnerCompanies).values({
        name: companyName,
        contactName,
        contactPhone: "", // Will be filled by admin during approval
        contactEmail: ctx.user.email || "",
        status: "pending",
        userId,
        commissionType: "percentage",
        commissionValue: "70.00", // Default 70% to Fleet Owner, 30% to Apiamway
      });

      // Update user's accountTypeIntent to fleet_owner
      await db!
        .update(users)
        .set({ accountTypeIntent: "fleet_owner" })
        .where(eq(users.id, userId));

      // Send confirmation email (non-blocking)
      const applicationId = application.insertId;
      const email = ctx.user.email || "";
      if (email) {
        // Check if notification already sent to prevent duplicates
        const alreadySent = await hasNotificationBeenSent(applicationId, "submitted");
        if (!alreadySent) {
          sendApplicationSubmittedEmail(email, companyName, applicationId).catch((error) => {
            console.error(`[Fleet Owner] Failed to send submission email:`, error);
            // Don't block the response if email fails
          });
        }
      }

      return {
        success: true,
        applicationId,
        message: "Fleet Owner application submitted successfully. You will be notified once approved.",
      };
    }),

  /**
   * Get Fleet Owner application status for current user
   */
  getApplicationStatus: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const [application] = await db
      .select()
      .from(partnerCompanies)
      .where(eq(partnerCompanies.userId, userId))
      .limit(1);

    if (!application) {
      return {
        hasApplication: false,
        status: null,
        application: null,
      };
    }

    return {
      hasApplication: true,
      status: application.status,
      application: {
        id: application.id,
        name: application.name,
        contactName: application.contactName,
        contactPhone: application.contactPhone,
        contactEmail: application.contactEmail,
        status: application.status,
        approvedAt: application.approvedAt,
        createdAt: application.createdAt,
      },
    };
  }),

  /**
   * Set user's account type intent (shipper or fleet_owner)
   * Used for fallback when signup_intent cookie is missing
   */
  setAccountTypeIntent: protectedProcedure
    .input(
      z.object({
        intent: z.enum(["shipper", "fleet_owner"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(users)
        .set({ accountTypeIntent: input.intent })
        .where(eq(users.id, userId));

      return {
        success: true,
        intent: input.intent,
      };
    }),

  /**
   * Get Fleet Owner dashboard statistics
   * Only accessible to approved Fleet Owners
   */
  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // Get Fleet Owner application
    const [application] = await db
      .select()
      .from(partnerCompanies)
      .where(eq(partnerCompanies.userId, userId))
      .limit(1);

    if (!application) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Fleet Owner application not found" });
    }

    if (application.status !== "approved") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Fleet Owner application not approved" });
    }

    // Get fleet stats from db module
    const { getPartnerFleet, getPartnerEarnings } = await import("./db");
    const fleet = await getPartnerFleet(application.id);
    const earnings = await getPartnerEarnings(application.id, 1000); // Get all earnings

    // Calculate stats
    const totalEarnings = earnings.reduce((sum, e) => sum + parseFloat(e.partnerAmount), 0);
    const pendingPayouts = earnings
      .filter(e => e.status === "pending")
      .reduce((sum, e) => sum + parseFloat(e.partnerAmount), 0);

    // Calculate bike status counts
    const bikeStatusCounts = {
      available: fleet.devices.filter(d => d.status === "available").length,
      in_transit: fleet.devices.filter(d => d.status === "in_transit").length,
      maintenance: fleet.devices.filter(d => d.status === "maintenance").length,
      inactive: fleet.devices.filter(d => d.status === "inactive").length,
    };

    return {
      totalEarnings: totalEarnings.toFixed(2),
      pendingPayouts: pendingPayouts.toFixed(2),
      totalBikes: fleet.devices.length,
      totalRiders: fleet.riders.length,
      balance: application.balance,
      bikeStatusCounts,
    };
  }),

  /**
   * Get Fleet Owner's fleet (bikes and riders)
   */
  getFleet: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // Get Fleet Owner application
    const [application] = await db
      .select()
      .from(partnerCompanies)
      .where(eq(partnerCompanies.userId, userId))
      .limit(1);

    if (!application) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Fleet Owner application not found" });
    }

    if (application.status !== "approved") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Fleet Owner application not approved" });
    }

    // Get fleet from db module
    const { getPartnerFleet } = await import("./db");
    const fleet = await getPartnerFleet(application.id);

    return {
      bikes: fleet.devices,
      riders: fleet.riders,
    };
  }),

  /**
   * Get Fleet Owner's earnings history
   */
  getEarnings: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // Get Fleet Owner application
    const [application] = await db
      .select()
      .from(partnerCompanies)
      .where(eq(partnerCompanies.userId, userId))
      .limit(1);

    if (!application) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Fleet Owner application not found" });
    }

    if (application.status !== "approved") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Fleet Owner application not approved" });
    }

    // Get earnings from db module
    const { getPartnerEarnings } = await import("./db");
    const earnings = await getPartnerEarnings(application.id, 100); // Last 100 earnings

    return { earnings };
  }),

  /**
   * Get Fleet Owner's payout history
   */
  getPayouts: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // Get Fleet Owner application
    const [application] = await db
      .select()
      .from(partnerCompanies)
      .where(eq(partnerCompanies.userId, userId))
      .limit(1);

    if (!application) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Fleet Owner application not found" });
    }

    if (application.status !== "approved") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Fleet Owner application not approved" });
    }

    // Get payout history from weeklyPayout module
    const { getFleetOwnerPayoutHistory } = await import("./weeklyPayout");
    const payouts = await getFleetOwnerPayoutHistory(application.id);

    return { payouts };
  }),
});
