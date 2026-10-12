import { auth } from "@clerk/nextjs/server"

import { UsageMeterCard } from "@/components/usage-meter-card"
import { Separator } from "@/components/ui/separator"
import { allowanceFor } from "@/lib/usage/limits"
import { readMeters } from "@/lib/usage/meters"
import { periodEnd, periodLabel, usagePeriod } from "@/lib/usage/period"

const dayMs = 24 * 60 * 60 * 1000

// The reset instant is absolute, so it is rendered in UTC. A reader east or
// west of Greenwich then sees the same day the quota is read against.
const resetFormat = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

/** Whole days from now to the reset, rounded up so a partial day still counts. */
function daysUntil(resetAt: Date): number {
  return Math.ceil((resetAt.getTime() - Date.now()) / dayMs)
}

export default async function Page() {
  const { userId, has } = await auth.protect()

  const period = usagePeriod()
  const readings = await readMeters(userId, period)

  const resetAt = periodEnd(period)
  const daysLeft = daysUntil(resetAt)
  const resetCopy = `Limits reset on ${resetFormat.format(resetAt)}. ${daysLeft} ${
    daysLeft === 1 ? "day" : "days"
  } left in this window.`
  // Nothing resets for an account holding no allowance, and saying otherwise on
  // the first of the month would be a promise this page cannot keep.
  const hasAllowance = readings.some(
    (reading) => allowanceFor(has, reading.meter) > 0
  )

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-medium">Usage</h1>
        <p className="text-sm text-muted-foreground">
          What this account has used in {periodLabel(period)}.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {readings.map((reading) => (
          <UsageMeterCard
            key={reading.meter}
            meter={reading.meter}
            used={reading.used}
            limit={allowanceFor(has, reading.meter)}
          />
        ))}
      </div>
      <Separator />
      <p className="text-sm text-muted-foreground">
        {hasAllowance
          ? resetCopy
          : "Every meter here is part of the Pro plan."}
      </p>
    </div>
  )
}
