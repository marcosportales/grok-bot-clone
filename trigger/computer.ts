import { DaytonaError, SandboxState, type Sandbox } from "@daytona/sdk"
import { tool } from "ai"
import { asc, eq } from "drizzle-orm"
import { z } from "zod"

import { getDaytona } from "@/lib/daytona"
import { bots, chatMembers } from "@/lib/db/schema"

import { database } from "./db"

const commandTimeoutSeconds = 60
const maxCommandOutput = 16_000
const maxFileChars = 64_000
const maxListedEntries = 200
const maxScreenChars = 12_000
const screenshotCharLimit = 600_000

type Failure = { error: string }

type BashResult = { exitCode: number; output: string } | Failure

type ReadFileResult = { path: string; content: string } | Failure

type WriteFileResult = { path: string; bytes: number } | Failure

type ListedEntry = {
  name: string
  path: string
  isDir: boolean
  size: number
}

type ListFilesResult =
  { path: string; entries: ListedEntry[]; truncated: boolean } | Failure

type PointerResult = { x: number; y: number } | Failure

type ScreenTree = { screen: string } | Failure

type ScreenView =
  { image: string; mediaType: "image/jpeg"; screen: string } | Failure

type ScreenPicture = { image: string; mediaType: "image/jpeg" } | Failure

type A11yNode = {
  role?: string
  name?: string
  bounds?: { x?: number; y?: number; width?: number; height?: number }
  children?: A11yNode[]
}

const desktopReady = new Set<string>()

const button = z.enum(["left", "right", "middle"])
const scrollDirection = z.enum(["up", "down", "left", "right"])
const modifier = z.enum(["ctrl", "alt", "shift", "cmd"])

function stopped(signal: AbortSignal | undefined): Failure | undefined {
  if (signal?.aborted) {
    return { error: "Stopped." }
  }

  return undefined
}

function failed(error: unknown): Failure {
  console.error(error)

  if (error instanceof DaytonaError) {
    return { error: error.message }
  }

  if (error instanceof Error && error.message.length > 0) {
    return { error: error.message }
  }

  return { error: "The sandbox could not do that." }
}

function clip(text: string, max: number): string {
  if (text.length <= max) {
    return text
  }

  return `${text.slice(0, max)}\n…truncated`
}

function pathOf(path: string): string | Failure {
  if (path.includes("\0")) {
    return { error: "That path is not valid." }
  }

  return path
}

async function sandboxIdForChat(chatId: string): Promise<string> {
  const [member] = await database()
    .select({ sandboxId: bots.sandboxId })
    .from(chatMembers)
    .innerJoin(bots, eq(chatMembers.botId, bots.id))
    .where(eq(chatMembers.chatId, chatId))
    // `id` breaks the tie a group's single multi-row insert leaves in
    // `joinedAt`, so this picks the member the prompt and the chunk below call
    // the first one.
    .orderBy(asc(chatMembers.joinedAt), asc(bots.id))
    .limit(1)

  if (!member?.sandboxId) {
    throw new Error("This bot has no computer.")
  }

  return member.sandboxId
}

async function openSandbox(sandboxId: string): Promise<Sandbox> {
  const sandbox = await getDaytona().get(sandboxId)

  if (sandbox.state !== SandboxState.STARTED) {
    desktopReady.delete(sandboxId)
    await sandbox.start(120)
  }

  return sandbox
}

async function openDesktop(sandbox: Sandbox): Promise<void> {
  if (desktopReady.has(sandbox.id)) {
    return
  }

  let running = false

  try {
    const status = await sandbox.computerUse.getProcessStatus("xvfb")
    running = status.running === true
  } catch {
    running = false
  }

  if (!running) {
    await sandbox.computerUse.start()
  }

  desktopReady.add(sandbox.id)
}

// The sandbox id arrives as a thunk rather than a promise, and that is what
// keeps a chat whose first member has no sandbox from killing the run: the
// lookup used to happen once per turn, so a missing sandbox left a rejected
// promise nobody awaited, which Node ends the process over.
async function withSandbox<T>(
  sandboxId: () => Promise<string>,
  signal: AbortSignal | undefined,
  run: (sandbox: Sandbox) => Promise<T>
): Promise<T | Failure> {
  const halt = stopped(signal)
  if (halt) {
    return halt
  }

  try {
    const sandbox = await openSandbox(await sandboxId())
    return await run(sandbox)
  } catch (error) {
    return failed(error)
  }
}

async function withDesktop<T>(
  sandboxId: () => Promise<string>,
  signal: AbortSignal | undefined,
  run: (sandbox: Sandbox) => Promise<T>
): Promise<T | Failure> {
  return withSandbox(sandboxId, signal, async (sandbox) => {
    await openDesktop(sandbox)
    return run(sandbox)
  })
}

function formatNode(node: A11yNode, depth: number, lines: string[]): void {
  if (lines.join("\n").length >= maxScreenChars) {
    return
  }

  const bounds = node.bounds
  const box =
    bounds?.width != null && bounds.height != null
      ? ` (${bounds.x ?? 0},${bounds.y ?? 0} ${bounds.width}x${bounds.height})`
      : ""
  const name = node.name ? ` "${node.name}"` : ""
  lines.push(`${"  ".repeat(depth)}${node.role ?? "node"}${name}${box}`)

  for (const child of node.children ?? []) {
    formatNode(child, depth + 1, lines)
  }
}

type ScreenModelPart =
  | {
      type: "file"
      mediaType: "image/jpeg"
      data: { type: "data"; data: string }
    }
  | { type: "text"; text: string }

function pictureForModel(
  output: { error: string } | { image: string },
  text?: string
) {
  if ("error" in output) {
    return { type: "text" as const, value: output.error }
  }

  const value: ScreenModelPart[] = [
    {
      type: "file",
      mediaType: "image/jpeg",
      data: { type: "data", data: output.image },
    },
  ]

  if (text) {
    value.push({ type: "text", text })
  }

  return { type: "content" as const, value }
}

async function readScreen(sandbox: Sandbox): Promise<ScreenTree> {
  const info = await sandbox.computerUse.display.getInfo()
  const display =
    info.displays?.find((item) => item.isActive) ?? info.displays?.[0]
  const size =
    display?.width != null && display.height != null
      ? `Display ${display.width}x${display.height}. Coordinates start at the top-left.`
      : "Coordinates start at the top-left of the display."
  const tree = await sandbox.computerUse.accessibility.getTree({
    scope: "all",
    maxDepth: 4,
  })
  const lines = [size]

  if (tree.root) {
    formatNode(tree.root, 0, lines)
  } else {
    lines.push("The accessibility tree is empty.")
  }

  return { screen: clip(lines.join("\n"), maxScreenChars) }
}

function normalizeBase64(value: string): string {
  const marker = "base64,"
  const index = value.indexOf(marker)
  const raw = index === -1 ? value : value.slice(index + marker.length)
  return raw.replace(/\s/g, "")
}

async function takePicture(sandbox: Sandbox): Promise<ScreenPicture> {
  const attempts = [
    { format: "jpeg", quality: 60, scale: 0.5, showCursor: true },
    { format: "jpeg", quality: 40, scale: 0.35, showCursor: true },
  ]

  let image = ""

  for (const options of attempts) {
    const shot = await sandbox.computerUse.screenshot.takeCompressed(options)
    image = normalizeBase64(shot.screenshot ?? "")

    if (image.length > 0 && image.length <= screenshotCharLimit) {
      return { image, mediaType: "image/jpeg" }
    }
  }

  if (image.length === 0) {
    return { error: "The desktop did not return a picture." }
  }

  return { error: "The picture was too large to send." }
}

export function computerTools(chatId: string) {
  const sandboxId = () => sandboxIdForChat(chatId)

  return {
    bash: tool({
      description:
        "Run a shell command in the sandbox and return its exit code and output.",
      inputSchema: z.object({
        command: z.string().min(1).max(8_000),
        // The model reaches for "" when it has no directory in mind, and the
        // provider refuses the whole call when the schema rejects it, so the
        // field takes an empty string and the code below reads it as absent.
        cwd: z.string().max(500).optional(),
      }),
      execute: async ({ command, cwd }, { abortSignal }) =>
        withSandbox(sandboxId, abortSignal, async (sandbox) => {
          const cwdPath = cwd ? pathOf(cwd) : undefined
          if (cwdPath && typeof cwdPath !== "string") {
            return cwdPath
          }

          const response = await sandbox.process.executeCommand(
            command,
            cwdPath,
            undefined,
            commandTimeoutSeconds
          )

          return {
            exitCode: response.exitCode ?? 1,
            output: clip(response.result ?? "", maxCommandOutput),
          } satisfies BashResult
        }),
    }),
    readFile: tool({
      description: "Read a text file in the sandbox.",
      inputSchema: z.object({
        path: z.string().min(1).max(500),
      }),
      execute: async ({ path }, { abortSignal }) =>
        withSandbox(sandboxId, abortSignal, async (sandbox) => {
          const filePath = pathOf(path)
          if (typeof filePath !== "string") {
            return filePath
          }

          const bytes = await sandbox.fs.downloadFile(filePath)

          if (bytes.includes(0)) {
            return { error: "That file is not text." } satisfies ReadFileResult
          }

          if (bytes.length > 512_000) {
            return {
              error: "That file is too large to read.",
            } satisfies ReadFileResult
          }

          return {
            path: filePath,
            content: clip(bytes.toString("utf8"), maxFileChars),
          } satisfies ReadFileResult
        }),
    }),
    writeFile: tool({
      description:
        "Write a text file in the sandbox. Creates the file or replaces it.",
      inputSchema: z.object({
        path: z.string().min(1).max(500),
        content: z.string().max(100_000),
      }),
      execute: async ({ path, content }, { abortSignal }) =>
        withSandbox(sandboxId, abortSignal, async (sandbox) => {
          const filePath = pathOf(path)
          if (typeof filePath !== "string") {
            return filePath
          }

          const bytes = Buffer.from(content, "utf8")
          await sandbox.fs.uploadFile(bytes, filePath)

          return {
            path: filePath,
            bytes: bytes.length,
          } satisfies WriteFileResult
        }),
    }),
    listFiles: tool({
      description: "List the files in a sandbox directory.",
      inputSchema: z.object({
        path: z.string().min(1).max(500).default("."),
      }),
      execute: async ({ path }, { abortSignal }) =>
        withSandbox(sandboxId, abortSignal, async (sandbox) => {
          const directory = pathOf(path)
          if (typeof directory !== "string") {
            return directory
          }

          const files = await sandbox.fs.listFiles(directory)
          const entries = files
            .map((file) => ({
              name: file.name,
              path: file.path ?? file.name,
              isDir: file.isDir,
              size: file.size,
            }))
            .sort((left, right) => {
              if (left.isDir !== right.isDir) {
                return left.isDir ? -1 : 1
              }

              return left.name.localeCompare(right.name)
            })

          return {
            path: directory,
            entries: entries.slice(0, maxListedEntries),
            truncated: entries.length > maxListedEntries,
          } satisfies ListFilesResult
        }),
    }),
    mouseClick: tool({
      description:
        "Click the desktop. x and y are pixels from the top-left. button is left, right, or middle.",
      inputSchema: z.object({
        x: z.number().int(),
        y: z.number().int(),
        button: button.default("left"),
        clicks: z.number().int().min(1).max(3).default(1),
      }),
      execute: async ({ x, y, button: mouseButton, clicks }, { abortSignal }) =>
        withDesktop(sandboxId, abortSignal, async (sandbox) => {
          const result = await sandbox.computerUse.mouse.click(
            x,
            y,
            mouseButton,
            false,
            clicks
          )

          return {
            x: result.x ?? x,
            y: result.y ?? y,
          } satisfies PointerResult
        }),
    }),
    mouseMove: tool({
      description: "Move the pointer to x, y without clicking.",
      inputSchema: z.object({
        x: z.number().int(),
        y: z.number().int(),
      }),
      execute: async ({ x, y }, { abortSignal }) =>
        withDesktop(sandboxId, abortSignal, async (sandbox) => {
          const result = await sandbox.computerUse.mouse.move(x, y)

          return {
            x: result.x ?? x,
            y: result.y ?? y,
          } satisfies PointerResult
        }),
    }),
    mouseScroll: tool({
      description:
        "Scroll at x, y. direction is up, down, left, or right. amount is wheel ticks.",
      inputSchema: z.object({
        x: z.number().int(),
        y: z.number().int(),
        direction: scrollDirection,
        amount: z.number().int().min(1).max(20).default(1),
      }),
      execute: async ({ x, y, direction, amount }, { abortSignal }) =>
        withDesktop(sandboxId, abortSignal, async (sandbox) => {
          await sandbox.computerUse.mouse.scroll(x, y, direction, amount)

          return { x, y } satisfies PointerResult
        }),
    }),
    keyboardType: tool({
      description:
        "Type text into the focused desktop control. A newline presses Enter.",
      inputSchema: z.object({
        text: z.string().min(1).max(4_000),
      }),
      execute: async ({ text }, { abortSignal }) =>
        withDesktop(sandboxId, abortSignal, async (sandbox) => {
          await sandbox.computerUse.keyboard.type(text)
          return { typed: text.length }
        }),
    }),
    keyboardPress: tool({
      description:
        "Press a key, with optional ctrl, alt, shift, or cmd. Examples: enter, escape, tab, or c with ctrl.",
      inputSchema: z.object({
        key: z.string().min(1).max(32),
        modifiers: z.array(modifier).max(4).default([]),
      }),
      execute: async ({ key, modifiers }, { abortSignal }) =>
        withDesktop(sandboxId, abortSignal, async (sandbox) => {
          await sandbox.computerUse.keyboard.press(key, modifiers)
          return { key, modifiers }
        }),
    }),
    viewScreen: tool({
      description:
        "Look at the desktop before you click and after the screen changes. Returns a picture of the screen and the accessibility tree. Each control has a role, a name, and bounds as x, y, width, height from the top-left. Nothing from this tool is shown in the chat.",
      inputSchema: z.object({}),
      execute: async (_input, { abortSignal }) =>
        withDesktop(sandboxId, abortSignal, async (sandbox) => {
          const picture = await takePicture(sandbox)
          if ("error" in picture) {
            return picture
          }

          const screen = await readScreen(sandbox)
          if ("error" in screen) {
            return screen
          }

          return {
            image: picture.image,
            mediaType: picture.mediaType,
            screen: screen.screen,
          } satisfies ScreenView
        }),
      toModelOutput: ({ output }) =>
        pictureForModel(output, "error" in output ? undefined : output.screen),
    }),
    showScreen: tool({
      description:
        "Show a picture of the desktop to the user. Call it only when the user asks to see the screen.",
      inputSchema: z.object({}),
      execute: async (_input, { abortSignal }) =>
        withDesktop(sandboxId, abortSignal, (sandbox) => takePicture(sandbox)),
      toModelOutput: ({ output }) => pictureForModel(output),
    }),
  }
}
