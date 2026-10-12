import { and, eq, sql } from "drizzle-orm"

import type { Database } from "@/lib/db"
import { usageEvents, type UsageDimension } from "@/lib/db/schema"

import { usagePeriod } from "./period"

/**
 * Anything that can insert. A pool-backed `Database` and the `tx` inside
 * `db.transaction` both qualify, so the one place that knows how a ledger row is
 * shaped serves the plain writes and the transactional ones alike.
 */
type LedgerWriter = Pick<Database, "insert">

/**
 * The only writer of the ledger. It deliberately does not import `server-only`,
 * because the Trigger.dev task that meters AI tokens runs outside Next and
 * shares this module. The database handle is passed in so each runtime keeps
 * its own pool.
 */
export async function recordUsage(
  db: LedgerWriter,
  input: {
    userId: string
    dimension: UsageDimension
    quantity: number
    costMicros?: number
    /** Retried writes with the same key land once. */
    dedupeKey: string
    at?: Date
  }
): Promise<void> {
  const quantity = Math.round(input.quantity)

  if (quantity <= 0) {
    return
  }

  await db
    .insert(usageEvents)
    .values({
      userId: input.userId,
      dimension: input.dimension,
      quantity,
      costMicros: Math.max(0, Math.round(input.costMicros ?? 0)),
      period: usagePeriod(input.at),
      dedupeKey: input.dedupeKey,
      ...(input.at ? { occurredAt: input.at } : {}),
    })
    .onConflictDoNothing({ target: usageEvents.dedupeKey })
}

/** Everything accumulated in one dimension for one window. */
export async function usageTotal(
  db: Database,
  userId: string,
  dimension: UsageDimension,
  period: string = usagePeriod()
): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${usageEvents.quantity}), 0)::int` })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.userId, userId),
        eq(usageEvents.period, period),
        eq(usageEvents.dimension, dimension)
      )
    )

  return row?.total ?? 0
}

/** Every accumulated dimension for one window, in one query. */
export async function usageTotals(
  db: Database,
  userId: string,
  period: string = usagePeriod()
): Promise<Record<UsageDimension, number>> {
  const rows = await db
    .select({
      dimension: usageEvents.dimension,
      total: sql<number>`coalesce(sum(${usageEvents.quantity}), 0)::int`,
    })
    .from(usageEvents)
    .where(
      and(eq(usageEvents.userId, userId), eq(usageEvents.period, period))
    )
    .groupBy(usageEvents.dimension)

  const totals: Record<UsageDimension, number> = {
    ai_tokens: 0,
    sandbox_minutes: 0,
  }

  for (const row of rows) {
    totals[row.dimension] = row.total
  }

  return totals
}
