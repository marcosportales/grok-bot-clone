import type { PaidFeature, SessionHas } from "@/lib/billing"
import type { UsageDimension } from "@/lib/db/schema"

/**
 * What we meter. `bots` is a live count of what the user holds, and the other
 * two are amounts accumulated in the ledger. The keys are the ledger's own
 * dimension names, so nothing maps one vocabulary onto another.
 */
export type UsageMeter = UsageDimension | "bots"

/** The order the usage page lists them in, the biggest cost driver first. */
export const meterOrder: UsageMeter[] = [
  "ai_tokens",
  "sandbox_minutes",
  "bots",
]

export const meterLabel: Record<UsageMeter, string> = {
  ai_tokens: "AI tokens",
  sandbox_minutes: "Sandbox time",
  bots: "Bots",
}

/**
 * Which billable capability a meter belongs to. AI turns run inside a bot, so a
 * token quota is a bot quota. This is what lets a quota refusal reuse the exact
 * shape and toast a plan refusal already uses.
 */
export const meterFeature: Record<UsageMeter, PaidFeature> = {
  ai_tokens: "bots",
  sandbox_minutes: "sandboxes",
  bots: "bots",
}

/**
 * The allowance per month for a session that holds the meter's capability. A
 * session that does not hold it gets zero, which is how the free plan reads
 * without a second table of numbers. Keyed by capability rather than by plan
 * slug so that adding a tier later changes this registry and nothing else.
 */
export const paidAllowance: Record<UsageMeter, number> = {
  ai_tokens: 1_000_000,
  sandbox_minutes: 600,
  bots: 3,
}

const count = new Intl.NumberFormat("en-US")

/**
 * What the reader should do about a spent meter, or when it comes back. The two
 * accumulated meters are monthly and return on their own, and the bots meter is
 * a cap on what is held, so waiting would never free a slot.
 */
export const meterNextStep: Record<UsageMeter, string> = {
  ai_tokens: "It resets at the start of next month.",
  sandbox_minutes: "It resets at the start of next month.",
  bots: "Delete a bot to free a slot.",
}

/**
 * The allowance a session actually has for one meter. The single rule behind
 * both the refusal and the progress bar, so the page can never show a limit
 * that enforcement disagrees with. A session without the capability has none.
 */
export function allowanceFor(has: SessionHas, meter: UsageMeter): number {
  return has({ feature: meterFeature[meter] }) ? paidAllowance[meter] : 0
}

/** What the user is told when a meter is spent. */
export const meterLimitMessage: Record<UsageMeter, (limit: number) => string> = {
  ai_tokens: (limit) =>
    `You have used all ${count.format(limit)} AI tokens for this month.`,
  sandbox_minutes: (limit) =>
    `You have used all ${count.format(limit)} minutes of sandbox time for this month.`,
  bots: (limit) => `You have reached your limit of ${count.format(limit)} bots.`,
}

/** Grouped for percentages and display, so both sides format the same way. */
export function formatAmount(value: number): string {
  return count.format(value)
}
