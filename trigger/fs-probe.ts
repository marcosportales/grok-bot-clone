import { SandboxState, type Sandbox } from "@daytona/sdk"
import { logger, schemaTask } from "@trigger.dev/sdk"
import { z } from "zod"

import { getDaytona } from "@/lib/daytona"
import { sandboxAutoStopMinutes } from "@/lib/usage/sandbox"

import { readSandboxFile, writeSandboxFile } from "./computer"

const probeDir = "/tmp/mar-184"
const textFile = `${probeDir}/probe.txt`
const binaryFile = `${probeDir}/binary.bin`
const bigFile = `${probeDir}/big.txt`
const nestedFile = `${probeDir}/nested/deeper/probe.txt`
const sdkFile = `${probeDir}/sdk-transfer.txt`
const text = "mar-184 probe\n"

/** Records what a call returned, or what it threw, so nothing is lost. */
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

async function open(sandboxId: string | undefined): Promise<{
  sandbox: Sandbox
  created: boolean
}> {
  if (sandboxId) {
    return { sandbox: await getDaytona().get(sandboxId), created: false }
  }

  const sandbox = await getDaytona().create({
    autoStopInterval: sandboxAutoStopMinutes,
  })

  return { sandbox, created: true }
}

/**
 * Proves that the two file tools work in the runtime the tasks run in.
 *
 * `readFile` and `writeFile` are the only tools that touch a sandbox file, and
 * the SDK's file transfer cannot run in a task, so the tools go through the
 * shell. This runs the same functions the tools run, against its own sandbox,
 * and records what each returned. The SDK's own transfer is recorded beside
 * them: it is the reason the tools do not use it, and it will say so the day a
 * new build makes it work.
 *
 * Needs `DAYTONA_API_KEY`. A sandbox it creates is deleted before it returns.
 */
export const fsProbe = schemaTask({
  id: "fs-probe",
  schema: z.object({
    sandboxId: z.string().optional(),
  }),
  run: async ({ sandboxId }) => {
    const { sandbox, created } = await open(sandboxId)

    if (sandbox.state !== SandboxState.STARTED) {
      await sandbox.start(120)
    }

    const fixtures = await record(async () => {
      const response = await sandbox.process.executeCommand(
        `mkdir -p ${probeDir} && printf 'a\\000b' > ${binaryFile} && head -c 600000 /dev/zero | tr '\\0' a > ${bigFile}`
      )

      if (response.exitCode !== 0) {
        throw new Error(response.result?.trim() || "fixtures failed")
      }

      return "binary and oversized fixtures written"
    })

    const result = {
      sandboxId: sandbox.id,
      created,
      fixtures,
      write: await record(() => writeSandboxFile(sandbox, textFile, text)),
      read: await record(() => readSandboxFile(sandbox, textFile)),
      binary: await record(() => readSandboxFile(sandbox, binaryFile)),
      oversized: await record(() => readSandboxFile(sandbox, bigFile)),
      missing: await record(() =>
        readSandboxFile(sandbox, `${probeDir}/missing.txt`)
      ),
      nested: await record(() => writeSandboxFile(sandbox, nestedFile, text)),
      sdkUpload: await record(async () => {
        await sandbox.fs.uploadFile(Buffer.from(text, "utf8"), sdkFile)
        return "uploaded"
      }),
      sdkDownload: await record(async () => {
        const bytes = await sandbox.fs.downloadFile(sdkFile)
        return bytes.toString("utf8").trim()
      }),
    }

    logger.info("fs probe result", result)

    if (created) {
      await getDaytona().delete(sandbox)
    }

    return result
  },
})
