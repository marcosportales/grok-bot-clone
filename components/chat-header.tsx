import { DesktopPanelToggle } from "@/components/desktop-panel"
import { EditBotButton } from "@/components/edit-bot-button"
import { EditGroupChatButton } from "@/components/edit-group-chat-button"
import type { BotOption, EditableBot } from "@/lib/bot"
import type { ChatFace } from "@/lib/chat"
import type { UpdateGroupChat } from "@/lib/db/schema"

type ChatHeaderEdit =
  | { kind: "direct"; bot: EditableBot }
  | { kind: "group"; chat: UpdateGroupChat; bots: BotOption[] }

function ChatHeader({
  title,
  face,
  edit,
}: {
  title: string
  face: ChatFace
  edit: ChatHeaderEdit
}) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-2">
      <h1 className="flex min-w-0 items-center">
        {edit.kind === "direct" ? (
          <EditBotButton title={title} bot={edit.bot} />
        ) : (
          <EditGroupChatButton
            title={title}
            face={face}
            bots={edit.bots}
            chat={edit.chat}
          />
        )}
      </h1>
      <DesktopPanelToggle />
    </header>
  )
}

export { ChatHeader }
export type { ChatHeaderEdit }
