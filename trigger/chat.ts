import { groq } from "@ai-sdk/groq"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import { asc, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { bots, chatMembers } from "@/lib/db/schema"

let pool: Pool | undefined

function database() {
  if (pool) {
    return drizzle({ client: pool })
  }

  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set")
  }

  pool = new Pool({ connectionString })

  // pg emits "error" when an idle client dies, and an unhandled "error" event ends the process.
  pool.on("error", (error) => {
    console.error("idle postgres client error", error)
  })

  return drizzle({ client: pool })
}

// Instructions live on the bot. Reading them here, on each turn, keeps an edit
// on the next message and keeps the client from supplying them. The earliest
// member is the bot the page already shows for this chat.
async function botInstructions(chatId: string) {
  const [member] = await database()
    .select({ instructions: bots.instructions })
    .from(chatMembers)
    .innerJoin(bots, eq(chatMembers.botId, bots.id))
    .where(eq(chatMembers.chatId, chatId))
    .orderBy(asc(chatMembers.joinedAt))
    .limit(1)

  if (!member) {
    console.error("chat has no bot", { chatId })
    throw new Error("Something went wrong.")
  }

  const instructions = member.instructions?.trim()

  return instructions || undefined
}

export const chatAgent = chat.agent({
  id: "chat",
  // The platform transcript is stored under the chat id.
  storage: defaultStorage,
  run: async ({ chatId, messages, signal, streamText }) => {
    const instructions = await botInstructions(chatId)

    return streamText({
      model: groq("openai/gpt-oss-20b"),
      system: instructions,
      messages,
      abortSignal: signal,
    })
  },
})
