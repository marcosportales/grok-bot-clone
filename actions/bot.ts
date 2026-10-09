"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { bots, insertBotSchema, type InsertBot } from "@/lib/db/schema"

// Action return values are serialized into the RSC payload, so the row stays on
// the server and this shape carries only what the dialog renders.
type CreateBotResult =
  { ok: true; bot: { id: string; name: string } } | { ok: false; error: string }

export async function createBot(input: InsertBot): Promise<CreateBotResult> {
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
    const [bot] = await db
      .insert(bots)
      .values({
        userId,
        name,
        avatar,
        job,
        // An untouched textarea is "no instructions", which is null in SQL, not
        // an empty string.
        instructions: instructions?.trim() || null,
      })
      .returning({ id: bots.id, name: bots.name })

    revalidatePath("/")

    return { ok: true, bot }
  } catch (error) {
    console.error("failed to create bot", error)
    return { ok: false, error: "Could not create the bot. Try again." }
  }
}
