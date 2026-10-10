import "server-only"

import { auth } from "@clerk/nextjs/server"
import { asc, desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { chatMembers, chats, type Bot, type Chat } from "@/lib/db/schema"

export type ChatWithBot = Chat & { bot: Bot }

/**
 * The signed-in user's chats, most recent activity first, each one carrying the
 * bot that gives it a face and a name.
 *
 * `userId` comes from the Clerk session and never from the caller, so a client
 * cannot ask for somebody else's chats. A direct chat is identified by its bot;
 * a group chat keeps its own name and borrows its earliest member as the face
 * until groups have an avatar of their own. Deleting a bot cascades its
 * membership away and leaves the chat behind, and a chat with no members has
 * neither a face nor a name, so it is dropped instead of rendered empty.
 */
export async function getChatsWithBot(): Promise<ChatWithBot[]> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return []
  }

  const rows = await db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: [desc(chats.lastMessageAt)],
    with: {
      chatMembers: {
        limit: 1,
        orderBy: [asc(chatMembers.joinedAt)],
        with: { bot: true },
      },
    },
  })

  return rows.flatMap(({ chatMembers, ...chat }) => {
    const bot = chatMembers[0]?.bot
    return bot ? [{ ...chat, bot }] : []
  })
}
