/**
 * Proves that `readFile` and `writeFile` work in the runtime the tasks run in,
 * which is the only place the question matters: both tools reach a sandbox file,
 * and the SDK's own file transfer cannot resolve its CommonJS dependencies from
 * the task bundle.
 *
 *   node scripts/sandbox-fs-probe.ts
 *   node scripts/sandbox-fs-probe.ts --sandbox <id> --keep
 *
 * The SDK transfer runs once in this process, straight from node_modules, as the
 * control: the SDK is not broken, the bundle is. Then the `fs-probe` task runs
 * the two functions the tools call, in the dev worker, and this script checks
 * them against the acceptance criteria. Needs `DAYTONA_API_KEY` and
 * `TRIGGER_SECRET_KEY`. Exits non-zero when a check fails.
 *
 * A sandbox the run creates is deleted at the end unless `--keep` is passed.
 */
import "./lib/ts-hooks.ts"

import { parseArgs } from "node:util"

import { SandboxState, type Sandbox } from "@daytona/sdk"

const { values } = parseArgs({
  options: {
    sandbox: { type: "string" },
    keep: { type: "boolean" },
    task: { type: "string", default: "fs-probe" },
  },
})

const probeDir = "/tmp/mar-184"
const text = "mar-184 probe\n"
const sdkFile = `${probeDir}/sdk-transfer.txt`
// The two nested paths differ so neither run can prepare the directory for the
// other, which is what makes the comparison a comparison.
const sdkNestedFile = `${probeDir}/nested-sdk/deeper/probe.txt`
const runDeadlineMs = 5 * 60_000

async function record<T>(
  work: () => Promise<T>
): Promise<T | { thrown: string }> {
  try {
    return await work()
  } catch (error) {
    return {
      thrown:
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error),
    }
  }
}

const { getDaytona } = await import("@/lib/daytona")
const { sandboxAutoStopMinutes } = await import("@/lib/usage/sandbox")
const { runs, tasks } = await import("@trigger.dev/sdk")

const daytona = getDaytona()
const created = !values.sandbox
const sandbox: Sandbox = created
  ? await daytona.create({ autoStopInterval: sandboxAutoStopMinutes })
  : await daytona.get(values.sandbox!)

console.log(
  created ? `created sandbox ${sandbox.id}` : `using sandbox ${sandbox.id}`
)

if (sandbox.state !== SandboxState.STARTED) {
  await sandbox.start(120)
}

await sandbox.process.executeCommand(
  `rm -rf ${probeDir} && mkdir -p ${probeDir}`
)

const bytes = Buffer.from(text, "utf8")

const local = {
  sdkUpload: await record(async () => {
    await sandbox.fs.uploadFile(bytes, sdkFile)
    return `${bytes.length} bytes to ${sdkFile}`
  }),
  shellRead: await record(async () => {
    const response = await sandbox.process.executeCommand(`cat ${sdkFile}`)
    return `exit ${response.exitCode}: ${(response.result ?? "").trim()}`
  }),
  sdkDownload: await record(async () => {
    const content = await sandbox.fs.downloadFile(sdkFile)
    return `${content.length} bytes: ${content.toString("utf8").trim()}`
  }),
  nestedUpload: await record(async () => {
    await sandbox.fs.uploadFile(bytes, sdkNestedFile)
    return `uploaded to a directory that did not exist`
  }),
}

console.log(
  `local (node_modules, no bundle)\n${JSON.stringify(local, null, 2)}`
)

const handle = await tasks.trigger(values.task!, { sandboxId: sandbox.id })
console.log(`triggered ${values.task} as ${handle.id}`)

const deadline = Date.now() + runDeadlineMs
let run = await runs.retrieve(handle)

while (!run.isCompleted && !run.isCancelled) {
  if (Date.now() > deadline) {
    throw new Error(`Run ${handle.id} did not finish in five minutes.`)
  }

  await new Promise((resolve) => setTimeout(resolve, 3_000))
  run = await runs.retrieve(handle)
}

console.log(
  `worker (${run.status}, ${run.id})\n${JSON.stringify(run.output ?? { error: run.error }, null, 2)}`
)

if (created && !values.keep) {
  await daytona.delete(sandbox)
  console.log(`deleted sandbox ${sandbox.id}`)
}

const out = (run.output ?? {}) as Record<string, Record<string, unknown>>

const checks: Array<[string, boolean]> = [
  ["a written file reads back byte for byte", out.read?.content === text],
  ["the write reports its byte count", out.write?.bytes === bytes.length],
  ["a binary file is refused", out.binary?.error === "That file is not text."],
  [
    "a file above the size cap is refused",
    out.oversized?.error === "That file is too large to read.",
  ],
  [
    "a missing file reports an error",
    Boolean(out.missing?.error ?? out.missing?.thrown),
  ],
  [
    "a write creates a missing parent directory",
    out.nested?.bytes === bytes.length,
  ],
]

console.log("checks")
for (const [name, ok] of checks) {
  console.log(`  ${ok ? "pass" : "FAIL"}  ${name}`)
}

const failed = checks.filter(([, ok]) => !ok)

if (failed.length > 0) {
  console.error(`${failed.length} of ${checks.length} checks failed`)
  process.exitCode = 1
} else {
  console.log(`${checks.length} of ${checks.length} checks passed`)
}
