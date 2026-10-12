"use client"

import { getToolName, type DynamicToolUIPart, type ToolUIPart } from "ai"
import { FileIcon, FolderIcon } from "lucide-react"
import type { ReactNode } from "react"
import type { BundledLanguage } from "shiki"

import { CodeBlock } from "@/components/ai-elements/code-block"
import { Image } from "@/components/ai-elements/image"
import {
  Sandbox,
  SandboxContent,
  SandboxHeader,
  SandboxTabContent,
  SandboxTabs,
  SandboxTabsBar,
  SandboxTabsList,
  SandboxTabsTrigger,
} from "@/components/ai-elements/sandbox"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from "@/components/ai-elements/tool"
import { Badge } from "@/components/ui/badge"

const languages: Record<string, BundledLanguage> = {
  bash: "bash",
  css: "css",
  go: "go",
  html: "html",
  js: "javascript",
  json: "json",
  jsx: "jsx",
  md: "markdown",
  py: "python",
  rs: "rust",
  sh: "bash",
  sql: "sql",
  toml: "toml",
  ts: "typescript",
  tsx: "tsx",
  yaml: "yaml",
  yml: "yaml",
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function stringField(value: unknown, key: string): string {
  if (!isRecord(value)) {
    return ""
  }

  const field = value[key]
  return typeof field === "string" ? field : ""
}

function numberField(value: unknown, key: string): number | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const field = value[key]
  return typeof field === "number" ? field : undefined
}

function stringList(value: unknown, key: string): string[] {
  if (!isRecord(value) || !Array.isArray(value[key])) {
    return []
  }

  return value[key].filter((item) => typeof item === "string")
}

function errorOf(value: unknown): string | undefined {
  const error = stringField(value, "error")
  return error.length > 0 ? error : undefined
}

function clip(value: string, max = 80): string {
  const line = value.split("\n")[0] ?? ""
  return line.length > max ? `${line.slice(0, max)}…` : line
}

function languageForPath(path: string): BundledLanguage {
  const extension = path.split(".").pop()?.toLowerCase() ?? ""
  return languages[extension] ?? "log"
}

function displayState(part: ToolPart): ToolPart["state"] {
  if (part.state === "output-available" && errorOf(part.output)) {
    return "output-error"
  }

  return part.state
}

function headerProps(part: ToolPart, title: string) {
  const state = displayState(part)

  if (part.type === "dynamic-tool") {
    return {
      type: part.type,
      state,
      toolName: part.toolName,
      title,
    }
  }

  return {
    type: part.type,
    state,
    title,
  }
}

function ToolFrame({
  part,
  title,
  defaultOpen,
  children,
}: {
  part: ToolPart
  title: string
  defaultOpen?: boolean
  children?: ReactNode
}) {
  const failure =
    part.state === "output-error"
      ? part.errorText
      : part.state === "output-available"
        ? errorOf(part.output)
        : undefined

  return (
    <Tool
      className="mb-0"
      defaultOpen={defaultOpen ?? part.state !== "input-streaming"}
    >
      <ToolHeader {...headerProps(part, title)} />
      {children || failure ? (
        <ToolContent>
          {children}
          {failure ? (
            <ToolOutput errorText={failure} output={undefined} />
          ) : null}
        </ToolContent>
      ) : null}
    </Tool>
  )
}

function BashTool({ part }: { part: ToolPart }) {
  const command = stringField(part.input, "command")
  const cwd = stringField(part.input, "cwd")
  const output =
    part.state === "output-available" ? stringField(part.output, "output") : ""
  const exitCode =
    part.state === "output-available"
      ? numberField(part.output, "exitCode")
      : undefined
  const title = clip(cwd ? `${cwd} $ ${command}` : command) || "bash"

  return (
    <Sandbox className="mb-0" defaultOpen={part.state !== "input-streaming"}>
      <SandboxHeader state={displayState(part)} title={title} />
      <SandboxContent>
        <SandboxTabs
          defaultValue={part.state === "output-available" ? "output" : "code"}
        >
          <SandboxTabsBar>
            <SandboxTabsList>
              <SandboxTabsTrigger value="code">Command</SandboxTabsTrigger>
              <SandboxTabsTrigger value="output">Output</SandboxTabsTrigger>
            </SandboxTabsList>
          </SandboxTabsBar>
          <SandboxTabContent value="code">
            <CodeBlock code={command} language="bash" />
          </SandboxTabContent>
          <SandboxTabContent value="output">
            <div className="flex flex-col gap-2">
              {exitCode != null && exitCode !== 0 ? (
                <div className="px-4 pt-3">
                  <Badge variant="destructive">Exit {exitCode}</Badge>
                </div>
              ) : null}
              <CodeBlock code={output} language="log" />
            </div>
          </SandboxTabContent>
        </SandboxTabs>
        {part.state === "output-error" ? (
          <div className="p-4">
            <ToolOutput errorText={part.errorText} output={undefined} />
          </div>
        ) : null}
        {part.state === "output-available" && errorOf(part.output) ? (
          <div className="p-4">
            <ToolOutput errorText={errorOf(part.output)} output={undefined} />
          </div>
        ) : null}
      </SandboxContent>
    </Sandbox>
  )
}

function ReadFileTool({ part }: { part: ToolPart }) {
  const path = stringField(part.input, "path")
  const content =
    part.state === "output-available" ? stringField(part.output, "content") : ""

  return (
    <ToolFrame part={part} title={path ? `Read ${clip(path)}` : "Read file"}>
      {part.state === "output-available" && content ? (
        <CodeBlock code={content} language={languageForPath(path)} />
      ) : null}
    </ToolFrame>
  )
}

function WriteFileTool({ part }: { part: ToolPart }) {
  const path = stringField(part.input, "path")
  const content = stringField(part.input, "content")
  const bytes =
    part.state === "output-available"
      ? numberField(part.output, "bytes")
      : undefined

  return (
    <ToolFrame
      defaultOpen={
        openOnError(part) || (content.length > 0 && content.length < 400)
      }
      part={part}
      title={path ? `Write ${clip(path)}` : "Write file"}
    >
      {content ? (
        <CodeBlock code={content} language={languageForPath(path)} />
      ) : null}
      {bytes != null ? (
        <p className="text-xs text-muted-foreground">Wrote {bytes} bytes.</p>
      ) : null}
    </ToolFrame>
  )
}

type ListedEntry = {
  name: string
  path: string
  isDir: boolean
  size: number
}

function entriesOf(value: unknown): ListedEntry[] {
  if (!isRecord(value) || !Array.isArray(value.entries)) {
    return []
  }

  return value.entries.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.name !== "string") {
      return []
    }

    return [
      {
        name: entry.name,
        path: typeof entry.path === "string" ? entry.path : entry.name,
        isDir: entry.isDir === true,
        size: typeof entry.size === "number" ? entry.size : 0,
      },
    ]
  })
}

function ListFilesTool({ part }: { part: ToolPart }) {
  const path = stringField(part.input, "path") || "."
  const entries =
    part.state === "output-available" ? entriesOf(part.output) : []
  const truncated =
    part.state === "output-available" &&
    isRecord(part.output) &&
    part.output.truncated === true

  return (
    <ToolFrame part={part} title={`List ${clip(path)}`}>
      {entries.length > 0 ? (
        <div className="flex flex-col gap-1 font-mono text-xs">
          {entries.map((entry) => (
            <div className="flex items-center gap-2" key={entry.path}>
              {entry.isDir ? (
                <FolderIcon className="size-4 text-muted-foreground" />
              ) : (
                <FileIcon className="size-4 text-muted-foreground" />
              )}
              <span className="truncate">
                {entry.isDir ? `${entry.name}/` : entry.name}
              </span>
              {entry.isDir ? null : (
                <span className="text-muted-foreground">{entry.size}</span>
              )}
            </div>
          ))}
          {truncated ? (
            <p className="text-muted-foreground">More files were not listed.</p>
          ) : null}
        </div>
      ) : null}
    </ToolFrame>
  )
}

function moveTitle(input: unknown): string {
  const x = numberField(input, "x")
  const y = numberField(input, "y")

  if (x == null || y == null) {
    return "Move"
  }

  return `Move to ${x}, ${y}`
}

function pointTitle(label: string, input: unknown, suffix?: string): string {
  const x = numberField(input, "x")
  const y = numberField(input, "y")

  if (x == null || y == null) {
    return label
  }

  return suffix ? `${label} ${suffix} at ${x}, ${y}` : `${label} at ${x}, ${y}`
}

function openOnError(part: ToolPart): boolean {
  if (part.state === "output-error") {
    return true
  }

  return part.state === "output-available" && errorOf(part.output) != null
}

function PointerTool({ part, title }: { part: ToolPart; title: string }) {
  return (
    <ToolFrame defaultOpen={openOnError(part)} part={part} title={title}>
      {null}
    </ToolFrame>
  )
}

function KeyboardTypeTool({ part }: { part: ToolPart }) {
  const text = stringField(part.input, "text")

  return (
    <ToolFrame
      defaultOpen={openOnError(part) || text.includes("\n")}
      part={part}
      title={clip(text) || "Type"}
    >
      {text.includes("\n") ? <CodeBlock code={text} language="log" /> : null}
    </ToolFrame>
  )
}

function KeyboardPressTool({ part }: { part: ToolPart }) {
  const key = stringField(part.input, "key")
  const modifiers = stringList(part.input, "modifiers")
  const title = key ? [...modifiers, key].join("+") : "Press key"

  return (
    <ToolFrame defaultOpen={openOnError(part)} part={part} title={title}>
      {null}
    </ToolFrame>
  )
}

function ShowScreenTool({ part }: { part: ToolPart }) {
  const image =
    part.state === "output-available" ? stringField(part.output, "image") : ""
  const mediaType = stringField(part.output, "mediaType") || "image/jpeg"

  return (
    <Tool className="mb-0" defaultOpen>
      <ToolHeader {...headerProps(part, "Screen")} />
      <ToolContent>
        {image ? (
          <Image
            alt="The desktop"
            base64={image}
            className="max-h-96 w-full"
            mediaType={mediaType}
            uint8Array={new Uint8Array()}
          />
        ) : null}
        {part.state === "output-error" ? (
          <ToolOutput errorText={part.errorText} output={undefined} />
        ) : null}
        {part.state === "output-available" && errorOf(part.output) ? (
          <ToolOutput errorText={errorOf(part.output)} output={undefined} />
        ) : null}
      </ToolContent>
    </Tool>
  )
}

function HandoffTool({ part }: { part: ToolPart }) {
  const name = stringField(part.output, "name")
  const reason = stringField(part.output, "reason")

  return (
    <ToolFrame
      defaultOpen
      part={part}
      title={name ? `Handed off to ${name}` : "Handoff"}
    >
      {reason ? (
        <p className="text-sm text-muted-foreground">{reason}</p>
      ) : null}
    </ToolFrame>
  )
}

function GenericTool({ part }: { part: ToolPart }) {
  const name = getToolName(part)

  return (
    <ToolFrame part={part} title={name}>
      <ToolInput input={part.input} />
      {part.state === "output-available" && !errorOf(part.output) ? (
        <ToolOutput errorText={undefined} output={part.output} />
      ) : null}
    </ToolFrame>
  )
}

function ChatToolPart({ part }: { part: ToolUIPart | DynamicToolUIPart }) {
  const name = getToolName(part)

  switch (name) {
    case "viewScreen":
      return null
    case "bash":
      return <BashTool part={part} />
    case "readFile":
      return <ReadFileTool part={part} />
    case "writeFile":
      return <WriteFileTool part={part} />
    case "listFiles":
      return <ListFilesTool part={part} />
    case "mouseClick":
      return (
        <PointerTool
          part={part}
          title={pointTitle(
            "Click",
            part.input,
            stringField(part.input, "button") || "left"
          )}
        />
      )
    case "mouseMove":
      return <PointerTool part={part} title={moveTitle(part.input)} />
    case "mouseScroll":
      return (
        <PointerTool
          part={part}
          title={pointTitle(
            "Scroll",
            part.input,
            stringField(part.input, "direction")
          )}
        />
      )
    case "keyboardType":
      return <KeyboardTypeTool part={part} />
    case "keyboardPress":
      return <KeyboardPressTool part={part} />
    case "handoff":
      return <HandoffTool part={part} />
    case "showScreen":
      return <ShowScreenTool part={part} />
    default:
      return <GenericTool part={part} />
  }
}

export { ChatToolPart }
