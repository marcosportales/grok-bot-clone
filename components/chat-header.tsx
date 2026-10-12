import { ChatFaceAvatar } from "@/components/chat-avatar"
import { DesktopPanelToggle } from "@/components/desktop-panel"
import { EditBotButton } from "@/components/edit-bot-button"
import type { EditableBot } from "@/lib/bot"
import type { ChatFace } from "@/lib/chat"

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
