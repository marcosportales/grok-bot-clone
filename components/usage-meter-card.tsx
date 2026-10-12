import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  formatAmount,
  meterLabel,
  meterLimitMessage,
  type UsageMeter,
} from "@/lib/usage/limits"

// A full bar has to read as blocked rather than as nearly there, so a spent
// meter fills the track with the destructive token. The indicator is owned by
// the progress wrapper, which exposes no per-part className.
const spentIndicator = "[&_[data-slot=progress-indicator]]:bg-destructive"

type UsageMeterCardProps = {
  meter: UsageMeter
  used: number
  limit: number
}

/** A zero allowance has no ratio to take, so the bar stays empty. */
function fillPercent(used: number, limit: number): number {
  if (limit <= 0) {
    return 0
  }

  return Math.min(100, (used / limit) * 100)
}

function UsageMeterCard({ meter, used, limit }: UsageMeterCardProps) {
  const spent = limit > 0 && used >= limit

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{meterLabel[meter]}</CardTitle>
        <CardDescription>
          {limit > 0
            ? `${formatAmount(used)} of ${formatAmount(limit)} used`
            : "Part of the Pro plan"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Progress
          value={fillPercent(used, limit)}
          aria-label={meterLabel[meter]}
          className={spent ? spentIndicator : undefined}
        />
        {spent ? (
          <p className="text-sm text-destructive">
            {meterLimitMessage[meter](limit)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export { UsageMeterCard }
