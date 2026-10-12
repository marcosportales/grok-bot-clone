import "server-only"

import type { SessionHas, UpgradeRequired } from "@/lib/billing"

import {
  allowanceFor,
  meterFeature,
  meterLimitMessage,
  meterNextStep,
  type UsageMeter,
} from "./limits"
import { meterUsage } from "./meters"
import { usagePeriod } from "./period"

/**
 * Refuses an action whose meter is spent for this window. The allowance follows
 * the capability the session already holds, so a session without it has an
 * allowance of zero and no separate number to keep in step.
 *
 * Call this after the plan gate, never instead of it. A user who is not paying
 * should hear that the capability is part of the plan, not that they have run
 * out of an allowance they never had.
 */
export async function missingAllowance(
  has: SessionHas,
  userId: string,
  meter: UsageMeter,
  period: string = usagePeriod()
): Promise<UpgradeRequired | null> {
  const limit = allowanceFor(has, meter)
  const used = await meterUsage(userId, meter, period)

  if (used < limit) {
    return null
  }

  return {
    ok: false,
    // The limit is the headline, and the reset is the thing the reader wants to
    // know next, so the title states the amount and the description says when
    // it comes back.
    title: meterLimitMessage[meter](limit),
    error: meterNextStep[meter],
    upgrade: meterFeature[meter],
  }
}
