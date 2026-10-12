import { eq } from "drizzle-orm"

import type { Database } from "@/lib/db"
import { bots } from "@/lib/db/schema"

import { recordUsage } from "./ledger"
import { usagePeriod } from "./period"

/** The idle interval Daytona stops a sandbox after, and so the cap on one accrual. */
export const sandboxAutoStopMinutes = 15

/**
 * Adds the running time since the last touch to the ledger and moves the
 * cursor. One transaction, so a crash cannot accrue twice or move the cursor
 * without recording. Returns the minutes added.
 *
 * Like the ledger it writes to, this module does not import `server-only`: the
 * Trigger.dev task that works in a bot's sandbox runs outside Next and accrues
 * from there, so the database handle is passed in and each runtime keeps its
 * own pool.
 *
 * Metering is never a reason to throw. The caller is a tool call in a turn the
 * user is watching, and a missing row or a first touch simply accrues nothing.
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
      .select({ touchedAt: bots.sandboxTouchedAt })
      .from(bots)
      .where(eq(bots.id, input.botId))
      .for("update")

    if (!bot) {
      return 0
    }

    // A null cursor is the first touch: nothing has been running for us yet, so
    // there is nothing to bill and only the cursor to set.
    const cursor = bot.touchedAt
    const minutes = cursor
      ? Math.min(
          Math.floor((at.getTime() - cursor.getTime()) / 60_000),
          sandboxAutoStopMinutes
        )
      : 0

    await tx
      .update(bots)
      .set({ sandboxTouchedAt: at })
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
