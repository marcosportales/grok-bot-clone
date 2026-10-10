import { differenceInSeconds, formatDistanceToNowStrict } from "date-fns"

import type { ChatWithBot } from "@/queries/chat"

/**
 * A chat as a row renders it. The sidebar list and the search results both
 * draw from this, so the two cannot drift apart, and the bot's instructions
 * never leave the server on the way to the client.
 */
export type ChatSummaryData = {
  id: string
  /** The bot's DiceBear seed, which is the row's face. */
  avatar: string
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
function chatTitle(chat: ChatWithBot) {
  return chat.name ?? chat.bot.name
}

// Before the first message, the bot's job is what the chat is about.
function chatPreview(chat: ChatWithBot) {
  return chat.lastMessagePreview ?? chat.bot.job
}

export function toChatSummary(chat: ChatWithBot): ChatSummaryData {
  return {
    id: chat.id,
    avatar: chat.bot.avatar,
    title: chatTitle(chat),
    age: chatAge(chat.lastMessageAt),
    preview: chatPreview(chat),
  }
}
