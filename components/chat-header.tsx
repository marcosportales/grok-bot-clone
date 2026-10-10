import { MonitorIcon } from "lucide-react"

import { EditBotButton } from "@/components/edit-bot-button"
import { Button } from "@/components/ui/button"
import type { EditableBot } from "@/lib/bot"

/**
 * The strip above a conversation. It names the chat and holds the controls for
 * it, and it is a Server Component because the one control that does something
 * is the bot's dialog, which keeps its own state and takes the bot with it.
 *
 * The name is the one the sidebar shows, worked out once in `toChatSummary`, so
 * a chat cannot be called two things on one screen.
 */
function ChatHeader({ title, bot }: { title: string; bot: EditableBot }) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-2">
      <h1 className="flex min-w-0 items-center">
        <EditBotButton title={title} bot={bot} />
      </h1>
      {/* Nothing shares a desktop yet, so the control is a placeholder. */}
      <Button variant="ghost" size="icon" aria-label="Share desktop">
        <MonitorIcon />
      </Button>
    </header>
  )
}

export { ChatHeader }
