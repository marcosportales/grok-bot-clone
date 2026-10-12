import type { Bot } from "@/lib/db/schema"

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

export type BotOption = { id: string; name: string; avatar: string }

export function toBotOption(bot: Bot): BotOption {
  return { id: bot.id, name: bot.name, avatar: bot.avatar }
}
