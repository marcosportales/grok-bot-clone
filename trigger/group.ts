import { tool, type ToolSet } from "ai"
import { asc, eq } from "drizzle-orm"
import { z } from "zod"

import { bots, chatMembers, chats } from "@/lib/db/schema"

import { database } from "./db"

export type GroupMember = {
  id: string
  name: string
  job: string
  instructions: string | null
  sandboxId: string | null
}

export type ChatGroup = {
  kind: "direct" | "group"
  name: string | null
  /**
   * Oldest first. `members[0]` is the member whose sandbox the whole group
   * works on, the one the chat page's desktop panel shows.
   */
  members: GroupMember[]
}

/**
 * The chat and everyone in it. A direct chat has the one member it was made
 * for, and a group has the ones it was created with minus any that were
 * deleted since.
 *
 * `joinedAt` alone does not order a group: its members are written in one
 * insert, so they all carry the same timestamp. `id` is the tie-break, and it
 * is what keeps "the first member" the same member in the prompt, in the
 * desktop panel, and in the tools.
 */
export async function groupFor(chatId: string): Promise<ChatGroup> {
  const [chat] = await database()
    .select({ kind: chats.kind, name: chats.name })
    .from(chats)
    .where(eq(chats.id, chatId))

  if (!chat) {
    console.error("chat does not exist", { chatId })
    throw new Error("Something went wrong.")
  }

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
    .orderBy(asc(chatMembers.joinedAt), asc(bots.id))

  return { kind: chat.kind, name: chat.name, members }
}

type HandoffOutcome =
  | { botId: string; name: string; job: string; reason: string }
  | { error: string }

/**
 * The handoff tool, for a member of a group chat. A direct chat has nobody to
 * hand anything to, so it gets no tool at all.
 *
 * The result is what the thread reads back to switch who answers: the id it
 * names, and the name the card draws. The caller is left out of the roster, so
 * a bot is not offered a handoff to itself.
 *
 * The member is named rather than identified by id, and the schema asks only
 * for a string, because the provider validates arguments itself and rejects
 * the whole call when they miss. A group's ids are 21 random characters, which
 * a model gets wrong often enough to matter, and an enum of them turns that
 * miss into a failed turn instead of a tool result the model can read and
 * retry.
 */
export function handoffTools(
  group: ChatGroup,
  memberId: string | undefined
): ToolSet {
  const others = group.members.filter((member) => member.id !== memberId)
  const tools: ToolSet = {}

  if (group.kind !== "group" || others.length === 0) {
    return tools
  }

  const roster = others.map((other) => `${other.name}, ${other.job}`).join("; ")

  tools.handoff = tool({
    description: `Give this request to another member of the group chat when it is their job rather than yours. Name the member, and they answer it next. The members are: ${roster}.`,
    inputSchema: z.object({
      name: z.string().describe("The name of the member who should answer."),
      reason: z
        .string()
        .describe("Why the request is theirs, in one short sentence."),
    }),
    execute: ({ name, reason }): HandoffOutcome => {
      const candidate = name.trim()
      const matches = others.filter(
        (other) => other.name.toLowerCase() === candidate.toLowerCase()
      )

      if (matches.length === 0) {
        return {
          error: `No member of this group is named "${candidate}". The members are ${others.map((other) => other.name).join(", ")}.`,
        }
      }

      if (matches.length > 1) {
        return {
          error: `More than one member of this group is named "${candidate}", so the request cannot be handed to either. Answer it yourself.`,
        }
      }

      const other = matches[0]

      return {
        botId: other.id,
        name: other.name,
        job: other.job,
        reason: reason.trim().slice(0, 200),
      }
    },
    toModelOutput: ({ output }) =>
      "error" in output
        ? { type: "text", value: output.error }
        : {
            type: "text",
            value: `${output.name} answers this request now. ${output.reason}`,
          },
  })

  return tools
}
