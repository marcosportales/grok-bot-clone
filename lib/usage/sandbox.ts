import { eq } from "drizzle-orm"

import type { Database } from "@/lib/db"
import { bots } from "@/lib/db/schema"

import { recordUsage } from "./ledger"
import { usagePeriod } from "./period"

/**
 * The idle interval Daytona stops a sandbox after, and so the cap on one accrual.
 *
 * Observed rather than assumed. `scripts/sandbox-autostop-probe.ts` creates a
 * sandbox at this interval, touches it once, and then reads `state` and
 * `lastActivityAt` back through the Daytona list API without touching it again.
 * At 900s of idle the sandbox still read as started, at 924s it read as stopped,
 * and its own stop timestamp landed at 918.5s, which is 18.5s past the 900s it
 * was given and never early. `docs/daytona-autostop/` holds that timeline, a
 * compressed one at 2 minutes, and the same measurement taken from a sandbox the
 * app created itself rather than the probe, where the overshoot was 12s.
 *
 * The reads do not disturb what they measure, and those artifacts are the
 * evidence for that rather than the SDK's docs: `lastActivityAt` did not move
 * across the 39 and 67 reads of those runs, and moved once in each, when the
 * sandbox stopped. A second sandbox left unread until the end of a run was
 * stopped as well.
 *
 * The overshoot is what one accrual can be wrong by, and it runs in the
 * direction that under-charges: a gap past this interval bills as exactly this
 * many minutes while the sandbox may have run up to twenty seconds more. The
 * accrual is exact only while the number here is the number `lib/sandbox.ts`
 * hands Daytona, so the two move together. If they ever cannot, a stopped
 * sandbox carries its own stop instant in `lastActivityAt`, which is where a
 * meter would read the truth from.
 */
export const sandboxAutoStopMinutes = 15

/**
 * Adds the whole minutes the sandbox has run since the cursor to the ledger and
 * advances the cursor by them, so the part under a minute stays on the cursor
 * and accrues in the next window. One transaction, so a crash cannot accrue
 * twice or move the cursor without recording. Returns the minutes added.
 *
 * Like the ledger it writes to, this module does not import `server-only`: the
 * Trigger.dev task that works in a bot's sandbox runs outside Next and accrues
 * from there, so the database handle is passed in and each runtime keeps its
 * own pool.
 *
 * Metering is never a reason to throw. The caller is a tool call in a turn the
 * user is watching, and a missing row simply accrues nothing.
 */
export async function accrueSandboxTime(
  db: Database,
  input: {
    botId: string
    userId: string
    at?: Date
  }
): Promise<number> {
  const at = input.at ?? new Date()

  return db.transaction(async (tx) => {
    const [bot] = await tx
      .select({ touchedAt: bots.sandboxTouchedAt, createdAt: bots.createdAt })
      .from(bots)
      .where(eq(bots.id, input.botId))
      .for("update")

    if (!bot) {
      return 0
    }

    // A bot with no cursor has been running since it was created: the sandbox
    // is started and written to before the row exists, so creation opens its
    // window, not the first touch.
    const cursor = bot.touchedAt ?? bot.createdAt
    // Time only moves forward. A touch reads `at` before it takes the row lock,
    // so two tool calls running at once can arrive out of order, and a cursor
    // that retreats bills the overlap a second time.
    const gapMs = Math.max(0, at.getTime() - cursor.getTime())
    const minutes = Math.min(Math.floor(gapMs / 60_000), sandboxAutoStopMinutes)

    // A window at or past the auto-stop interval means the sandbox stopped on
    // its own partway through it, so `at` is the right start for the next one and
    // the tail of this window is not ours to bill. Under the cap the sandbox ran
    // the whole gap, so only the whole minutes billed move the cursor and the
    // remainder under a minute accrues in the next window instead of being lost.
    const nextCursor =
      minutes === sandboxAutoStopMinutes
        ? at
        : new Date(cursor.getTime() + minutes * 60_000)

    await tx
      .update(bots)
      .set({ sandboxTouchedAt: nextCursor })
      .where(eq(bots.id, input.botId))

    if (minutes > 0) {
      await recordUsage(tx, {
        userId: input.userId,
        dimension: "sandbox_minutes",
        quantity: minutes,
        // Daytona's own price list is not something this app is given, so the
        // minutes are recorded and no cost is invented for them.
        costMicros: 0,
        dedupeKey: `sandbox:${input.botId}:${usagePeriod(at)}:${at.toISOString()}`,
        at,
      })
    }

    return minutes
  })
}
