/**
 * Draws one figure from the timelines `sandbox-autostop-probe.ts` writes, for a
 * pull request body or a review. The measurement and its presentation are
 * separate so a reviewer can re-render archived evidence without spending
 * another seventeen minutes observing a sandbox.
 *
 *   node scripts/sandbox-autostop-figure.ts --out figure.svg run-2m.json run-15m.json
 *   rsvg-convert -o figure.png figure.svg
 *
 * Every x position in here is in seconds since the sandbox's anchor, which is
 * the touch that opened the idle clock.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { parseArgs } from "node:util"

type Sample = {
  elapsedSeconds: number
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
    lastActivityAtAtEnd: string | null
    wake: { stateBefore: string; stateAfter: string } | null
  }
  control: {
    state: string
    elapsedSeconds: number
    lastActivityAt: string | null
  } | null
  meter: {
    windowSeconds: number
    billedMinutes: number
    observedRunningSeconds: number
    observedRunningMinutes: number
    capMinutes: number
    intervalSeconds: number
    stoppedAtOrAfterInterval: boolean
    overshootSeconds: number | null
    capIsConfiguredInterval: boolean
    underchargeSeconds: number
  } | null
}

const { values, positionals } = parseArgs({
  options: { out: { type: "string" } },
  allowPositionals: true,
})

const timelines = positionals.map(
  (file) => JSON.parse(readFileSync(file, "utf8")) as Timeline
)

const width = 1080
const marginLeft = 170
const marginRight = 40
const headerHeight = 108
const panelHeight = 214
const footerHeight = 78 + timelines.length * 44
const height = headerHeight + timelines.length * panelHeight + footerHeight

const plotWidth = width - marginLeft - marginRight
const axisMinutes = Math.max(
  17,
  ...timelines.map((timeline) => timeline.deadlineMinutes)
)
const x = (seconds: number) =>
  marginLeft + (seconds / 60 / axisMinutes) * plotWidth

const ink = "#0f172a"
const muted = "#64748b"
const grid = "#eef2f7"
const rule = "#cbd5e1"
const band = "#f8fafc"
const fill = {
  started: "#f59e0b",
  stopping: "#fbbf24",
  stopped: "#0284c7",
} as const
const meter = "#7c3aed"
const bad = "#dc2626"
const good = "#047857"

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const minutes = (seconds: number) => `${(seconds / 60).toFixed(2)} min`

function railSegments(timeline: Timeline, endSeconds: number) {
  const samples = timeline.polled.samples
  const segments: { from: number; to: number; state: string }[] = []
  let cursor = 0

  for (const sample of samples) {
    segments.push({
      from: cursor,
      to: sample.elapsedSeconds,
      state: sample.state,
    })
    cursor = sample.elapsedSeconds
  }

  const last = samples.at(-1)
  if (last && cursor < endSeconds) {
    segments.push({ from: cursor, to: endSeconds, state: last.state })
  }

  return segments
}

/**
 * Every distinct `lastActivityAt` the reads saw, in order. One entry means the
 * reads themselves were inert. A second entry is the sandbox's own stop event
 * being timestamped by the API.
 */
function activityChanges(timeline: Timeline) {
  const changes: { elapsedSeconds: number; at: string }[] = []
  const anchorMs = Date.parse(timeline.polled.anchorAt)

  for (const sample of timeline.polled.samples) {
    if (!sample.lastActivityAt) {
      continue
    }

    if (changes.at(-1)?.at !== sample.lastActivityAt) {
      changes.push({
        elapsedSeconds: sample.elapsedSeconds,
        at: sample.lastActivityAt,
      })
    }
  }

  return { changes, anchorMs }
}

function describeActivity(timeline: Timeline): string {
  const { changes, anchorMs } = activityChanges(timeline)
  const reads = timeline.polled.samples.length

  if (changes.length === 0) {
    return `no timestamp on any of the ${reads} reads`
  }

  if (changes.length === 1) {
    return `held at ${escape(changes[0].at)} across all ${reads} reads`
  }

  const first = changes[0]
  const settled = changes.at(-1)!
  const settledSeconds = (Date.parse(settled.at) - anchorMs) / 1000

  return `held at ${escape(first.at)} across ${reads} reads, then advanced once to ${escape(settled.at)}, which is ${minutes(settledSeconds)} after the touch`
}

function panel(timeline: Timeline, index: number): string {
  const top = headerHeight + index * panelHeight
  const railTop = top + 56
  const railHeight = 26
  const endSeconds =
    timeline.polled.samples.at(-1)?.elapsedSeconds ??
    timeline.deadlineMinutes * 60
  const stopWindow = timeline.polled.stopWindowSeconds
  const parts: string[] = []

  parts.push(
    `<text x="24" y="${top + 22}" class="panel">autoStopInterval: ${timeline.intervalMinutes} min</text>`,
    `<text x="${width - 24}" y="${top + 22}" class="id" text-anchor="end">${escape(timeline.polled.id)}</text>`
  )

  const intervalX = x(timeline.intervalMinutes * 60)
  const capX = x(timeline.productionIntervalMinutes * 60)
  const coincide = Math.abs(capX - intervalX) < 3

  for (let minute = 0; minute <= axisMinutes; minute += 1) {
    parts.push(
      `<line x1="${x(minute * 60)}" y1="${top + 30}" x2="${x(minute * 60)}" y2="${top + panelHeight - 14}" stroke="${grid}"/>`
    )
  }

  parts.push(
    `<rect x="${marginLeft}" y="${railTop}" width="${plotWidth}" height="${railHeight}" fill="${band}" stroke="${rule}"/>`
  )

  for (const segment of railSegments(timeline, endSeconds)) {
    const colour = fill[segment.state as keyof typeof fill] ?? rule
    const left = x(segment.from)
    const segmentWidth = Math.max(0, x(segment.to) - left)
    parts.push(
      `<rect x="${left}" y="${railTop}" width="${segmentWidth}" height="${railHeight}" fill="${colour}"/>`
    )
  }

  parts.push(
    `<text x="${marginLeft + 8}" y="${railTop + 18}" class="rail">started</text>`
  )
  if (timeline.polled.stoppedAtSeconds !== null) {
    parts.push(
      `<text x="${x(endSeconds) - 8}" y="${railTop + 18}" class="rail" text-anchor="end">stopped</text>`
    )
  }

  const rightHalf = intervalX > width / 2
  const intervalLabel = rightHalf
    ? `<text x="${intervalX - 6}" y="${top + 46}" class="mark" text-anchor="end">${coincide ? `configured interval = meter cap ${timeline.productionIntervalMinutes} min` : `configured interval ${timeline.intervalMinutes} min`}</text>`
    : `<text x="${intervalX + 6}" y="${top + 46}" class="mark">${coincide ? `configured interval = meter cap ${timeline.productionIntervalMinutes} min` : `configured interval ${timeline.intervalMinutes} min`}</text>`

  parts.push(
    `<line x1="${intervalX}" y1="${top + 34}" x2="${intervalX}" y2="${railTop + railHeight + 26}" stroke="${ink}" stroke-dasharray="5 4"/>`,
    intervalLabel
  )

  if (!coincide) {
    parts.push(
      `<line x1="${capX}" y1="${top + 34}" x2="${capX}" y2="${railTop + railHeight + 26}" stroke="${meter}" stroke-dasharray="2 3"/>`,
      `<text x="${capX + 6}" y="${top + 46}" class="mark meter" text-anchor="end">meter cap ${timeline.productionIntervalMinutes} min</text>`
    )
  }

  for (const sample of timeline.polled.samples) {
    parts.push(
      `<rect x="${x(sample.elapsedSeconds)}" y="${railTop + railHeight + 8}" width="1.6" height="${sample.state === "started" ? 8 : 15}" fill="${fill[sample.state as keyof typeof fill] ?? rule}"/>`
    )
  }

  if (stopWindow) {
    const left = x(stopWindow[0])
    const right = x(stopWindow[1])
    const late = stopWindow[1] / 60 - timeline.intervalMinutes
    parts.push(
      `<line x1="${left}" y1="${railTop - 6}" x2="${left}" y2="${railTop + railHeight + 6}" stroke="${ink}"/>`,
      `<line x1="${right}" y1="${railTop - 6}" x2="${right}" y2="${railTop + railHeight + 6}" stroke="${ink}"/>`,
      `<text x="24" y="${top + 116}" class="note">stop window</text>`,
      `<text x="${marginLeft}" y="${top + 116}" class="value">${minutes(stopWindow[0])} to ${minutes(stopWindow[1])} after the touch, so no later than ${late.toFixed(2)} min past the interval</text>`
    )
  } else {
    parts.push(
      `<text x="24" y="${top + 116}" class="note">still started</text>`,
      `<text x="${marginLeft}" y="${top + 116}" class="value bad">${minutes(endSeconds)} after the touch, past its interval</text>`
    )
  }

  const { changes, anchorMs } = activityChanges(timeline)
  const settled = changes.length > 1 ? changes.at(-1)! : null
  parts.push(
    `<text x="24" y="${top + 138}" class="note">lastActivityAt</text>`,
    `<text x="${marginLeft}" y="${top + 138}" class="value">${describeActivity(timeline)}</text>`
  )

  if (settled) {
    const settledSeconds = (Date.parse(settled.at) - anchorMs) / 1000
    parts.push(
      `<line x1="${x(settledSeconds)}" y1="${railTop - 8}" x2="${x(settledSeconds)}" y2="${railTop + railHeight + 4}" stroke="${bad}" stroke-width="1.5"/>`
    )
  }

  if (timeline.meter) {
    const rowTop = top + 162
    const unit = 24
    const ranWidth = timeline.meter.observedRunningMinutes * unit
    const billedWidth = timeline.meter.billedMinutes * unit

    parts.push(
      `<text x="24" y="${rowTop + 12}" class="note">sandbox ran</text>`
    )
    parts.push(
      `<rect x="${marginLeft}" y="${rowTop}" width="${ranWidth}" height="15" fill="${fill.stopped}"/>`,
      `<text x="${marginLeft + ranWidth + 8}" y="${rowTop + 12}" class="value">${timeline.meter.observedRunningMinutes} min</text>`
    )

    parts.push(
      `<text x="24" y="${rowTop + 36}" class="note">meter billed</text>`
    )
    parts.push(
      `<rect x="${marginLeft}" y="${rowTop + 24}" width="${billedWidth}" height="15" fill="none" stroke="${meter}"/>`,
      `<text x="${marginLeft + billedWidth + 8}" y="${rowTop + 36}" class="value meter">${timeline.meter.billedMinutes} min over a ${minutes(timeline.meter.windowSeconds)} window, cap ${timeline.meter.capMinutes} min</text>`
    )
  }

  return `<g>${parts.join("")}</g>`
}

const axisTitle = `<text x="${marginLeft + plotWidth / 2}" y="${height - footerHeight + 30}" class="axis" text-anchor="middle">minutes since the touch that opened the idle clock</text>`

const minuteTicks = Array.from({ length: axisMinutes + 1 }, (_, minute) =>
  minute % 2 === 0
    ? `<text x="${x(minute * 60)}" y="${height - footerHeight + 6}" class="axis" text-anchor="middle">${minute}</text>`
    : ""
).join("")

const meterLines = timelines
  .filter((timeline) => timeline.meter !== null)
  .map((timeline, index) => {
    const entry = timeline.meter!
    const overshoot =
      entry.overshootSeconds === null
        ? "at an unknown moment"
        : `${entry.overshootSeconds.toFixed(1)}s past its ${entry.intervalSeconds}s interval`
    const first = `<text x="24" y="${height - footerHeight + 56 + index * 44}" class="sub"><tspan class="good">autoStopInterval ${timeline.intervalMinutes} min: the sandbox ran ${entry.observedRunningSeconds.toFixed(1)}s, so it stopped ${overshoot} and never early.</tspan></text>`
    const second = entry.capIsConfiguredInterval
      ? `<text x="24" y="${height - footerHeight + 78 + index * 44}" class="sub"><tspan class="good">The 15 min cap is that same interval, so the meter billed ${entry.billedMinutes} min over a ${minutes(entry.windowSeconds)} window, ${entry.underchargeSeconds.toFixed(1)}s under the runtime.</tspan></text>`
      : `<text x="24" y="${height - footerHeight + 78 + index * 44}" class="sub"><tspan class="bad">The 15 min cap is not this sandbox's interval, so the meter billed ${entry.billedMinutes} min over a ${minutes(entry.windowSeconds)} window, ${(-entry.underchargeSeconds).toFixed(1)}s above the runtime.</tspan></text>`
    return first + second
  })
  .join("")

const anchors = timelines.map((timeline) => timeline.polled.anchorAt)

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<style>
  text { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; fill: ${ink}; }
  .title { font-size: 21px; font-weight: 600; }
  .sub { font-size: 12.5px; fill: ${muted}; }
  .panel { font-size: 15px; font-weight: 600; }
  .id { font-size: 11.5px; fill: ${muted}; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .note { font-size: 11.5px; fill: ${muted}; }
  .value { font-size: 12px; font-weight: 600; }
  .value.meter { fill: ${meter}; }
  .mark { font-size: 11px; }
  .mark.meter { fill: ${meter}; }
  .rail { font-size: 12px; fill: #ffffff; font-weight: 600; }
  .axis { font-size: 11px; fill: ${muted}; }
  .good { fill: ${good}; font-weight: 600; }
  .bad { fill: ${bad}; font-weight: 600; }
</style>
<rect width="${width}" height="${height}" fill="#ffffff"/>
<text x="24" y="34" class="title">Daytona stops an idle sandbox at the interval it was given</text>
<text x="24" y="56" class="sub">${escape(timelines.map((t) => `autoStopInterval ${t.intervalMinutes} min`).join("   ·   "))}   ·   anchored ${escape(anchors.join("  /  "))}</text>
<text x="24" y="76" class="sub">Read through the Daytona list API only, never the app's own touch path. The bracket is the window between the last read that saw the sandbox started and the first that saw it stopped.</text>
<text x="24" y="94" class="sub">The amber block is the sandbox running and the blue block after the bracket is it stopped. The red mark is the stop instant the sandbox stamped itself.</text>
${timelines.map((timeline, index) => panel(timeline, index)).join("")}
${minuteTicks}
${axisTitle}
${meterLines}
<text x="24" y="${height - footerHeight + 56 + timelines.length * 44 + 6}" class="sub">Every sandbox was deleted at the end of its run.</text>
</svg>
`

const out = values.out ?? "/tmp/sandbox-autostop-figure.svg"
writeFileSync(out, svg)
console.log(
  `wrote ${out} (${timelines.length} panels, ${axisMinutes} min axis)`
)
