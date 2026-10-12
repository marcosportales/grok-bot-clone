/**
 * The quota window. A calendar month in UTC, as a key that sorts and groups:
 * "2026-10". A month rather than the subscription period on purpose. The dev
 * subscription is annual, so a period-shaped window would allow a year of
 * consumption and its reset would read as hundreds of days, and a calendar
 * month also survives a cancel and resubscribe.
 */
export function usagePeriod(at: Date = new Date()): string {
  return at.toISOString().slice(0, 7)
}

/** The instant the period ends, which is the first instant of the next one. */
export function periodEnd(period: string): Date {
  const [year, month] = period.split("-").map(Number)

  return new Date(Date.UTC(year, month, 1))
}

export function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number)

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}
