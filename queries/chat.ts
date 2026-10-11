import "server-only"

import { auth } from "@clerk/nextjs/server"
import { and, asc, desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { chatMembers, chats, type Bot, type Chat } from "@/lib/db/schema"

export type ChatWithBots = Chat & { bots: Bot[] }

/**
 * The signed-in user's chats, most recent activity first, each one carrying
 * every member it has, oldest first.
 *
 * `userId` comes from the Clerk session and never from the caller, so a client
 * cannot ask for somebody else's chats. A direct chat is identified by its one
 * bot; a group chat keeps its own name and draws a face from all of its
 * members. Deleting a bot cascades its membership away and leaves the chat
 * behind, and a chat with no members has neither a face nor a name, so it is
 * dropped instead of rendered empty.
 */
export async function getChatsWithBots(): Promise<ChatWithBots[]> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return []
  }

  const rows = await db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: [desc(chats.lastMessageAt)],
    with: {
      chatMembers: {
        orderBy: [asc(chatMembers.joinedAt)],
        with: { bot: true },
      },
    },
  })

  return rows.flatMap(({ chatMembers, ...chat }) => {
    const bots = chatMembers.map((member) => member.bot)
    return bots.length > 0 ? [{ ...chat, bots }] : []
  })
}

/**
 * One chat with the same members the list gives it, or null when the id names
 * no chat of the signed-in user.
 *
 * The id arrives from the URL, so it is treated as a caller-supplied value: the
 * row has to match both the id and the session's `userId`. A chat belonging to
 * somebody else matches nothing and reads as missing, which is what keeps the
 * two cases indistinguishable from outside.
 */
export async function getChatWithBots(
  chatId: string
): Promise<ChatWithBots | null> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return null
  }

  const row = await db.query.chats.findFirst({
    where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
    with: {
      chatMembers: {
        orderBy: [asc(chatMembers.joinedAt)],
        with: { bot: true },
      },
    },
  })

  if (!row) {
    return null
  }

  const { chatMembers: members, ...chat } = row
  const bots = members.map((member) => member.bot)

  return bots.length > 0 ? { ...chat, bots } : null
}
