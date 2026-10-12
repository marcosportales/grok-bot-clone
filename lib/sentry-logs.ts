import type * as Sentry from "@sentry/node"

type ConsoleLogLevels = NonNullable<
  NonNullable<Parameters<typeof Sentry.consoleLoggingIntegration>[0]>["levels"]
>

const levelFloor: ConsoleLogLevels = ["warn", "error"]

export const consoleLogLevels: ConsoleLogLevels =
  process.env.NODE_ENV === "production" ? levelFloor : [...levelFloor, "info", "log"]

// The browser also carries third-party console noise, so it stays at errors.
export const browserConsoleLogLevels: ConsoleLogLevels = ["error"]

const maxValueLength = 16_000

const sensitiveKey =
  /(password|token|secret|api[_-]?key|authorization|cookie|prompt|transcript|screenshot|payload|body|query|params|content)/i

function isTooLong(value: unknown, depth = 0): boolean {
  if (typeof value === "string") {
    return value.length > maxValueLength
  }

  if (depth > 5 || typeof value !== "object" || value === null) {
    return false
  }

  return Object.values(value as Record<string, unknown>).some((nested) => isTooLong(nested, depth + 1))
}

function hasSensitiveKey(value: unknown, depth = 0): boolean {
  if (depth > 5 || typeof value !== "object" || value === null) {
    return false
  }

  return Object.entries(value as Record<string, unknown>).some(
    ([key, nested]) => sensitiveKey.test(key) || hasSensitiveKey(nested, depth + 1)
  )
}

export function beforeSendLog(log: Sentry.Log): Sentry.Log | null {
  if (isTooLong(log.message) || isTooLong(log.attributes) || hasSensitiveKey(log.attributes)) {
    return null
  }

  return log
}

export function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error
}
