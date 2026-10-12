import "server-only"

import { count, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { bots } from "@/lib/db/schema"

import { usageTotal, usageTotals } from "./ledger"
import { meterOrder, type UsageMeter } from "./limits"
import { usagePeriod } from "./period"

/** How much of one meter the user has consumed this window. */
export async function meterUsage(
  userId: string,
  meter: UsageMeter,
  period: string = usagePeriod()
): Promise<number> {
  if (meter === "bots") {
    const [row] = await db
      .select({ total: count() })
      .from(bots)
      .where(eq(bots.userId, userId))

    return row?.total ?? 0
  }

  return usageTotal(db, userId, meter, period)
}

export type MeterReading = { meter: UsageMeter; used: number }

/**
 * Every meter for one window, in the order the usage page shows them. Two
 * queries total, because the page and the quota check both read the whole set.
 */
export async function readMeters(
  userId: string,
  period: string = usagePeriod()
): Promise<MeterReading[]> {
  const [totals, owned] = await Promise.all([
    usageTotals(db, userId, period),
    meterUsage(userId, "bots", period),
  ])

  const used: Record<UsageMeter, number> = {
    ai_tokens: totals.ai_tokens,
    sandbox_minutes: totals.sandbox_minutes,
    bots: owned,
  }

  return meterOrder.map((meter) => ({ meter, used: used[meter] }))
}
