import { ChatAvatar } from "@/components/chat-avatar"
import type { ChatSummaryData } from "@/lib/chat"

/**
 * The face and the two lines that identify a chat. One block serves both the
 * sidebar's rows and the search results, which wrap it in the item their own
 * list needs: a SidebarMenuButton there, a CommandItem here.
 */
function ChatSummary({ avatar, title, age, preview }: ChatSummaryData) {
  return (
    <>
      <ChatAvatar seed={avatar} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
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
