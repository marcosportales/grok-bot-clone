import { getToolName, isToolUIPart, type UIMessage } from "ai"
import { differenceInSeconds, formatDistanceToNowStrict } from "date-fns"
import { z } from "zod"

import type { ChatWithBots } from "@/queries/chat"

// The one thing the chat agent writes onto an assistant message: which member
// answered that turn.
const botMessageMetadataSchema = z.object({ botId: z.string().min(1) })

/**
 * The bot that answered a message, or undefined when the message carries no
 * such stamp: a user's own message, or an assistant one written before the
 * agent tagged them.
 *
 * `metadata` comes back from the transcript as `unknown`, so it is parsed here
 * rather than asserted.
 */
export function botIdFromMessage(message: UIMessage): string | undefined {
  const parsed = botMessageMetadataSchema.safeParse(message.metadata)

  return parsed.success ? parsed.data.botId : undefined
}

// What the thread needs off a handoff result to follow it: the member the
// request was given to, and the name the card draws. The rest of the result is
// the model's, and the card reads it off the part directly.
const handoffOutputSchema = z.object({
  botId: z.string().min(1),
  name: z.string().min(1),
})

export type Handoff = z.infer<typeof handoffOutputSchema> & {
  toolCallId: string
}

/**
 * The handoff a message holds, or undefined when it holds none. The call id is
 * carried back with it so the thread can tell a handoff it has already
 * followed from the same one arriving again.
 *
 * A tool's result comes back from the transcript as `unknown`, so it is parsed
 * here rather than asserted.
 */
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

/**
 * The bots that have answered since the user's last message, oldest first.
 *
 * A group hands one request along this chain, and a handoff back to a member
 * already on it is refused. That is what stops two bots handing the same
 * request to each other for as long as the user says nothing new.
 */
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

// A face is one seed for a direct chat and one seed per member for a group, so
// a caller that has only the summary still cannot draw the wrong one.
export type ChatFace =
  { kind: "single"; seed: string } | { kind: "group"; seeds: string[] }

/**
 * A chat as a row renders it. The sidebar list and the search results both
 * draw from this, so the two cannot drift apart, and the bots' instructions
 * never leave the server on the way to the client.
 */
export type ChatSummaryData = {
  id: string
  face: ChatFace
  title: string
  age: string
  preview: string
}

// A chat list mixes "just now" with "last week", and a row reads faster with an
// age than with a date the reader has to place in the week. date-fns words it
// ("2 days", "3 hours"), and a chat that moved within the minute reads better as
// "now" than as its own "0 seconds".
function chatAge(lastMessageAt: Date) {
  if (differenceInSeconds(new Date(), lastMessageAt) < 60) {
    return "now"
  }

  return formatDistanceToNowStrict(lastMessageAt, { addSuffix: false })
}

// A direct chat is identified by its bot, so it carries no name of its own.
function chatTitle(chat: ChatWithBots) {
  return chat.name ?? chat.bots[0].name
}

// Before the first message, the bot's job is what the chat is about.
function chatPreview(chat: ChatWithBots) {
  return chat.lastMessagePreview ?? chat.bots[0].job
}

// A group's face is every member, not only the first: the avatar lays them out
// itself and needs the whole list to know what did not fit.
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
