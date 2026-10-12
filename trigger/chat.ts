import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import { stepCountIs } from "ai"
import { z } from "zod"

import { chatModel } from "@/lib/ai/model"

import { computerTools } from "./computer"
import {
  groupFor,
  handoffTools,
  type ChatGroup,
  type GroupMember,
} from "./group"

const sandboxTools = [
  "You can run commands, read and write files, and use the desktop with the mouse, the keyboard, and the screen. Paths are on that computer. A relative path starts at its working directory.",
  "The desktop is an XFCE session. It starts the first time you use the mouse, the keyboard, or the screen.",
  "viewScreen shows you the desktop: a picture of the screen and the accessibility tree. Each row is a control, with its role, name, and bounds as x, y, width, height from the top-left. Call it before you click and after the screen changes. It is never shown to the user.",
  "showScreen sends a picture of the desktop to the user. Call it only when they ask to see the screen.",
  "Call one tool and wait for its result before you call another. A click and a look at the screen are separate steps.",
  "Prefer bash, readFile, writeFile, and listFiles for anything that does not need the desktop.",
].join("\n\n")

function sandboxInstructions(group: ChatGroup, member: GroupMember) {
  const owner = group.members[0]
  const machine =
    owner.id === member.id
      ? "You are in your own Daytona sandbox: an isolated Linux computer with 1 vCPU, 1 GB of memory, and 3 GiB of disk. It belongs to you alone."
      : `This group shares one computer: ${owner.name}'s Daytona sandbox, an isolated Linux machine with 1 vCPU, 1 GB of memory, and 3 GiB of disk. Every member works on the same files and the same desktop, so the work another member started is already there when a request reaches you.`

  return `${machine}\n\n${sandboxTools}`
}

function groupInstructions(group: ChatGroup, member: GroupMember) {
  if (group.kind !== "group") {
    return undefined
  }

  const others = group.members.filter((candidate) => candidate.id !== member.id)
  const title = group.name ?? group.members[0].name

  if (others.length === 0) {
    return `You are in the group chat "${title}", and you are the only bot left in it. Every request is yours to answer.`
  }

  return [
    `You are in the group chat "${title}" with ${others.length} other ${others.length === 1 ? "bot" : "bots"}. The user writes to the whole group, and you are the member answering this time.`,
    `The other members are:\n${others
      .map((other) => `- ${other.name}, ${other.job}`)
      .join("\n")}`,
    "When the request is another member's job rather than yours, call the handoff tool with their name. The member you name answers next, so leave the answering to them and reply with one sentence naming them. Hand a request over only when somebody else covers it better than you do.",
    "A request handed to you is yours. Answer it, and do not hand it back.",
  ].join("\n\n")
}

async function instructionsFor(chatId: string, botId: string | undefined) {
  const group = await groupFor(chatId)
  const member = group.members.find((candidate) => candidate.id === botId)

  if (!member) {
    console.error("chat has no bot", { chatId, botId })
    throw new Error("Something went wrong.")
  }

  const sections = [
    `Your name is ${member.name}.`,
    `Your job is ${member.job}.`,
  ]

  const groupSection = groupInstructions(group, member)
  if (groupSection) {
    sections.push(groupSection)
  }

  if (group.members[0].sandboxId) {
    sections.push(sandboxInstructions(group, member))
  }

  const instructions = member.instructions?.trim()
  if (instructions) {
    sections.push(`How you should work:\n${instructions}`)
  }

  return sections.join("\n\n")
}

async function chatTools(chatId: string, botId: string | undefined) {
  const group = await groupFor(chatId)

  return {
    ...computerTools(chatId),
    ...handoffTools(group, botId),
  }
}

export const chatAgent = chat.agent({
  id: "chat",
  storage: defaultStorage,
  clientDataSchema: z.object({ botId: z.string().min(1) }),
  tools: ({ chatId, clientData }) => chatTools(chatId, clientData?.botId),
  actionSchema: z.object({ type: z.literal("handoff") }),
  onAction: async () => chat.turn(),
  run: async ({ chatId, messages, tools, signal, clientData, streamText }) => {
    const instructions = await instructionsFor(chatId, clientData?.botId)

    chat.setUIMessageStreamOptions({
      messageMetadata: () => ({ botId: clientData?.botId }),
    })

    return streamText({
      model: chatModel(),
      system: instructions,
      messages,
      tools,
      abortSignal: signal,
      stopWhen: stepCountIs(15),
    })
  },
})
