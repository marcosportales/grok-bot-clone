import "server-only"

import { auth } from "@clerk/nextjs/server"
import { and, asc, desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { chatMembers, chats, type Bot, type Chat } from "@/lib/db/schema"

export type ChatWithBots = Chat & { bots: Bot[] }

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
        orderBy: [asc(chatMembers.joinedAt), asc(chatMembers.botId)],
        with: { bot: true },
      },
    },
  })

  return rows.flatMap(({ chatMembers, ...chat }) => {
    const bots = chatMembers.map((member) => member.bot)
    return bots.length > 0 ? [{ ...chat, bots }] : []
  })
}

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
        orderBy: [asc(chatMembers.joinedAt), asc(chatMembers.botId)],
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
