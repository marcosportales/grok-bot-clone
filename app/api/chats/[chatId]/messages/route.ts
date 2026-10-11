import { groq } from "@ai-sdk/groq"
import { auth } from "@clerk/nextjs/server"
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
} from "ai"

import { getChatWithBot } from "@/queries/chat"

export const maxDuration = 30

const errorBody = { error: "Something went wrong." }

export async function POST(
  req: Request,
  context: { params: Promise<{ chatId: string }> }
) {
  try {
    const { isAuthenticated } = await auth()

    if (!isAuthenticated) {
      return Response.json(errorBody, { status: 401 })
    }

    const { chatId } = await context.params
    const chat = await getChatWithBot(chatId)

    if (!chat) {
      return Response.json(errorBody, { status: 404 })
    }

    const body: unknown = await req.json()
    const messages =
      typeof body === "object" && body !== null && "messages" in body
        ? body.messages
        : undefined

    const validated = await safeValidateUIMessages({ messages })

    if (!validated.success || validated.data.length === 0) {
      return Response.json(errorBody, { status: 400 })
    }

    const instructions = chat.bot.instructions?.trim() || undefined
    const result = streamText({
      model: groq("openai/gpt-oss-20b"),
      instructions,
      messages: await convertToModelMessages(validated.data),
    })

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    })
  } catch (error) {
    console.error(error)
    return Response.json(errorBody, { status: 500 })
  }
}
