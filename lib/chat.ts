import { getToolName, isToolUIPart, type UIMessage } from "ai"
import { differenceInSeconds, formatDistanceToNowStrict } from "date-fns"
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
  if (differenceInSeconds(new Date(), lastMessageAt) < 60) {
    return "now"
  }

  return formatDistanceToNowStrict(lastMessageAt, { addSuffix: false })
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
