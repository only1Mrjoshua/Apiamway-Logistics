/**
 * Payout Scheduler Tests
 *
 * Tests cover:
 * 1. runScheduledPayout calls processWeeklyPayouts and logs correctly
 * 2. Idempotency lock prevents concurrent double-execution
 * 3. notifyOwner failure does not break the scheduled run
 * 4. startPayoutScheduler / stopPayoutScheduler lifecycle (no-op on double-start)
 * 5. Manual trigger (processWeeklyPayouts called directly) coexists safely
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock weeklyPayout ────────────────────────────────────────────────────────
vi.mock("./weeklyPayout", () => ({
  processWeeklyPayouts: vi.fn(),
}));

// ─── Mock node-cron ───────────────────────────────────────────────────────────
const mockCronTask = {
  stop: vi.fn(),
};
vi.mock("node-cron", () => ({
  default: {
    schedule: vi.fn(() => mockCronTask),
  },
}));

import { processWeeklyPayouts } from "./weeklyPayout";
import cron from "node-cron";
import {
  runScheduledPayout,
  startPayoutScheduler,
  stopPayoutScheduler,
  isPayoutRunning,
  resetPayoutLock,
} from "./payoutScheduler";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makePayoutResult(overrides?: Record<string, unknown>) {
  return {
    success: true,
    batchDate: new Date(),
    payoutsSummary: [],
    totalAmount: 5000,
    totalOrders: 2,
    totalBlocked: 1,
    totalVoided: 0,
    errors: [],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("runScheduledPayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPayoutLock();
  });

  afterEach(() => {
    resetPayoutLock();
    stopPayoutScheduler();
  });

  // ── Calls processWeeklyPayouts ────────────────────────────────────────────
  it("calls processWeeklyPayouts once per invocation", async () => {
    vi.mocked(processWeeklyPayouts).mockResolvedValue(makePayoutResult() as any);

    await runScheduledPayout();

    expect(processWeeklyPayouts).toHaveBeenCalledOnce();
  });

  // ── Logs the [Payout Scheduler] start line ────────────────────────────────
  it("emits [Payout Scheduler] Weekly payout run started log", async () => {
    vi.mocked(processWeeklyPayouts).mockResolvedValue(makePayoutResult() as any);
    const consoleSpy = vi.spyOn(console, "log");

    await runScheduledPayout();

    const startLog = consoleSpy.mock.calls.find(
      (args) =>
        typeof args[0] === "string" &&
        args[0].includes("[Payout Scheduler]") &&
        args[0].includes("Weekly payout run started")
    );
    expect(startLog).toBeDefined();
  });

  // ── Logs the completion summary ───────────────────────────────────────────
  it("emits [Payout Scheduler] Run complete log with summary values", async () => {
    vi.mocked(processWeeklyPayouts).mockResolvedValue(
      makePayoutResult({ totalAmount: 9000, totalOrders: 3, totalBlocked: 2, totalVoided: 0 }) as any
    );
    const consoleSpy = vi.spyOn(console, "log");

    await runScheduledPayout();

    const completeLog = consoleSpy.mock.calls.find(
      (args) =>
        typeof args[0] === "string" &&
        args[0].includes("[Payout Scheduler]") &&
        args[0].includes("Run complete")
    );
    expect(completeLog).toBeDefined();
    const logLine = completeLog![0] as string;
    expect(logLine).toContain("totalPaid=9000.00");
    expect(logLine).toContain("processed=3");
    expect(logLine).toContain("blocked=2");
  });

  // ── Idempotency lock: second concurrent call is skipped ───────────────────
  it("skips a second call if the first is still running (idempotency lock)", async () => {
    let resolveFirst!: () => void;
    const firstRunPromise = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    vi.mocked(processWeeklyPayouts).mockImplementationOnce(async () => {
      await firstRunPromise;
      return makePayoutResult() as any;
    });

    const warnSpy = vi.spyOn(console, "warn");

    // Start first run (does not await yet)
    const firstRun = runScheduledPayout();

    // Immediately attempt second run while first is still in progress
    await runScheduledPayout();

    // processWeeklyPayouts should only have been called once
    expect(processWeeklyPayouts).toHaveBeenCalledOnce();

    // The warn log about skipping should be present
    const skipWarn = warnSpy.mock.calls.find(
      (args) =>
        typeof args[0] === "string" &&
        args[0].includes("[Payout Scheduler]") &&
        args[0].includes("still in progress")
    );
    expect(skipWarn).toBeDefined();

    // Release the first run
    resolveFirst();
    await firstRun;
  });

  // ── Lock is released after run completes ─────────────────────────────────
  it("releases the running lock after a successful run", async () => {
    vi.mocked(processWeeklyPayouts).mockResolvedValue(makePayoutResult() as any);

    await runScheduledPayout();

    expect(isPayoutRunning()).toBe(false);
  });

  // ── Lock is released even if processWeeklyPayouts throws ─────────────────
  it("releases the running lock even if processWeeklyPayouts throws", async () => {
    vi.mocked(processWeeklyPayouts).mockRejectedValueOnce(new Error("DB crash"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await runScheduledPayout();

    expect(isPayoutRunning()).toBe(false);
  });

  // ── processWeeklyPayouts error does not propagate ─────────────────────────
  it("does not throw if processWeeklyPayouts rejects", async () => {
    vi.mocked(processWeeklyPayouts).mockRejectedValueOnce(new Error("Fatal DB error"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(runScheduledPayout()).resolves.toBeUndefined();
  });
});

// ─── Scheduler lifecycle ──────────────────────────────────────────────────────
describe("startPayoutScheduler / stopPayoutScheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPayoutLock();
    stopPayoutScheduler(); // ensure clean state
  });

  afterEach(() => {
    stopPayoutScheduler();
  });

  // ── Registers cron job with correct expression and timezone ───────────────
  it("registers cron.schedule with Friday 08:00 expression and Africa/Lagos timezone", () => {
    startPayoutScheduler();

    expect(cron.schedule).toHaveBeenCalledOnce();
    const [expression, , options] = vi.mocked(cron.schedule).mock.calls[0];
    expect(expression).toBe("0 8 * * 5");
    expect((options as any)?.timezone).toBe("Africa/Lagos");
  });

  // ── Emits registration log ────────────────────────────────────────────────
  it("logs registration message on start", () => {
    const consoleSpy = vi.spyOn(console, "log");

    startPayoutScheduler();

    const regLog = consoleSpy.mock.calls.find(
      (args) =>
        typeof args[0] === "string" &&
        args[0].includes("[Payout Scheduler]") &&
        args[0].includes("Registered")
    );
    expect(regLog).toBeDefined();
    expect(regLog![0]).toContain("Africa/Lagos");
    expect(regLog![0]).toContain("0 8 * * 5");
  });

  // ── Double-start is a no-op ───────────────────────────────────────────────
  it("calling startPayoutScheduler twice does not register two cron jobs", () => {
    startPayoutScheduler();
    startPayoutScheduler(); // second call should be no-op

    expect(cron.schedule).toHaveBeenCalledOnce();
  });

  // ── stopPayoutScheduler calls task.stop() ─────────────────────────────────
  it("stopPayoutScheduler calls stop() on the scheduled task", () => {
    startPayoutScheduler();
    stopPayoutScheduler();

    expect(mockCronTask.stop).toHaveBeenCalledOnce();
  });

  // ── After stop, startPayoutScheduler can register again ──────────────────
  it("can re-register after stop", () => {
    startPayoutScheduler();
    stopPayoutScheduler();
    startPayoutScheduler();

    expect(cron.schedule).toHaveBeenCalledTimes(2);
  });
});

// ─── Manual trigger coexistence ───────────────────────────────────────────────
describe("Manual trigger coexistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPayoutLock();
  });

  afterEach(() => {
    resetPayoutLock();
    stopPayoutScheduler();
  });

  // ── Manual call to processWeeklyPayouts is independent of the lock ────────
  it("manual trigger (direct processWeeklyPayouts call) bypasses the scheduler lock", async () => {
    vi.mocked(processWeeklyPayouts).mockResolvedValue(makePayoutResult() as any);

    // Simulate a scheduled run in progress
    let resolveScheduled!: () => void;
    const scheduledRunning = new Promise<void>((r) => (resolveScheduled = r));
    vi.mocked(processWeeklyPayouts).mockImplementationOnce(async () => {
      await scheduledRunning;
      return makePayoutResult() as any;
    });

    const scheduledRun = runScheduledPayout(); // starts, holds lock

    // Manual trigger calls processWeeklyPayouts directly — no lock involved
    vi.mocked(processWeeklyPayouts).mockResolvedValue(makePayoutResult() as any);
    const manualResult = await processWeeklyPayouts();

    expect(manualResult.success).toBe(true);

    // Release scheduled run
    resolveScheduled();
    await scheduledRun;
  });

  // ── After scheduled run completes, manual trigger works normally ──────────
  it("manual trigger works normally after a scheduled run completes", async () => {
    vi.mocked(processWeeklyPayouts).mockResolvedValue(makePayoutResult() as any);

    await runScheduledPayout();
    expect(isPayoutRunning()).toBe(false);

    // Manual trigger
    const result = await processWeeklyPayouts();
    expect(result.success).toBe(true);
    expect(processWeeklyPayouts).toHaveBeenCalledTimes(2);
  });
});

// ─── Missed-run recovery: helper unit tests ───────────────────────────────────
import {
  getNowInWAT,
  isFridayAfterPayoutHour,
  checkMissedPayoutRun,
} from "./payoutScheduler";

// ─── Mock notifyOwner for missed-run tests ────────────────────────────────────
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));
import { notifyOwner } from "./_core/notification";

// ─── Helper: build a Date at a specific WAT day/hour ─────────────────────────
// WAT = UTC+1, so WAT hour H = UTC hour (H - 1).
function watDate(dayOfWeek: number, hour: number): Date {
  // Find the next occurrence of `dayOfWeek` at `hour` WAT from a known Monday.
  // We use a fixed Monday (2024-01-01 = Monday) as the epoch anchor.
  const MONDAY_UTC = new Date("2024-01-01T00:00:00Z"); // Monday
  const daysUntilTarget = (dayOfWeek - 1 + 7) % 7;    // days from Monday
  const utcHour = hour - 1;                             // WAT → UTC
  const d = new Date(MONDAY_UTC);
  d.setUTCDate(d.getUTCDate() + daysUntilTarget);
  d.setUTCHours(utcHour < 0 ? 23 : utcHour, 0, 0, 0);
  // If utcHour went negative (e.g. WAT 00:xx → UTC 23:xx the day before),
  // subtract one day to compensate.
  if (hour === 0) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

describe("getNowInWAT", () => {
  it("returns dayOfWeek=5 (Friday) for a Friday UTC date", () => {
    const friday = watDate(5, 10); // Friday 10:00 WAT
    const wat = getNowInWAT(friday);
    expect(wat.dayOfWeek).toBe(5);
    expect(wat.hour).toBe(10);
  });

  it("returns dayOfWeek=1 (Monday) for a Monday UTC date", () => {
    const monday = watDate(1, 9); // Monday 09:00 WAT
    const wat = getNowInWAT(monday);
    expect(wat.dayOfWeek).toBe(1);
    expect(wat.hour).toBe(9);
  });
});

describe("isFridayAfterPayoutHour", () => {
  it("returns true on Friday at 08:00 WAT", () => {
    const wat = getNowInWAT(watDate(5, 8));
    expect(isFridayAfterPayoutHour(wat)).toBe(true);
  });

  it("returns true on Friday at 14:00 WAT", () => {
    const wat = getNowInWAT(watDate(5, 14));
    expect(isFridayAfterPayoutHour(wat)).toBe(true);
  });

  it("returns false on Friday at 07:59 WAT (before payout hour)", () => {
    const wat = getNowInWAT(watDate(5, 7));
    expect(isFridayAfterPayoutHour(wat)).toBe(false);
  });

  it("returns false on Thursday at 10:00 WAT", () => {
    const wat = getNowInWAT(watDate(4, 10));
    expect(isFridayAfterPayoutHour(wat)).toBe(false);
  });

  it("returns false on Saturday at 10:00 WAT", () => {
    const wat = getNowInWAT(watDate(6, 10));
    expect(isFridayAfterPayoutHour(wat)).toBe(false);
  });
});

describe("checkMissedPayoutRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Not Friday → no alert ─────────────────────────────────────────────────
  it("does NOT alert when it is not Friday", async () => {
    const result = await checkMissedPayoutRun({
      nowOverride: watDate(4, 10), // Thursday 10:00 WAT
      pendingCount: 5,
    });
    expect(result.alerted).toBe(false);
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  // ── Friday before 08:00 → no alert ───────────────────────────────────────
  it("does NOT alert on Friday before 08:00 WAT", async () => {
    const result = await checkMissedPayoutRun({
      nowOverride: watDate(5, 7), // Friday 07:00 WAT
      pendingCount: 5,
    });
    expect(result.alerted).toBe(false);
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  // ── Friday after 08:00 but zero pending → no alert ────────────────────────
  it("does NOT alert on Friday after 08:00 WAT when there are no pending earnings", async () => {
    const result = await checkMissedPayoutRun({
      nowOverride: watDate(5, 10), // Friday 10:00 WAT
      pendingCount: 0,
    });
    expect(result.alerted).toBe(false);
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  // ── Friday after 08:00 with pending earnings → alert fires ───────────────
  it("alerts on Friday after 08:00 WAT when pending earnings exist", async () => {
    const result = await checkMissedPayoutRun({
      nowOverride: watDate(5, 10), // Friday 10:00 WAT
      pendingCount: 3,
    });
    expect(result.alerted).toBe(true);
    expect(notifyOwner).toHaveBeenCalledOnce();
    const [payload] = vi.mocked(notifyOwner).mock.calls[0];
    expect(payload.title).toContain("Missed");
    expect(payload.content).toContain("3");
    expect(payload.content).toContain("Admin → Testing Tools");
  });

  // ── Friday at exactly 08:00 WAT with pending earnings → alert fires ───────
  it("alerts at exactly 08:00 WAT on Friday with pending earnings", async () => {
    const result = await checkMissedPayoutRun({
      nowOverride: watDate(5, 8), // Friday 08:00 WAT exactly
      pendingCount: 1,
    });
    expect(result.alerted).toBe(true);
    expect(notifyOwner).toHaveBeenCalledOnce();
  });

  // ── notifyOwner failure is non-fatal ─────────────────────────────────────
  it("does not throw if notifyOwner rejects", async () => {
    vi.mocked(notifyOwner).mockRejectedValueOnce(new Error("Network error"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      checkMissedPayoutRun({
        nowOverride: watDate(5, 10),
        pendingCount: 2,
      })
    ).resolves.toMatchObject({ alerted: true });
  });

  // ── Warning log is emitted ────────────────────────────────────────────────
  it("emits [Payout Recovery Alert] warning log when alert fires", async () => {
    const warnSpy = vi.spyOn(console, "warn");

    await checkMissedPayoutRun({
      nowOverride: watDate(5, 10),
      pendingCount: 4,
    });

    const alertLog = warnSpy.mock.calls.find(
      (args) =>
        typeof args[0] === "string" &&
        args[0].includes("[Payout Recovery Alert]")
    );
    expect(alertLog).toBeDefined();
  });
});
