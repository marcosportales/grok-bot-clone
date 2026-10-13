/**
 * Observes whether Daytona stops an idle sandbox at the `autoStopInterval` it
 * was given, and whether the sandbox meter charges the lifetime that was
 * observed. The meter is exact only while both hold, and neither is checkable
 * from the shared constant alone.
 *
 *   node scripts/sandbox-autostop-probe.ts
 *   node scripts/sandbox-autostop-probe.ts --minutes 2 --out /tmp/mar-189-2m.json
 *
 * Two sandboxes are created at the interval. The first is polled, which is what
 * yields the transition window. The second is read once, at the end, so that a
 * poll-driven timer reset would show up as the polled sandbox outliving it
 * instead of quietly invalidating the run. `--solo` drops the second, for an
 * account with no room for it. Observation goes through `list`, never `get`,
 * because the SDK counts an interaction with the sandbox as activity and `get`
 * is the app's own touch. Whether that mattered is measured rather than assumed:
 * `lastActivityAt` holds one value across the reads and moves only when the
 * sandbox stops, and the untouched control sandbox is stopped too.
 *
 * Two facts are reported. One is measured, and one is the precondition it needs.
 * Whether the sandbox's own stop instant is at or after the interval it was
 * given, and whether the cap being charged against is the interval that was
 * handed to Daytona. What the ledger charged against the runtime is printed
 * beside them as the consequence that it is, not as a third observation: with
 * the cap equal to the interval, a charge above the runtime would contradict the
 * stop instant rather than be a separate finding.
 *
 * The polled sandbox is then woken the way the app wakes one, and the meter is
 * run over the observed window in a transaction that rolls back. Needs
 * `DAYTONA_API_KEY`; the meter half is skipped when `DATABASE_URL` is absent.
 * Both sandboxes are deleted at the end unless `--keep` is passed.
 */
import "./lib/ts-hooks.ts"

import { writeFileSync } from "node:fs"
import { parseArgs } from "node:util"

import { Daytona, SandboxState, type Sandbox } from "@daytona/sdk"

const { values } = parseArgs({
  options: {
    minutes: { type: "string" },
    out: { type: "string" },
    step: { type: "string" },
    deadline: { type: "string" },
    solo: { type: "boolean" },
    keep: { type: "boolean" },
  },
})

const { sandboxAutoStopMinutes, accrueSandboxTime } =
  await import("@/lib/usage/sandbox")
const { writeMemory } = await import("@/lib/memory")

const minutes = Number(values.minutes ?? sandboxAutoStopMinutes)
const stepSeconds = Number(values.step ?? 15)
// The compressed run still has to reach the ten minute reading the issue asks
// for, so the deadline is whichever is later: that reading, or two minutes past
// the interval so the expected stop lands inside the window. Polling continues
// past the stop, so one run carries the readings at 1, 3 and 10 minutes as well
// as the window the transition was seen in.
const deadlineMinutes = Number(values.deadline) || Math.max(10, minutes + 2)

const daytona = new Daytona({
  apiKey: process.env.DAYTONA_API_KEY,
  apiUrl: process.env.DAYTONA_API_URL,
})

type Sample = {
  elapsedSeconds: number
  readAt: string
  state: string
  lastActivityAt: string | null
}

type Timeline = {
  intervalMinutes: number
  productionIntervalMinutes: number
  deadlineMinutes: number
  polled: {
    id: string
    anchorAt: string
    samples: Sample[]
    stoppedAtSeconds: number | null
    stopWindowSeconds: [number, number] | null
    stopStampedSeconds: number | null
    lastActivityAtAtEnd: string | null
    wake: { stateBefore: string; stateAfter: string; at: string } | null
  }
  control: {
    id: string
    anchorAt: string
    readAt: string
    elapsedSeconds: number
    state: string
    lastActivityAt: string | null
  } | null
  meter: {
    windowSeconds: number
    billedMinutes: number
    billedSeconds: number
    observedRunningSeconds: number
    observedRunningMinutes: number
    capMinutes: number
    intervalSeconds: number
    stoppedAtOrAfterInterval: boolean
    overshootSeconds: number | null
    capIsConfiguredInterval: boolean
    underchargeSeconds: number
  } | null
  deleted: boolean
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Reads one sandbox by id without touching it. `list` filters on an id prefix
 * and the probe passes a whole id, so the exact match check is what keeps a
 * longer id from being mistaken for this one.
 */
async function read(id: string) {
  for await (const sandbox of daytona.list({ id, limit: 5 })) {
    if (sandbox.id === id) {
      return sandbox
    }
  }

  return null
}

async function create(intervalMinutes: number): Promise<Sandbox> {
  const sandbox = await daytona.create({ autoStopInterval: intervalMinutes })
  // The app's create writes a blank memory, and that command is what starts the
  // idle clock. Without it the probe would be timing a sandbox nothing has
  // touched.
  await writeMemory(sandbox, "")

  return sandbox
}

async function wake(sandbox: Sandbox): Promise<string> {
  const opened = await daytona.get(sandbox.id)
  await opened.refreshData()

  if (opened.state !== SandboxState.STARTED) {
    await opened.start(120)
  }

  await opened.process.executeCommand("true")
  await opened.refreshData()

  return opened.state ?? "unknown"
}

const secondsBetween = (from: Date, to: Date) =>
  Math.round((to.getTime() - from.getTime()) / 1000)

const polledSandbox = await create(minutes)
const polledAnchor = new Date()
console.log(
  `polled sandbox ${polledSandbox.id}\ninterval ${minutes} min, deadline ${deadlineMinutes} min, step ${stepSeconds}s\n`
)

const controlSandbox = values.solo ? null : await create(minutes)
const controlAnchor = new Date()

const samples: Sample[] = []
let stoppedAtSeconds: number | null = null
let stopWindowSeconds: [number, number] | null = null

while (secondsBetween(polledAnchor, new Date()) < deadlineMinutes * 60) {
  const sandbox = await read(polledSandbox.id)
  const readAt = new Date()
  const elapsedSeconds = secondsBetween(polledAnchor, readAt)
  const state = sandbox?.state ?? "missing"

  samples.push({
    elapsedSeconds,
    readAt: readAt.toISOString(),
    state,
    lastActivityAt: sandbox?.lastActivityAt ?? null,
  })

  if (state === SandboxState.STOPPED && stoppedAtSeconds === null) {
    stoppedAtSeconds = elapsedSeconds
    const previous = samples.at(-2)
    stopWindowSeconds = [previous?.elapsedSeconds ?? 0, elapsedSeconds]
    console.log(
      `stopped between ${(stopWindowSeconds[0] / 60).toFixed(2)} and ${(stoppedAtSeconds / 60).toFixed(2)} min`
    )
  }

  await sleep(stepSeconds * 1000)
}

const controlReadAt = new Date()
const control = controlSandbox ? await read(controlSandbox.id) : null

const polledState = samples.at(-1)?.state
const polledWake =
  polledState === SandboxState.STOPPED
    ? {
        stateBefore: polledState,
        stateAfter: await wake(polledSandbox),
        at: new Date().toISOString(),
      }
    : null

// The API writes the stop into `lastActivityAt`, so the last distinct value the
// reads saw is the stop instant itself rather than a read that happened to catch
// it. Failing that, the first read that saw `stopped` is an upper bound on it.
const activityValues = [
  ...new Set(samples.map((sample) => sample.lastActivityAt)),
].filter((value) => value !== null)
const stopStampedSeconds =
  activityValues.length > 1
    ? (Date.parse(activityValues.at(-1)!) - polledAnchor.getTime()) / 1000
    : null

// The window the ledger would be asked to charge for: from the touch that opened
// it to the touch that closes it. The sandbox stops on its own inside it.
const observedRunningSeconds =
  stopStampedSeconds ??
  stoppedAtSeconds ??
  secondsBetween(polledAnchor, controlReadAt)
const windowSeconds = polledWake
  ? secondsBetween(polledAnchor, new Date(polledWake.at))
  : observedRunningSeconds

let meter: Timeline["meter"] = null

if (process.env.DATABASE_URL) {
  const { db } = await import("@/lib/db")
  const { bots } = await import("@/lib/db/schema")

  const probeUser = "probe:mar-189"
  const botId = `probe-mar-189-${minutes}m`
  const rollback = new Error("probe rollback")
  let billedMinutes = 0

  await db
    .transaction(async (tx) => {
      await tx.insert(bots).values({
        id: botId,
        userId: probeUser,
        name: `probe ${minutes}m`,
        job: "probe",
        createdAt: polledAnchor,
      })

      billedMinutes = await accrueSandboxTime(
        tx as unknown as Parameters<typeof accrueSandboxTime>[0],
        {
          botId,
          userId: probeUser,
          at: new Date(polledAnchor.getTime() + windowSeconds * 1000),
        }
      )

      throw rollback
    })
    .catch((error: unknown) => {
      if (error !== rollback) {
        throw error
      }
    })

  const observedRunningMinutes = Math.floor(observedRunningSeconds / 60)
  const intervalSeconds = minutes * 60
  meter = {
    windowSeconds,
    billedMinutes,
    billedSeconds: billedMinutes * 60,
    observedRunningSeconds,
    observedRunningMinutes,
    capMinutes: sandboxAutoStopMinutes,
    intervalSeconds,
    // The one thing that had to be observed rather than argued, and the only
    // field here that could have come out the other way: the sandbox's own stop
    // instant, against the interval it was handed.
    stoppedAtOrAfterInterval: observedRunningSeconds >= intervalSeconds,
    overshootSeconds: stopStampedSeconds
      ? stopStampedSeconds - intervalSeconds
      : null,
    // The precondition for the ledger's charge to mean anything. True when the
    // cap is the interval production hands Daytona, false when the probe
    // deliberately configured something else.
    capIsConfiguredInterval: sandboxAutoStopMinutes * 60 === intervalSeconds,
    // The charge against the runtime, in seconds. This is a consequence of the
    // two fields above and not a third measurement, so negative here contradicts
    // them rather than being a finding of its own.
    underchargeSeconds: observedRunningSeconds - billedMinutes * 60,
  }
}

const timeline: Timeline = {
  intervalMinutes: minutes,
  productionIntervalMinutes: sandboxAutoStopMinutes,
  deadlineMinutes,
  polled: {
    id: polledSandbox.id,
    anchorAt: polledAnchor.toISOString(),
    samples,
    stoppedAtSeconds,
    stopWindowSeconds,
    stopStampedSeconds,
    lastActivityAtAtEnd: samples.at(-1)?.lastActivityAt ?? null,
    wake: polledWake,
  },
  control: controlSandbox
    ? {
        id: controlSandbox.id,
        anchorAt: controlAnchor.toISOString(),
        readAt: controlReadAt.toISOString(),
        elapsedSeconds: secondsBetween(controlAnchor, controlReadAt),
        state: controlSandbox.state ?? "unknown",
        lastActivityAt: controlSandbox.lastActivityAt ?? null,
      }
    : null,
  meter,
  deleted: !values.keep,
}

const output = values.out ?? `/tmp/sandbox-autostop-${minutes}m.json`
writeFileSync(output, `${JSON.stringify(timeline, null, 2)}\n`)

console.log(`\npolled: ${samples.length} samples, last state ${polledState}`)
console.log(
  `  lastActivityAt held ${activityValues.length} value(s) across the run: ${activityValues.join(" then ")}`
)
if (control) {
  console.log(
    `control: read once at ${(timeline.control!.elapsedSeconds / 60).toFixed(2)} min, state ${control.state}, lastActivityAt ${control.lastActivityAt}`
  )
}
if (polledWake) {
  console.log(`wake: ${polledWake.stateBefore} -> ${polledWake.stateAfter}`)
}
if (meter) {
  console.log(
    `meter: billed ${meter.billedMinutes} min over a ${(meter.windowSeconds / 60).toFixed(2)} min window, cap ${meter.capMinutes} min`
  )
  console.log(
    `  the sandbox ran ${meter.observedRunningSeconds.toFixed(1)}s and stopped at or after the ${meter.intervalSeconds}s it was given: ${meter.stoppedAtOrAfterInterval}${meter.overshootSeconds === null ? "" : `, overshoot ${meter.overshootSeconds.toFixed(1)}s`}`
  )
  console.log(
    meter.capIsConfiguredInterval
      ? `  the cap is the interval it was given, so the charge sits ${meter.underchargeSeconds.toFixed(1)}s under the runtime, which follows from the row above`
      : `  the cap is NOT the interval it was given (${meter.capMinutes * 60}s against ${meter.intervalSeconds}s), so the charge is ${(-meter.underchargeSeconds).toFixed(1)}s above the runtime, which is the drift case`
  )
}
console.log(`\nwrote ${output}`)

if (!values.keep) {
  await daytona.delete(polledSandbox)
  if (controlSandbox) {
    await daytona.delete(controlSandbox)
  }
  console.log(controlSandbox ? "deleted both sandboxes" : "deleted the sandbox")
}
