import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import { z } from "zod"

import { chatModel } from "@/lib/ai/model"

import { computerTools } from "./computer"
import {
  groupFor,
  handoffTools,
  type ChatGroup,
  type GroupMember,
} from "./group"

// The desktop is started later, the first time a mouse, keyboard, or screen
// tool runs.
const sandboxTools = [
  "You can run commands, read and write files, and use the desktop with the mouse, the keyboard, and the screen. Paths are on that computer. A relative path starts at its working directory.",
  "The desktop is an XFCE session. It starts the first time you use the mouse, the keyboard, or the screen.",
  "viewScreen shows you the desktop: a picture of the screen and the accessibility tree. Each row is a control, with its role, name, and bounds as x, y, width, height from the top-left. Call it before you click and after the screen changes. It is never shown to the user.",
  "showScreen sends a picture of the desktop to the user. Call it only when they ask to see the screen.",
  "Call one tool and wait for its result before you call another. A click and a look at the screen are separate steps.",
  "Prefer bash, readFile, writeFile, and listFiles for anything that does not need the desktop.",
].join("\n\n")

// A direct chat's computer is its bot's own sandbox. A group's is the first
// member's, because `sandboxIdForChat` hands every member of the group the same
// machine, the one the chat page's desktop panel shows. The prompt says which
// of the two it is, so a member of a group does not expect the filesystem to
// itself.
function sandboxInstructions(group: ChatGroup, member: GroupMember) {
  const owner = group.members[0]
  const machine =
    owner.id === member.id
      ? "You are in your own Daytona sandbox: an isolated Linux computer with 1 vCPU, 1 GB of memory, and 3 GiB of disk. It belongs to you alone."
      : `This group shares one computer: ${owner.name}'s Daytona sandbox, an isolated Linux machine with 1 vCPU, 1 GB of memory, and 3 GiB of disk. Every member works on the same files and the same desktop, so the work another member started is already there when a request reaches you.`

  return `${machine}\n\n${sandboxTools}`
}

// What a member of a group needs to know that it is in one: who else is here,
// when to give a request away, and what to do when one arrives. A direct chat
// has none of it and gets no section.
function groupInstructions(group: ChatGroup, member: GroupMember) {
  if (group.kind !== "group") {
    return undefined
  }

  const others = group.members.filter((candidate) => candidate.id !== member.id)
  const title = group.name ?? group.members[0].name

  // A group outlives the members deleted out of it, so one can end up with a
  // single member. There is nobody to hand anything to then, and the tool is
  // not offered either, so the prompt must not name it.
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

// The name, the job, the computer, the group, and any instructions the owner
// wrote live on rows this reads on each turn, which keeps an edit live on the
// next message and keeps the client from supplying any of it. The answering bot
// is picked out of the chat's own members, so an id for a bot that belongs to
// somebody else, or one that was removed from the group, matches nothing and
// fails exactly the way a memberless chat already did.
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
  // The platform transcript is stored under the chat id.
  storage: defaultStorage,
  // Which bot answers is the client's choice, and the schema is what keeps a
  // hand-rolled payload from reaching the run as anything else.
  clientDataSchema: z.object({ botId: z.string().min(1) }),
  // Declared here so each tool's toModelOutput is reapplied when a later turn
  // reloads the transcript. The run below receives this same set.
  tools: ({ chatId, clientData }) => chatTools(chatId, clientData?.botId),
  // A handoff is a state edit that edits nothing. The client already switched
  // which member answers and the request is already the last thing the user
  // said, so a turn on the history as it stands is the whole of it.
  actionSchema: z.object({ type: z.literal("handoff") }),
  onAction: async () => chat.turn(),
  run: async ({ chatId, messages, tools, signal, clientData, streamText }) => {
    const instructions = await instructionsFor(chatId, clientData?.botId)

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
