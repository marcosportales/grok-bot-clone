import type { Bot } from "@/lib/db/schema"

/**
 * A bot as its dialog holds it: the four things the form answers, and the id
 * that says which row those answers belong to.
 *
 * The row carries the owner, the sandbox, and the creation time as well, and
 * none of those are the dialog's business. Keeping them out of this shape keeps
 * them out of the RSC payload that ships it to the client.
 */
export type EditableBot = {
  id: string
  name: string
  avatar: string
  job: string
  instructions: string | null
}

export function toEditableBot(bot: Bot): EditableBot {
  return {
    id: bot.id,
    name: bot.name,
    avatar: bot.avatar,
    job: bot.job,
    instructions: bot.instructions,
  }
}
