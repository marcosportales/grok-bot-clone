import { eq } from "drizzle-orm"

import type { Database } from "@/lib/db"
import { bots } from "@/lib/db/schema"

import { recordUsage } from "./ledger"
import { usagePeriod } from "./period"

/** The idle interval Daytona stops a sandbox after, and so the cap on one accrual. */
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
