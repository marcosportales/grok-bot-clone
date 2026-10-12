import { ChatFaceAvatar } from "@/components/chat-avatar"
import type { ChatSummaryData } from "@/lib/chat"

function ChatSummary({ face, title, age, preview }: ChatSummaryData) {
  return (
    <>
      <ChatFaceAvatar
        face={face}
        className="group-data-[collapsible=icon]:size-6"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 group-data-[collapsible=icon]:sr-only">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold">{title}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{age}</span>
        </div>
        <span className="truncate text-xs text-muted-foreground">
          {preview}
        </span>
      </div>
    </>
  )
}

export { ChatSummary }
