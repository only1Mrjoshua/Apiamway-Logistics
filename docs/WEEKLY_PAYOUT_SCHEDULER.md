# Weekly Payout Scheduler

## Overview

The weekly payout scheduler automatically triggers `processWeeklyPayouts` every **Friday at 08:00 WAT** (West Africa Time, UTC+1). It is implemented as an in-process cron job using [node-cron](https://github.com/node-cron/node-cron) and starts automatically when the Express server boots.

---

## Scheduler Mechanism

| Property | Value |
|---|---|
| Library | `node-cron` v4 |
| Cron expression | `0 8 * * 5` |
| Timezone | `Africa/Lagos` (WAT, UTC+1, no DST) |
| Trigger day | Every Friday |
| Trigger time | 08:00 local WAT |
| Equivalent UTC | 07:00 UTC (Nigeria does not observe Daylight Saving Time) |
| Entry point | `server/payoutScheduler.ts` → `startPayoutScheduler()` |
| Registered in | `server/_core/index.ts` inside the `server.listen` callback |

The job is **in-process**: it runs inside the same Node.js process as the Express server. If the server process restarts, the scheduler restarts with it. There is no external cron daemon, no database-backed job queue, and no OS-level cron entry.

---

## Timezone Handling

Nigeria operates on WAT (UTC+1) year-round and does not observe Daylight Saving Time. The `Africa/Lagos` IANA timezone identifier is passed directly to `node-cron`'s `timezone` option, which uses the system's timezone database (via the `luxon` dependency bundled with node-cron v4) to resolve the correct UTC offset at fire time.

```ts
cron.schedule("0 8 * * 5", callback, { timezone: "Africa/Lagos" });
```

This means the job fires at **07:00 UTC every Friday**, regardless of the host server's local timezone.

---

## Idempotency

`processWeeklyPayouts` is idempotent by design: it queries only earnings with `status = 'pending'`. Once an earning is marked `'credited'` in a run, it will not be picked up again in any subsequent run on the same day or any future run.

An additional in-memory **running lock** (`isRunning` flag) in `payoutScheduler.ts` prevents a second concurrent execution if the first run is still in progress (e.g. due to a slow database response):

```
[Payout Scheduler] ⚠️  Previous run still in progress — skipping this trigger
```

The lock is released in a `finally` block, so it is always cleared even if `processWeeklyPayouts` throws.

---

## Logging

Every scheduled run emits the following log lines:

```
[Payout Scheduler] Weekly payout run started at <ISO timestamp>
[Payout Summary] totalPaid=..., processed=..., blocked=..., voided=...
[Payout Scheduler] Run complete — success=true, totalPaid=..., processed=..., blocked=..., voided=...
```

On server startup:

```
[Payout Scheduler] ✅ Registered — will fire every Friday at 08:00 WAT (Africa/Lagos). Cron: "0 8 * * 5"
```

---

## Manual Trigger (Admin)

The admin manual trigger remains fully operational and calls the same `processWeeklyPayouts` function. It is available at **Admin → Testing Tools** via the `payout.processWeeklyPayouts` tRPC procedure. Manual runs are safe to execute at any time alongside the scheduler because of the idempotency guarantee described above.

---

## Key Files

| File | Purpose |
|---|---|
| `server/payoutScheduler.ts` | Scheduler module: `startPayoutScheduler`, `stopPayoutScheduler`, `runScheduledPayout`, idempotency lock |
| `server/weeklyPayout.ts` | Core payout logic (unchanged by this patch) |
| `server/_core/index.ts` | Calls `startPayoutScheduler()` inside `server.listen` callback |
| `server/payoutScheduler.test.ts` | Unit tests for scheduler behaviour |

---

## Staging Test Steps

1. **Verify scheduler registration on startup.** Restart the dev server and check the logs for:
   ```
   [Payout Scheduler] ✅ Registered — will fire every Friday at 08:00 WAT (Africa/Lagos). Cron: "0 8 * * 5"
   ```

2. **Verify manual trigger still works.** Navigate to **Admin → Testing Tools**, click **Trigger Weekly Payout**, and confirm the payout summary notification arrives in the Manus notification inbox.

3. **Verify idempotency.** Trigger the manual payout twice in quick succession. The second call should find no pending earnings and return `totalOrders: 0` without double-crediting any wallet.

4. **Verify blocked-earnings count.** Cancel an order that has a pending earning, then trigger a manual payout. Confirm `blocked=1` appears in both the server log (`[Payout Summary]`) and the notification content.

5. **Verify scheduled fire time (optional, advanced).** Temporarily change the cron expression in `payoutScheduler.ts` to fire one minute from now (e.g. `"30 <HH> <MM> * * *"` matching current UTC+1 time), restart the server, and watch for the `[Payout Scheduler] Weekly payout run started` log line. Revert after verification.

---

## Limitations

Because the scheduler is in-process, it will not fire if the server process is down at 08:00 WAT on a Friday. In production, ensure the server process is kept alive via a process manager (e.g. PM2, systemd, or the Manus hosting platform's built-in process supervision). A missed Friday run can always be recovered by using the manual trigger from the Admin Testing Tools page.
