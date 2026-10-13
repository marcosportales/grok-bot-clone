import "server-only"

import { DaytonaNotFoundError } from "@daytona/sdk"

import { getDaytona } from "@/lib/daytona"
import { writeMemory } from "@/lib/memory"
import { sandboxAutoStopMinutes } from "@/lib/usage/sandbox"

/**
 * Creates a sandbox and returns its id. The app does not call start or stop.
 * A new sandbox starts with a blank memory, and that is the only thing written
 * into it here.
 */
export async function createSandbox(): Promise<string> {
  // The idle interval is also the cap on one accrual of sandbox minutes, so the
  // sandbox Daytona stops on its own is the sandbox the ledger can charge for.
  // `scripts/sandbox-autostop-probe.ts` observes it stopping at that interval.
  const sandbox = await getDaytona().create({
    autoStopInterval: sandboxAutoStopMinutes,
  })
  await writeMemory(sandbox, "")
  return sandbox.id
}

/**
 * Deletes a sandbox. A sandbox that is already gone counts as deleted, so a
 * retry after a failed bot delete can finish removing the row.
 */
export async function deleteSandbox(sandboxId: string): Promise<void> {
  const client = getDaytona()

  try {
    const sandbox = await client.get(sandboxId)
    await client.delete(sandbox)
  } catch (error) {
    if (isMissing(error)) {
      return
    }

    throw error
  }
}

/**
 * The SDK ships separate ESM and CJS builds, so an error it raises is not
 * always `instanceof` the class imported here, and a sandbox that is already
 * gone would then look like a real failure. `DaytonaError` names itself after
 * its own class (`this.name = new.target.name`), which survives that split.
 */
function isMissing(error: unknown): boolean {
  if (error instanceof DaytonaNotFoundError) {
    return true
  }

  return error instanceof Error && error.name === "DaytonaNotFoundError"
}
