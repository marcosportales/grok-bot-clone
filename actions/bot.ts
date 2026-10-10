"use server"

import { auth } from "@clerk/nextjs/server"
import { and, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import {
  bots,
  chatMembers,
  chats,
  insertBotSchema,
  updateBotSchema,
  type InsertBot,
} from "@/lib/db/schema"

// Action return values are serialized into the RSC payload, so the row stays on
// the server and this shape carries only what the dialog renders.
type BotResult =
  { ok: true; bot: { id: string; name: string } } | { ok: false; error: string }

export async function createBot(input: InsertBot): Promise<BotResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { ok: false, error: "Sign in to create a bot." }
  }

  // A Server Action is a public endpoint, so the client's values get validated
  // again here rather than trusted.
  const parsed = insertBotSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That bot does not look right.",
    }
  }

  const { name, avatar, job, instructions } = parsed.data

  try {
    // One transaction, so a failure cannot leave a bot with no conversation.
    const createdBot = await db.transaction(async (tx) => {
      const [bot] = await tx
        .insert(bots)
        .values({
          userId,
          name,
          avatar,
          job,
          // An untouched textarea is "no instructions", which is null in SQL,
          // not an empty string.
          instructions: instructions?.trim() || null,
        })
        .returning({ id: bots.id, name: bots.name })

      // A direct chat is identified by its bot, so it needs no name of its own.
      const [chat] = await tx
        .insert(chats)
        .values({ userId, kind: "direct" })
        .returning({ id: chats.id })

      await tx.insert(chatMembers).values({ chatId: chat.id, botId: bot.id })

      return bot
    })

    revalidatePath("/")

    return { ok: true, bot: createdBot }
  } catch (error) {
    console.error("failed to create bot", error)
    return { ok: false, error: "Could not create the bot. Try again." }
  }
}

/**
 * Saves an edited bot. The id comes from the dialog rather than from a form
 * field, and it is matched against the session's `userId` as well, so a client
 * cannot edit a bot it does not own by naming its id.
 */
export async function updateBot(
  botId: string,
  input: InsertBot
): Promise<BotResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { ok: false, error: "Sign in to edit a bot." }
  }

  // A Server Action is a public endpoint, so the id and the values are
  // validated together here rather than trusted.
  const parsed = updateBotSchema.safeParse({ ...input, id: botId })
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That bot does not look right.",
    }
  }

  const { id, name, avatar, job, instructions } = parsed.data

  try {
    const [bot] = await db
      .update(bots)
      .set({ name, avatar, job, instructions: instructions?.trim() || null })
      .where(and(eq(bots.id, id), eq(bots.userId, userId)))
      .returning({ id: bots.id, name: bots.name })

    if (!bot) {
      return { ok: false, error: "That bot no longer exists." }
    }

    // The name and the face are the sidebar's rows and the chat's header too,
    // so the dashboard refresh covers the layout rather than the page under it.
    revalidatePath("/", "layout")

    return { ok: true, bot }
  } catch (error) {
    console.error("failed to update bot", error)
    return { ok: false, error: "Could not save the bot. Try again." }
  }
}

/**
 * Deletes a bot, and the direct chat that existed only for it. As with an edit,
 * the id is matched against the session's `userId`, so a client cannot delete a
 * bot it does not own.
 */
export async function deleteBot(botId: string): Promise<BotResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { ok: false, error: "Sign in to delete a bot." }
  }

  try {
    const bot = await db.transaction(async (tx) => {
      // Read the chats before the delete: a bot's membership rows cascade away
      // with the bot, and those rows are what names the chats it belonged to.
      const directChats = await tx
        .select({ id: chatMembers.chatId })
        .from(chatMembers)
        .innerJoin(chats, eq(chats.id, chatMembers.chatId))
        .where(
          and(
            eq(chatMembers.botId, botId),
            eq(chats.userId, userId),
            eq(chats.kind, "direct")
          )
        )

      const [deleted] = await tx
        .delete(bots)
        .where(and(eq(bots.id, botId), eq(bots.userId, userId)))
        .returning({ id: bots.id, name: bots.name })

      if (!deleted) {
        return null
      }

      // A direct chat is only ever about its bot, so the bot takes the chat with
      // it. A group chat keeps its other members and stays.
      if (directChats.length > 0) {
        await tx.delete(chats).where(
          inArray(
            chats.id,
            directChats.map((chat) => chat.id)
          )
        )
      }

      return deleted
    })

    if (!bot) {
      return { ok: false, error: "That bot no longer exists." }
    }

    // The bot was a sidebar row, so the dashboard refresh covers the layout
    // rather than the page under it.
    revalidatePath("/", "layout")

    return { ok: true, bot }
  } catch (error) {
    console.error("failed to delete bot", error)
    return { ok: false, error: "Could not delete the bot. Try again." }
  }
}
