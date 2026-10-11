import { DesktopPanelToggle } from "@/components/desktop-panel"
import { EditBotButton } from "@/components/edit-bot-button"
import type { EditableBot } from "@/lib/bot"

/**
 * The strip above a conversation. It names the chat and holds the controls for
 * it.
 *
 * It stays a Server Component. The bot's dialog and the desktop toggle each
 * carry their own state, so the header renders them as Client Components and
 * passes neither of them anything.
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
      <DesktopPanelToggle />
    </header>
  )
}

export { ChatHeader }
