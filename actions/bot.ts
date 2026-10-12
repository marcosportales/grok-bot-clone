"use server"

import { auth } from "@clerk/nextjs/server"
import { and, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { missingFeature, type UpgradeRequired } from "@/lib/billing"
import { db } from "@/lib/db"
import {
  bots,
  chatMembers,
  chats,
  insertBotSchema,
  updateBotSchema,
  type InsertBot,
} from "@/lib/db/schema"
import { createSandbox, deleteSandbox } from "@/lib/sandbox"
import { missingAllowance } from "@/lib/usage/quota"
import { accrueSandboxTime } from "@/lib/usage/sandbox"

type BotResult =
  | { ok: true; bot: { id: string; name: string } }
  | { ok: false; error: string }
  | UpgradeRequired

export async function createBot(input: InsertBot): Promise<BotResult> {
  const { isAuthenticated, userId, has } = await auth()
  if (!isAuthenticated) {
    return { ok: false, error: "Sign in to create a bot." }
  }

  const parsed = insertBotSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That bot does not look right.",
    }
  }

  const blocked = missingFeature(has, "bots")
  if (blocked) {
    return blocked
  }

  // A bot is a sandbox held, so this is the sandbox-creation boundary too.
  const outOfAllowance = await missingAllowance(has, userId, "bots")
  if (outOfAllowance) {
    return outOfAllowance
  }

  const { name, avatar, job, instructions } = parsed.data

  let sandboxId: string
  try {
    sandboxId = await createSandbox()
  } catch (error) {
    console.error("failed to create sandbox", error)
    return { ok: false, error: "Could not create the bot. Try again." }
  }

  try {
    const createdBot = await db.transaction(async (tx) => {
      const [bot] = await tx
        .insert(bots)
        .values({
          userId,
          name,
          avatar,
          job,
          sandboxId,
          instructions: instructions?.trim() || null,
        })
        .returning({ id: bots.id, name: bots.name })

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
    try {
      await deleteSandbox(sandboxId)
    } catch (cleanupError) {
      console.error(
        "failed to delete sandbox after bot create failed",
        cleanupError
      )
    }
    return { ok: false, error: "Could not create the bot. Try again." }
  }
}

export async function updateBot(
  botId: string,
  input: InsertBot
): Promise<BotResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { ok: false, error: "Sign in to edit a bot." }
  }

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

    revalidatePath("/", "layout")

    return { ok: true, bot }
  } catch (error) {
    console.error("failed to update bot", error)
    return { ok: false, error: "Could not save the bot. Try again." }
  }
}

export async function deleteBot(botId: string): Promise<BotResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { ok: false, error: "Sign in to delete a bot." }
  }

  const [existing] = await db
    .select({ sandboxId: bots.sandboxId })
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.userId, userId)))

  if (!existing) {
    return { ok: false, error: "That bot no longer exists." }
  }

  if (existing.sandboxId) {
    try {
      // The window the sandbox ran after its last touch closes here, while the
      // row that holds the cursor is still there to bill it from.
      await accrueSandboxTime(db, { botId, userId })
    } catch (meteringError) {
      // A delete the user asked for is not undone by its metering failing.
      console.error("failed to record sandbox usage", { botId, meteringError })
    }

    try {
      await deleteSandbox(existing.sandboxId)
    } catch (error) {
      console.error("failed to delete sandbox", error)
      return { ok: false, error: "Could not delete the bot. Try again." }
    }
  }

  try {
    const bot = await db.transaction(async (tx) => {
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

    revalidatePath("/", "layout")

    return { ok: true, bot }
  } catch (error) {
    console.error("failed to delete bot", error)
    return { ok: false, error: "Could not delete the bot. Try again." }
  }
}
