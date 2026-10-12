/**
 * Read-only report on the usage ledger, for a reviewer who wants to check the
 * claims without driving the browser.
 *
 *   node scripts/usage-report.mjs
 *
 * It prints the meters for the current window and asserts the invariants the
 * ledger is supposed to hold. Exits non-zero on a violated invariant, so it can
 * be used as a gate.
 */
// `@next/env` is CommonJS, and plain node ESM cannot take a named export from it.
import nextEnv from "@next/env"
import { Client } from "pg"

const { loadEnvConfig } = nextEnv

loadEnvConfig(process.cwd())

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL

if (!url) {
  throw new Error("DATABASE_URL is not set")
}

// Mirrors `sandboxAutoStopMinutes`. A local constant rather than an import so
// this stays runnable with plain node, without a TypeScript loader.
const sandboxAutoStopMinutes = 15

const period = new Date().toISOString().slice(0, 7)
const failures = []

function check(ok, label) {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`)

  if (!ok) {
    failures.push(label)
  }
}

const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await db.connect()

console.log(`window ${period}\n`)

const totals = await db.query(
  `select dimension, count(*)::int as events, sum(quantity)::int as quantity, sum(cost_micros)::int as micros
     from usage_events where period = $1 group by dimension order by dimension`,
  [period]
)

for (const row of totals.rows) {
  console.log(
    `meter ${row.dimension}: ${row.quantity} over ${row.events} events, ${row.micros} micro-USD`
  )
}

if (totals.rows.length === 0) {
  console.log("meter: nothing recorded in this window")
}

const held = await db.query(
  `select user_id, count(*)::int as bots, count(sandbox_id)::int as sandboxes
     from bots group by user_id order by bots desc`
)

for (const row of held.rows) {
  console.log(`bots held by ${row.user_id}: ${row.bots}, with a sandbox: ${row.sandboxes}`)
}

console.log("")

const negatives = await db.query(
  "select count(*)::int as n from usage_events where quantity < 0 or cost_micros < 0"
)
check(negatives.rows[0].n === 0, "no negative quantity or cost")

const dupes = await db.query(
  "select count(*)::int as n from (select dedupe_key from usage_events group by dedupe_key having count(*) > 1) as d"
)
check(dupes.rows[0].n === 0, "every dedupe key appears once")

const misdated = await db.query(
  "select count(*)::int as n from usage_events where period <> to_char(occurred_at at time zone 'UTC', 'YYYY-MM')"
)
check(misdated.rows[0].n === 0, "every period matches the UTC month of its event")

const overcapped = await db.query(
  "select count(*)::int as n, max(quantity)::int as worst from usage_events where dimension = 'sandbox_minutes'"
)
check(
  (overcapped.rows[0].worst ?? 0) <= sandboxAutoStopMinutes,
  `no sandbox accrual above the ${sandboxAutoStopMinutes} minute auto-stop interval`
)

const noCost = await db.query(
  "select count(*)::int as n from usage_events where dimension = 'ai_tokens' and quantity > 0 and cost_micros = 0"
)
console.log(
  `${noCost.rows[0].n === 0 ? "note" : "warn"} ${noCost.rows[0].n} billable token rows priced at zero ` +
    "(a model the catalog cannot price counts tokens but no dollars)"
)

await db.end()

if (failures.length > 0) {
  console.error(`\n${failures.length} invariant(s) violated`)
  process.exit(1)
}

console.log("\nall invariants hold")
