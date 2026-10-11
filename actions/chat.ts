"use server"

import { auth } from "@trigger.dev/sdk"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"

import { getChatWithBot } from "@/queries/chat"

const startSession = chat.createStartSessionAction("chat")
const loadStoredTranscript = chat.createLoadTranscriptAction(defaultStorage)

// The chat id arrives from the browser. The row has to belong to the signed-in
// user before a session token or a transcript is handed back.
async function requireOwnedChat(chatId: string) {
  const owned = await getChatWithBot(chatId)

  if (!owned) {
    throw new Error("Something went wrong.")
  }
}

export async function startChatSession({ chatId }: { chatId: string }) {
  await requireOwnedChat(chatId)

  return startSession({ chatId })
}

export async function mintChatAccessToken(chatId: string) {
  await requireOwnedChat(chatId)

  return auth.createPublicToken({
    scopes: {
      read: { sessions: chatId },
      write: { sessions: chatId },
    },
    expirationTime: "1h",
  })
}

export async function loadChatTranscript(params: {
  chatId: string
  limit?: number
  before?: string
}) {
  await requireOwnedChat(params.chatId)

  return loadStoredTranscript(params)
}
