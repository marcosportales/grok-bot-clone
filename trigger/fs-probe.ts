import { SandboxState, type Sandbox } from "@daytona/sdk"
import { logger, schemaTask } from "@trigger.dev/sdk"
import { z } from "zod"

import { getDaytona } from "@/lib/daytona"
import { sandboxAutoStopMinutes } from "@/lib/usage/sandbox"

import { readSandboxFile, writeSandboxFile } from "./computer"

const cap = 512_000
const probeDir = "/tmp/mar-184"
const text = "mar-184 probe\n"
const textFile = `${probeDir}/probe.txt`
const spacedFile = `${probeDir}/a file's name.txt`
const emptyFile = `${probeDir}/empty.txt`
const atCapFile = `${probeDir}/at-cap.txt`
const overCapFile = `${probeDir}/over-cap.txt`
const binaryFile = `${probeDir}/binary.bin`
const nestedFile = `${probeDir}/nested/deeper/probe.txt`
const sdkFile = `${probeDir}/sdk-transfer.txt`

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
        [
          `mkdir -p ${probeDir}`,
          `touch ${emptyFile}`,
          `printf 'a\\000b' > ${binaryFile}`,
          `head -c ${cap} /dev/zero | tr '\\0' a > ${atCapFile}`,
          `head -c ${cap + 1} /dev/zero | tr '\\0' a > ${overCapFile}`,
        ].join(" && ")
      )

      if (response.exitCode !== 0) {
        throw new Error(response.result?.trim() || "fixtures failed")
      }

      return `empty, ${cap} byte, ${cap + 1} byte, binary and nested fixtures`
    })

    const result = {
      sandboxId: sandbox.id,
      created,
      fixtures,
      write: await record(() => writeSandboxFile(sandbox, textFile, text)),
      read: await record(() => readSandboxFile(sandbox, textFile)),
      spacedPath: await record(async () => {
        await writeSandboxFile(sandbox, spacedFile, text)
        return readSandboxFile(sandbox, spacedFile)
      }),
      empty: await record(() => readSandboxFile(sandbox, emptyFile)),
      atCap: await record(async () => {
        const read = await readSandboxFile(sandbox, atCapFile)
        return "error" in read
          ? read
          : { path: read.path, chars: read.content.length }
      }),
      overCap: await record(() => readSandboxFile(sandbox, overCapFile)),
      binary: await record(() => readSandboxFile(sandbox, binaryFile)),
      directory: await record(() => readSandboxFile(sandbox, probeDir)),
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
