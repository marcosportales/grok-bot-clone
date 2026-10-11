import { ChatFaceAvatar } from "@/components/chat-avatar"
import { DesktopPanelToggle } from "@/components/desktop-panel"
import { EditBotButton } from "@/components/edit-bot-button"
import type { EditableBot } from "@/lib/bot"
import type { ChatFace } from "@/lib/chat"

/**
 * The strip above a conversation. It names the chat and holds the controls for
 * it.
 *
 * It stays a Server Component. The bot's dialog and the desktop toggle each
 * carry their own state, so the header renders them as Client Components and
 * passes neither of them anything.
 *
 * A direct chat's name is its bot's, so the heading opens the dialog that edits
 * that bot. A group's name is the group's own and no dialog edits it, so the
 * heading is plain text.
 *
 * The name is the one the sidebar shows, worked out once in `toChatSummary`, so
 * a chat cannot be called two things on one screen.
 */
function ChatHeader({
  title,
  face,
  bot,
}: {
  title: string
  face: ChatFace
  bot?: EditableBot
}) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-2">
      <h1 className="flex min-w-0 items-center">
        {bot ? (
          <EditBotButton title={title} bot={bot} />
        ) : (
          <span className="flex min-w-0 items-center gap-2 px-1.5 text-sm font-semibold">
            <ChatFaceAvatar face={face} className="size-5" />
            <span className="truncate">{title}</span>
          </span>
        )}
      </h1>
      <DesktopPanelToggle />
    </header>
  )
}

export { ChatHeader }
