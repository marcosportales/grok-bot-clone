/**
 * Checks the sandbox accrual cursor against a real ledger, for a reviewer who
 * wants to re-run the acceptance cases without driving the browser.
 *
 *   node scripts/sandbox-accrual-check.ts
 *
 * Every case inserts a bot, walks a table of touches through the real
 * `accrueSandboxTime`, and reads the cursor and the `usage_events` rows back out
 * of Postgres. It runs from the repository root and needs `DATABASE_URL`.
 *
 * The whole run is one transaction that ends in a rollback, so it leaves nothing
 * behind and can be run as often as needed. It exits non-zero on a failed case,
 * so it can be used as a gate.
 */
import "./lib/ts-hooks.ts"

import type { Database } from "@/lib/db"

const { db } = await import("@/lib/db")
const { accrueSandboxTime, sandboxAutoStopMinutes } =
  await import("@/lib/usage/sandbox")
const { bots, usageEvents } = await import("@/lib/db/schema")
const { eq } = await import("drizzle-orm")

/** A touch: when it lands, what it should bill, and where the cursor should sit. */
type Touch = {
  /** Milliseconds after the bot's `createdAt`. */
  at: number
  billed: number
  /** Milliseconds after the bot's `createdAt`, or null for "still unset". */
  cursor: number | null
}

type Case = {
  name: string
  touches: Touch[]
}

const probeUser = "probe:mar-212"

// The bot from the issue, created at 22:21:11.389 with its sandbox started and
// touched at the four instants it records. It billed one minute before this
// change and should bill two.
const issueTranscript: Case = {
  name: "issue transcript: 71.3s, 19.4s, 51.6s, 27.3s",
  touches: [
    { at: 71_281, billed: 1, cursor: 60_000 },
    { at: 90_711, billed: 0, cursor: 60_000 },
    { at: 142_299, billed: 1, cursor: 120_000 },
    { at: 169_599, billed: 0, cursor: 120_000 },
  ],
}

const cases: Case[] = [
  issueTranscript,
  {
    name: "two touches 50s apart",
    touches: [
      { at: 50_000, billed: 0, cursor: 0 },
      { at: 100_000, billed: 1, cursor: 60_000 },
    ],
  },
  {
    name: "a turn of ten tool calls 30s apart",
    touches: Array.from({ length: 10 }, (_, index) => ({
      at: (index + 1) * 30_000,
      billed: index % 2,
      cursor: Math.floor((index + 1) / 2) * 60_000,
    })),
  },
  {
    name: "a window past the auto-stop cap, then one more",
    touches: [
      { at: 960_000, billed: sandboxAutoStopMinutes, cursor: 960_000 },
      { at: 1_025_000, billed: 1, cursor: 1_020_000 },
    ],
  },
  {
    name: "a touch that lands behind the cursor",
    touches: [
      { at: 70_000, billed: 1, cursor: 60_000 },
      { at: 55_900, billed: 0, cursor: 60_000 },
      { at: 130_000, billed: 1, cursor: 120_000 },
    ],
  },
]

const failures: string[] = []
const rollback = new Error("probe rollback")

function check(ok: boolean, label: string) {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`)

  if (!ok) {
    failures.push(label)
  }
}

function ms(at: number): string {
  return `${(at / 1000).toFixed(3)}s`
}

const createdAt = new Date("2026-10-12T22:21:11.389Z")

console.log(
  `sandbox accrual check, cursor at creation ${createdAt.toISOString()}`
)
console.log(`cap ${sandboxAutoStopMinutes} min\n`)

await db
  .transaction(async (tx) => {
    for (const [index, testCase] of cases.entries()) {
      const botId = `probe-mar212-${index}`
      const started = Date.now()

      await tx.insert(bots).values({
        id: botId,
        userId: probeUser,
        name: `probe ${index}`,
        job: "probe",
        createdAt,
      })

      // `accrueSandboxTime` opens its own transaction, so the probe hands it this
      // one and rolls the whole run back at the end.
      const accrual = tx as unknown as Database

      console.log(testCase.name)

      for (const [touchIndex, touch] of testCase.touches.entries()) {
        const at = new Date(createdAt.getTime() + touch.at)
        const billed = await accrueSandboxTime(accrual, {
          botId,
          userId: probeUser,
          at,
        })
        const [bot] = await tx
          .select({ cursor: bots.sandboxTouchedAt })
          .from(bots)
          .where(eq(bots.id, botId))
        const cursor = bot?.cursor
          ? bot.cursor.getTime() - createdAt.getTime()
          : null
        const wanted = touch.cursor

        console.log(
          `  touch ${touchIndex + 1} at ${ms(touch.at)}: billed ${billed}, cursor ${cursor === null ? "unset" : ms(cursor)}`
        )

        check(
          billed === touch.billed,
          `  ${testCase.name} bills ${touch.billed} at ${ms(touch.at)}, got ${billed}`
        )
        check(
          cursor === wanted,
          `  ${testCase.name} leaves the cursor at ${wanted === null ? "unset" : ms(wanted)} at ${ms(touch.at)}, got ${cursor === null ? "unset" : ms(cursor)}`
        )
      }

      const rows = await tx
        .select({
          quantity: usageEvents.quantity,
          dedupeKey: usageEvents.dedupeKey,
        })
        .from(usageEvents)
        .where(eq(usageEvents.userId, probeUser))
        .orderBy(usageEvents.occurredAt)
      const mine = rows.filter((row) =>
        row.dedupeKey.startsWith(`sandbox:${botId}:`)
      )
      const billed = mine.map((row) => row.quantity)
      const expected = testCase.touches
        .map((touch) => touch.billed)
        .filter((quantity) => quantity > 0)

      console.log(
        `  ledger rows ${billed.length} (${billed.join("+") || "none"}), expected ${expected.join("+") || "none"} in ${Date.now() - started}ms\n`
      )

      check(
        billed.join("+") === expected.join("+"),
        `  ${testCase.name} bills ${expected.reduce((total, quantity) => total + quantity, 0)} minutes, one row per billed touch`
      )
    }

    throw rollback
  })
  .catch((error: unknown) => {
    if (error !== rollback) {
      throw error
    }
  })

const left = await db
  .select({ id: bots.id })
  .from(bots)
  .where(eq(bots.userId, probeUser))

check(left.length === 0, "the probe leaves no bot rows behind")

console.log("")
if (failures.length > 0) {
  console.error(`${failures.length} check(s) failed`)
  process.exit(1)
}

console.log("all checks passed")
process.exit(0)
