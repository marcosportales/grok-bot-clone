import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { chatModel } from "@/lib/ai/model"
import { bots, chatMembers } from "@/lib/db/schema"

import { computerTools } from "./computer"
import { database } from "./db"

// The name, the job, the sandbox, and any instructions the owner wrote live on
// the bot. Reading them here, on each turn, keeps an edit on the next message
// and keeps the client from supplying them. The chosen bot is picked out of
// this chat's own members, so an id for a bot that belongs to somebody else, or
// one that was removed from the group, matches nothing and fails exactly the
// way a memberless chat already did.
async function botInstructions(chatId: string, botId: string | undefined) {
  const members = await database()
    .select({
      id: bots.id,
      name: bots.name,
      job: bots.job,
      instructions: bots.instructions,
      sandboxId: bots.sandboxId,
    })
    .from(chatMembers)
    .innerJoin(bots, eq(chatMembers.botId, bots.id))
    .where(eq(chatMembers.chatId, chatId))

  const member = members.find((candidate) => candidate.id === botId)

  if (!member) {
    console.error("chat has no bot", { chatId, botId })
    throw new Error("Something went wrong.")
  }

  return baseInstructions(member)
}

// `createSandbox` calls `daytona().create()` with no options, so a bot's
// sandbox is Daytona's default machine. The desktop is started later, the
// first time a mouse, keyboard, or screen tool runs.
const sandboxInstructions = [
  "You are in your own Daytona sandbox: an isolated Linux computer with 1 vCPU, 1 GB of memory, and 3 GiB of disk. It belongs to you alone.",
  "You can run commands, read and write files, and use the desktop with the mouse, the keyboard, and the screen. Paths are on that computer. A relative path starts at its working directory.",
  "The desktop is an XFCE session. It starts the first time you use the mouse, the keyboard, or the screen.",
  "viewScreen shows you the desktop: a picture of the screen and the accessibility tree. Each row is a control, with its role, name, and bounds as x, y, width, height from the top-left. Call it before you click and after the screen changes. It is never shown to the user.",
  "showScreen sends a picture of the desktop to the user. Call it only when they ask to see the screen.",
  "Call one tool and wait for its result before you call another. A click and a look at the screen are separate steps.",
  "Prefer bash, readFile, writeFile, and listFiles for anything that does not need the desktop.",
].join("\n\n")

function baseInstructions(bot: {
  name: string
  job: string
  instructions: string | null
  sandboxId: string | null
}) {
  const sections = [`Your name is ${bot.name}.`, `Your job is ${bot.job}.`]

  if (bot.sandboxId) {
    sections.push(sandboxInstructions)
  }

  const instructions = bot.instructions?.trim()
  if (instructions) {
    sections.push(`How you should work:\n${instructions}`)
  }

  return sections.join("\n\n")
}

export const chatAgent = chat.agent({
  id: "chat",
  // The platform transcript is stored under the chat id.
  storage: defaultStorage,
  // Which bot answers is the client's choice, and the schema is what keeps a
  // hand-rolled payload from reaching the run as anything else.
  clientDataSchema: z.object({ botId: z.string().min(1) }),
  // Declared here so each tool's toModelOutput is reapplied when a later turn
  // reloads the transcript. The run below receives this same set.
  tools: ({ chatId }) => computerTools(chatId),
  run: async ({ chatId, messages, tools, signal, clientData, streamText }) => {
    const instructions = await botInstructions(chatId, clientData?.botId)

    // Which member answers is the client's choice for this turn, and the next
    // turn may pick another. Stamping the id on the assistant message is what
    // lets a group chat read back who said what after a reload.
    chat.setUIMessageStreamOptions({
      messageMetadata: () => ({ botId: clientData?.botId }),
    })

    // `system` is the one prompt the managed streamText owns. The AI SDK reads
    // it as the model's instructions, and later injected context is appended
    // to it. Passing `instructions` as well would replace that prompt.
    return streamText({
      model: chatModel(),
      system: instructions,
      messages,
      tools,
      abortSignal: signal,
    })
  },
})
