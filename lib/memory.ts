import type { Sandbox } from "@daytona/sdk"

export const memoryFile = "MEMORY.md"

// The SDK's upload and download calls both go through a dynamic CommonJS
// require (form-data and busboy). The Trigger.dev bundler leaves neither
// resolvable at runtime, so both throw in a task. A base64 round trip through
// the shell needs no CommonJS module and behaves the same in every runtime.
const readCommand = `if [ -f ${memoryFile} ]; then base64 -w0 ${memoryFile}; fi`

export async function readMemory(sandbox: Sandbox): Promise<string> {
  const response = await sandbox.process.executeCommand(readCommand)

  if (response.exitCode !== 0) {
    throw new Error(
      response.result?.trim() || "The sandbox could not read MEMORY.md."
    )
  }

  const encoded = (response.result ?? "").replace(/\s/g, "")

  return encoded ? Buffer.from(encoded, "base64").toString("utf8") : ""
}

export async function writeMemory(
  sandbox: Sandbox,
  content: string
): Promise<void> {
  const encoded = Buffer.from(content, "utf8").toString("base64")
  const response = await sandbox.process.executeCommand(
    `printf %s '${encoded}' | base64 -d > ${memoryFile}`
  )

  if (response.exitCode !== 0) {
    throw new Error(
      response.result?.trim() || "The sandbox could not write MEMORY.md."
    )
  }
}

/**
 * Appends one note. The model's replace drops facts that were already there,
 * so a new one goes through an append that cannot lose them. A file with no
 * trailing newline gets a separator first, so the note cannot land on the end
 * of the line before it.
 */
export async function appendMemory(
  sandbox: Sandbox,
  note: string
): Promise<void> {
  const encoded = Buffer.from(`${note.trimEnd()}\n`, "utf8").toString("base64")
  const separator = `if [ -s ${memoryFile} ] && [ -n "$(tail -c1 ${memoryFile})" ]; then printf '\\n' >> ${memoryFile}; fi`
  const response = await sandbox.process.executeCommand(
    `${separator}; printf %s '${encoded}' | base64 -d >> ${memoryFile}`
  )

  if (response.exitCode !== 0) {
    throw new Error(
      response.result?.trim() || "The sandbox could not write MEMORY.md."
    )
  }
}
