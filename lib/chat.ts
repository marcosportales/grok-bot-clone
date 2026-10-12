import { getToolName, isToolUIPart, type UIMessage } from "ai"
import { differenceInSeconds, format } from "date-fns"
import { z } from "zod"

import type { UpdateGroupChat } from "@/lib/db/schema"
import type { ChatWithBots } from "@/queries/chat"

const botMessageMetadataSchema = z.object({ botId: z.string().min(1) })

export function botIdFromMessage(message: UIMessage): string | undefined {
  const parsed = botMessageMetadataSchema.safeParse(message.metadata)

  return parsed.success ? parsed.data.botId : undefined
}

const handoffOutputSchema = z.object({
  botId: z.string().min(1),
  name: z.string().min(1),
})

export type Handoff = z.infer<typeof handoffOutputSchema> & {
  toolCallId: string
}

export function handoffFromMessage(message: UIMessage): Handoff | undefined {
  for (const part of message.parts) {
    if (!isToolUIPart(part) || getToolName(part) !== "handoff") {
      continue
    }

    if (part.state !== "output-available") {
      continue
    }

    const parsed = handoffOutputSchema.safeParse(part.output)

    if (parsed.success) {
      return { toolCallId: part.toolCallId, ...parsed.data }
    }
  }

  return undefined
}

export function answeredSinceUser(messages: UIMessage[]): string[] {
  const answered: string[] = []

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]

    if (message.role === "user") {
      break
    }

    if (message.role !== "assistant") {
      continue
    }

    const botId = botIdFromMessage(message)

    if (botId) {
      answered.unshift(botId)
    }
  }

  return answered
}

export type ChatFace =
  { kind: "single"; seed: string } | { kind: "group"; seeds: string[] }

export type ChatSummaryData = {
  id: string
  face: ChatFace
  title: string
  age: string
  preview: string
}

function chatAge(lastMessageAt: Date) {
  const seconds = differenceInSeconds(new Date(), lastMessageAt)

  if (seconds < 60) {
    return "just now"
  }

  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} min`
  }

  if (seconds < 86_400) {
    const hours = Math.floor(seconds / 3600)

    return `${hours} ${hours === 1 ? "hour" : "hours"}`
  }

  if (seconds < 604_800) {
    const days = Math.floor(seconds / 86_400)

    return `${days} ${days === 1 ? "day" : "days"}`
  }

  return format(lastMessageAt, "MMM d")
}

const previewLimit = 120

export function lastUserMessagePreview(
  uiMessages: UIMessage[]
): string | undefined {
  for (let index = uiMessages.length - 1; index >= 0; index -= 1) {
    const message = uiMessages[index]

    if (message.role !== "user") {
      continue
    }

    const text = message.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .filter((text) => text.length > 0)
      .join(" ")
      .trim()

    return text ? text.slice(0, previewLimit) : undefined
  }

  return undefined
}

function chatTitle(chat: ChatWithBots) {
  return chat.name ?? chat.bots[0].name
}

function chatPreview(chat: ChatWithBots) {
  return chat.lastMessagePreview ?? chat.bots[0].job
}

function chatFace(chat: ChatWithBots): ChatFace {
  if (chat.kind === "group") {
    return { kind: "group", seeds: chat.bots.map((bot) => bot.avatar) }
  }

  return { kind: "single", seed: chat.bots[0].avatar }
}

export function toChatSummary(chat: ChatWithBots): ChatSummaryData {
  return {
    id: chat.id,
    face: chatFace(chat),
    title: chatTitle(chat),
    age: chatAge(chat.lastMessageAt),
    preview: chatPreview(chat),
  }
}

export function toEditableGroupChat(chat: ChatWithBots): UpdateGroupChat {
  return {
    id: chat.id,
    name: chat.name ?? "",
    botIds: chat.bots.map((bot) => bot.id),
  }
}
