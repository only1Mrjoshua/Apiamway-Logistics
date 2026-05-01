/**
 * Payout Scheduler
 *
 * Automatically triggers processWeeklyPayouts every Friday at 08:00 WAT
 * (Africa/Lagos, UTC+1 year-round — Nigeria does not observe DST).
 *
 * Also performs a missed-run recovery check on every server startup:
 * if it is Friday after 08:00 WAT and there are still pending earnings,
 * it fires a notifyOwner alert asking the admin to trigger the payout
 * manually. It does NOT run the payout automatically.
 *
 * Implementation notes
 * ────────────────────
 * • Uses node-cron (in-process scheduler). The job lives inside the Express
 *   server process; it starts when the server starts and stops when the
 *   process exits.
 * • Idempotency is guaranteed by processWeeklyPayouts itself: it only
 *   processes earnings whose status is 'pending'. A second run on the same
 *   Friday will find no pending earnings and exit cleanly.
 * • The manual admin trigger (payout.processWeeklyPayouts tRPC procedure)
 *   calls the same function and is completely safe to use alongside this
 *   scheduler.
 *
 * Cron expression: 0 8 * * 5
 *   ┌─ second (0)
 *   │ ┌─ minute (0)
 *   │ │ ┌─ hour (8 = 08:00)
 *   │ │ │ ┌─ day-of-month (*)
 *   │ │ │ │ ┌─ month (*)
 *   │ │ │ │ │ ┌─ day-of-week (5 = Friday)
 *   0 8 * * 5
 *
 * Timezone: Africa/Lagos (WAT, UTC+1, no DST).
 */

import cron from "node-cron";
import { eq } from "drizzle-orm";
import { processWeeklyPayouts } from "./weeklyPayout";
import { getDb } from "./db";
import { partnerEarnings } from "../drizzle/schema";
import { notifyOwner } from "./_core/notification";

// ─── Constants ────────────────────────────────────────────────────────────────
const WAT_OFFSET_HOURS = 1; // UTC+1, no DST
const PAYOUT_HOUR_WAT = 8;  // 08:00 WAT
const FRIDAY_DOW = 5;        // 0=Sun … 5=Fri … 6=Sat

// ─── Idempotency lock ─────────────────────────────────────────────────────────
// Prevents a second concurrent run if the first is still executing (e.g. slow DB).
let isRunning = false;

// ─── Helpers (exported for testing) ──────────────────────────────────────────

/**
 * Returns the current date/time expressed in WAT (UTC+1).
 * Accepts an optional `now` parameter so tests can inject a fixed clock.
 */
export function getNowInWAT(now: Date = new Date()): {
  dayOfWeek: number; // 0=Sun … 6=Sat
  hour: number;      // 0-23 in WAT
  isoString: string;
} {
  const watMs = now.getTime() + WAT_OFFSET_HOURS * 60 * 60 * 1000;
  const watDate = new Date(watMs);
  return {
    dayOfWeek: watDate.getUTCDay(),
    hour: watDate.getUTCHours(),
    isoString: watDate.toISOString().replace("Z", "+01:00"),
  };
}

/**
 * Returns true when the given WAT snapshot is Friday at or after 08:00.
 */
export function isFridayAfterPayoutHour(wat: ReturnType<typeof getNowInWAT>): boolean {
  return wat.dayOfWeek === FRIDAY_DOW && wat.hour >= PAYOUT_HOUR_WAT;
}

/**
 * Counts how many earnings currently have status = 'pending'.
 * Returns 0 if the database is unavailable.
 */
export async function countPendingEarnings(): Promise<number> {
  try {
    const database = await getDb();
    if (!database) return 0;
    const rows = await database
      .select({ id: partnerEarnings.id })
      .from(partnerEarnings)
      .where(eq(partnerEarnings.status, "pending"));
    return rows.length;
  } catch {
    return 0;
  }
}

/**
 * Missed-run recovery check.
 *
 * Runs on server startup (called from startPayoutScheduler).
 * If it is Friday after 08:00 WAT and there are pending earnings,
 * emits a warning log and a notifyOwner alert.
 * DOES NOT execute the payout automatically.
 *
 * Accepts optional overrides for unit testing:
 *   nowOverride  — inject a fixed Date instead of Date.now()
 *   pendingCount — inject a pending-earnings count instead of querying the DB
 */
export async function checkMissedPayoutRun(opts?: {
  nowOverride?: Date;
  pendingCount?: number;
}): Promise<{ alerted: boolean; reason: string }> {
  const wat = getNowInWAT(opts?.nowOverride);

  if (!isFridayAfterPayoutHour(wat)) {
    return { alerted: false, reason: "Not Friday after 08:00 WAT — no check needed" };
  }

  const pending =
    opts?.pendingCount !== undefined
      ? opts.pendingCount
      : await countPendingEarnings();

  if (pending === 0) {
    return {
      alerted: false,
      reason: "Friday after 08:00 WAT but no pending earnings — payout already ran or nothing to process",
    };
  }

  // ── Missed run detected ───────────────────────────────────────────────────
  const msg =
    `[Payout Recovery Alert] ⚠️  Possible missed Friday payout detected. ` +
    `WAT time: ${wat.isoString}, pending earnings: ${pending}. ` +
    `Please trigger the payout manually from Admin → Testing Tools.`;

  console.warn(msg);

  try {
    await notifyOwner({
      title: "Weekly Payout May Have Been Missed",
      content:
        `A possible missed Friday payout was detected on server startup.\n\n` +
        `Current WAT time: ${wat.isoString}\n` +
        `Pending earnings awaiting payout: ${pending}\n\n` +
        `The scheduled job may not have run (e.g. server was restarted after 08:00 WAT).\n\n` +
        `Please go to Admin → Testing Tools and click "Trigger Weekly Payout" to process these earnings manually.`,
    });
  } catch (err) {
    console.warn("[Payout Recovery Alert] notifyOwner failed (non-fatal):", err);
  }

  return { alerted: true, reason: msg };
}

// ─── Scheduled payout runner ──────────────────────────────────────────────────

export async function runScheduledPayout(): Promise<void> {
  if (isRunning) {
    console.warn(
      "[Payout Scheduler] ⚠️  Previous run still in progress — skipping this trigger to prevent double-processing"
    );
    return;
  }

  isRunning = true;
  console.log(
    `[Payout Scheduler] Weekly payout run started at ${new Date().toISOString()}`
  );

  try {
    const result = await processWeeklyPayouts();
    console.log(
      `[Payout Scheduler] Run complete — success=${result.success}, ` +
        `totalPaid=${result.totalAmount.toFixed(2)}, ` +
        `processed=${result.totalOrders}, ` +
        `blocked=${result.totalBlocked}, ` +
        `voided=${result.totalVoided}`
    );
  } catch (err) {
    console.error("[Payout Scheduler] ❌ Unexpected error during scheduled run:", err);
  } finally {
    isRunning = false;
  }
}

// ─── Scheduler lifecycle ──────────────────────────────────────────────────────

let scheduledTask: ReturnType<typeof cron.schedule> | null = null;

/**
 * Start the weekly payout cron job and run the missed-run recovery check.
 * Call once from server startup. Safe to call multiple times — subsequent
 * calls are no-ops if the job is already scheduled.
 */
export function startPayoutScheduler(): void {
  if (scheduledTask) {
    console.log("[Payout Scheduler] Already started — skipping duplicate registration");
    return;
  }

  // Every Friday at 08:00 WAT (Africa/Lagos)
  const CRON_EXPRESSION = "0 8 * * 5";
  const TIMEZONE = "Africa/Lagos";

  scheduledTask = cron.schedule(
    CRON_EXPRESSION,
    () => {
      void runScheduledPayout();
    },
    {
      timezone: TIMEZONE,
    }
  );

  console.log(
    `[Payout Scheduler] ✅ Registered — will fire every Friday at 08:00 WAT (${TIMEZONE}). ` +
      `Cron: "${CRON_EXPRESSION}"`
  );

  // Run the missed-run recovery check asynchronously (non-blocking startup).
  void checkMissedPayoutRun().then(({ alerted, reason }) => {
    if (!alerted) {
      console.log(`[Payout Recovery Alert] No missed run detected — ${reason}`);
    }
  });
}

/**
 * Stop the scheduler (used in tests and graceful shutdown).
 */
export function stopPayoutScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[Payout Scheduler] Stopped");
  }
}

/**
 * Expose the running-lock state for tests.
 */
export function isPayoutRunning(): boolean {
  return isRunning;
}

/**
 * Reset the running lock (test helper only).
 */
export function resetPayoutLock(): void {
  isRunning = false;
}
