import "server-only"

import { DaytonaNotFoundError } from "@daytona/sdk"

import { getDaytona } from "@/lib/daytona"
import { writeMemory } from "@/lib/memory"

/**
 * Creates a sandbox and returns its id. The app does not call start or stop.
 * A new sandbox starts with a blank memory, and that is the only thing written
 * into it here.
 */
export async function createSandbox(): Promise<string> {
  const sandbox = await getDaytona().create()
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
    if (error instanceof DaytonaNotFoundError) {
      return
    }

    throw error
  }
}
