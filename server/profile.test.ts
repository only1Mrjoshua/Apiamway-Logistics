import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/trpc";
import * as db from "./db";

describe("Profile Management", () => {
  let testUserId: number;

  beforeAll(async () => {
    // Create a test user
    await db.upsertUser({
      openId: "test-profile-user",
      name: "Test User",
      email: "test@example.com",
      phone: "08012345678",
    });

    const user = await db.getUserByOpenId("test-profile-user");
    if (!user) throw new Error("Failed to create test user");
    testUserId = user.id;
  });

  describe("users.updateProfile", () => {
    it("should update user name successfully", async () => {
      const caller = appRouter.createCaller({
        user: { id: testUserId, openId: "test-profile-user", role: "user" },
      } as Context);

      const result = await caller.users.updateProfile({
        name: "Updated Name",
      });

      expect(result.success).toBe(true);

      // Verify update
      const updatedUser = await db.getUserById(testUserId);
      expect(updatedUser?.name).toBe("Updated Name");
    });

    it("should update user phone successfully", async () => {
      const caller = appRouter.createCaller({
        user: { id: testUserId, openId: "test-profile-user", role: "user" },
      } as Context);

      const result = await caller.users.updateProfile({
        phone: "08098765432",
      });

      expect(result.success).toBe(true);

      // Verify update
      const updatedUser = await db.getUserById(testUserId);
      expect(updatedUser?.phone).toBe("08098765432");
    });

    it("should update both name and phone successfully", async () => {
      const caller = appRouter.createCaller({
        user: { id: testUserId, openId: "test-profile-user", role: "user" },
      } as Context);

      const result = await caller.users.updateProfile({
        name: "Final Name",
        phone: "08011112222",
      });

      expect(result.success).toBe(true);

      // Verify updates
      const updatedUser = await db.getUserById(testUserId);
      expect(updatedUser?.name).toBe("Final Name");
      expect(updatedUser?.phone).toBe("08011112222");
    });

    it("should reject invalid phone number", async () => {
      const caller = appRouter.createCaller({
        user: { id: testUserId, openId: "test-profile-user", role: "user" },
      } as Context);

      await expect(
        caller.users.updateProfile({
          phone: "123", // Too short
        })
      ).rejects.toThrow();
    });

    it("should reject name that is too short", async () => {
      const caller = appRouter.createCaller({
        user: { id: testUserId, openId: "test-profile-user", role: "user" },
      } as Context);

      await expect(
        caller.users.updateProfile({
          name: "A", // Too short (< 2 characters)
        })
      ).rejects.toThrow();
    });

    it("should require authentication", async () => {
      const caller = appRouter.createCaller({
        user: null,
      } as Context);

      await expect(
        caller.users.updateProfile({
          name: "Hacker",
        })
      ).rejects.toThrow();
    });
  });
});
