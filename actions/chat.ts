"use server"

import { auth } from "@clerk/nextjs/server"
import { auth as triggerAuth } from "@trigger.dev/sdk"
import {
  chat,
  defaultStorage,
  type ChatStartSessionResult,
} from "@trigger.dev/sdk/ai"
import { and, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { missingFeature, type UpgradeRequired } from "@/lib/billing"
import { db } from "@/lib/db"
import {
  bots,
  chatMembers,
  chats,
  insertGroupChatSchema,
  updateGroupChatSchema,
  type InsertGroupChat,
  type UpdateGroupChat,
} from "@/lib/db/schema"
import { missingAllowance } from "@/lib/usage/quota"
import { getChatWithBots, type ChatWithBots } from "@/queries/chat"

const startSession = chat.createStartSessionAction("chat")
const loadStoredTranscript = chat.createLoadTranscriptAction(defaultStorage)

async function requireOwnedChat(chatId: string): Promise<ChatWithBots> {
  const owned = await getChatWithBots(chatId)

  if (!owned) {
    throw new Error("Something went wrong.")
  }

  return owned
}

export async function startChatSession({
  chatId,
  clientData,
}: {
  chatId: string
  clientData?: { botId: string }
}): Promise<ChatStartSessionResult | UpgradeRequired> {
  const ownedChat = await requireOwnedChat(chatId)

  const { has } = await auth()
  const blocked = missingFeature(has, "bots")
  if (blocked) {
    return blocked
  }

  // The first send of a page session is the only clear-message path that reaches
  // the server, so the token stop for the whole session is decided here.
  const spent = await missingAllowance(has, ownedChat.userId, "ai_tokens")
  if (spent) {
    return spent
  }

  return startSession({ chatId, clientData })
}

export async function mintChatAccessToken(
  chatId: string
): Promise<string | UpgradeRequired> {
  await requireOwnedChat(chatId)

  const { has } = await auth()
  const blocked = missingFeature(has, "sandboxes")
  if (blocked) {
    return blocked
  }

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

    revalidatePath("/", "layout")

    return { ok: true, chat: { id: created.id, name } }
  } catch (error) {
    console.error("failed to create group chat", error)
    return { ok: false, error: "Could not create the group. Try again." }
  }
}

export async function updateGroupChat(
  input: UpdateGroupChat
): Promise<GroupChatResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { ok: false, error: "Sign in to edit a group chat." }
  }

  const parsed = updateGroupChatSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "That group does not look right.",
    }
  }

  const { id, name, botIds } = parsed.data

  try {
    const outcome = await db.transaction(async (tx) => {
      const [chat] = await tx
        .select({ id: chats.id })
        .from(chats)
        .where(
          and(
            eq(chats.id, id),
            eq(chats.userId, userId),
            eq(chats.kind, "group")
          )
        )

      if (!chat) {
        return {
          ok: false,
          error: "That group chat no longer exists.",
        } as const
      }

      const owned = await tx
        .select({ id: bots.id })
        .from(bots)
        .where(and(eq(bots.userId, userId), inArray(bots.id, botIds)))

      if (owned.length !== botIds.length) {
        return {
          ok: false,
          error: "One of those bots no longer exists.",
        } as const
      }

      const members = await tx
        .select({ botId: chatMembers.botId })
        .from(chatMembers)
        .where(eq(chatMembers.chatId, id))

      const current = new Set(members.map((member) => member.botId))
      const next = new Set(botIds)
      const removed = [...current].filter((botId) => !next.has(botId))
      const added = botIds.filter((botId) => !current.has(botId))

      await tx.update(chats).set({ name }).where(eq(chats.id, id))

      if (removed.length > 0) {
        await tx
          .delete(chatMembers)
          .where(
            and(eq(chatMembers.chatId, id), inArray(chatMembers.botId, removed))
          )
      }

      // Rewriting every row would reset joined_at, and the oldest member's row
      // decides whose sandbox the group works on.
      if (added.length > 0) {
        await tx
          .insert(chatMembers)
          .values(added.map((botId) => ({ chatId: id, botId })))
      }

      return { ok: true } as const
    })

    if (!outcome.ok) {
      return outcome
    }

    revalidatePath("/", "layout")

    return { ok: true, chat: { id, name } }
  } catch (error) {
    console.error("failed to update group chat", error)
    return { ok: false, error: "Could not save the group. Try again." }
  }
}

export async function deleteGroupChat(
  chatId: string
): Promise<GroupChatResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { ok: false, error: "Sign in to delete a group chat." }
  }

  try {
    const [chat] = await db
      .delete(chats)
      .where(
        and(
          eq(chats.id, chatId),
          eq(chats.userId, userId),
          eq(chats.kind, "group")
        )
      )
      .returning({ id: chats.id, name: chats.name })

    if (!chat) {
      return { ok: false, error: "That group chat no longer exists." }
    }

    revalidatePath("/", "layout")

    return { ok: true, chat: { id: chat.id, name: chat.name ?? "" } }
  } catch (error) {
    console.error("failed to delete group chat", error)
    return { ok: false, error: "Could not delete the group. Try again." }
  }
}
