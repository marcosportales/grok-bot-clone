"use server"

import { auth } from "@clerk/nextjs/server"
import { auth as triggerAuth } from "@trigger.dev/sdk"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import { and, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import {
  bots,
  chatMembers,
  chats,
  insertGroupChatSchema,
  type InsertGroupChat,
} from "@/lib/db/schema"
import { getChatWithBots } from "@/queries/chat"

const startSession = chat.createStartSessionAction("chat")
const loadStoredTranscript = chat.createLoadTranscriptAction(defaultStorage)

// The chat id arrives from the browser. The row has to belong to the signed-in
// user before a session token or a transcript is handed back.
async function requireOwnedChat(chatId: string) {
  const owned = await getChatWithBots(chatId)

  if (!owned) {
    throw new Error("Something went wrong.")
  }
}

export async function startChatSession({
  chatId,
  clientData,
}: {
  chatId: string
  clientData?: { botId: string }
}) {
  await requireOwnedChat(chatId)

  return startSession({ chatId, clientData })
}

export async function mintChatAccessToken(chatId: string) {
  await requireOwnedChat(chatId)

  return triggerAuth.createPublicToken({
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

type GroupChatResult =
  | { ok: true; chat: { id: string; name: string } }
  | { ok: false; error: string }

/**
 * Creates a group chat and its members. A group is a `chats` row of kind
 * `group` with a name of its own, plus one `chat_members` row per chosen bot,
 * so the two are written in one transaction.
 *
 * Every submitted bot id is read back from the caller's own bots inside that
 * transaction, because a Server Action is a public endpoint: an id for somebody
 * else's bot, or one that has since been deleted, leaves the count short and
 * creates nothing.
 */
export async function createGroupChat(
  input: InsertGroupChat
): Promise<GroupChatResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { ok: false, error: "Sign in to create a group chat." }
  }

  const parsed = insertGroupChatSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "That group does not look right.",
    }
  }

  const { name, botIds } = parsed.data

  try {
    const created = await db.transaction(async (tx) => {
      const owned = await tx
        .select({ id: bots.id })
        .from(bots)
        .where(and(eq(bots.userId, userId), inArray(bots.id, botIds)))

      if (owned.length !== botIds.length) {
        return null
      }

      const [chat] = await tx
        .insert(chats)
        .values({ userId, kind: "group", name })
        .returning({ id: chats.id })

      await tx
        .insert(chatMembers)
        .values(botIds.map((botId) => ({ chatId: chat.id, botId })))

      return chat
    })

    if (!created) {
      return { ok: false, error: "One of those bots no longer exists." }
    }

    // The new chat is a sidebar row, so the dashboard refresh covers the layout
    // rather than the page under it.
    revalidatePath("/", "layout")

    return { ok: true, chat: { id: created.id, name } }
  } catch (error) {
    console.error("failed to create group chat", error)
    return { ok: false, error: "Could not create the group. Try again." }
  }
}
