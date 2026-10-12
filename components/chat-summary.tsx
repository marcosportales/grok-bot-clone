import { ChatFaceAvatar } from "@/components/chat-avatar"
import type { ChatSummaryData } from "@/lib/chat"

function UnreadDot() {
  // The dot sits inside the avatar's box rather than hanging past its corner.
  // The rail is 3rem in icon mode, so anything that overflows is clipped, and
  // an inner border of the sidebar's own colour separates the dot from the
  // face without adding to the box. The room it needs is reserved here in the
  // avatar's footprint, so no row ever shifts to make space for it.
  //
  // `bg-primary` is the app's own accent, the token its buttons and its avatar
  // badges wear, and it is the one candidate that clears the 3:1 floor for a
  // non-text indicator in both themes: 17.2:1 on the light sidebar and 14.2:1
  // on the dark one. `bg-sidebar-primary` is a literal-brand blue in the dark
  // theme and measures 2.6:1 there.
  return (
    <span
      aria-hidden
      data-slot="chat-unread-dot"
      className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-sidebar bg-primary group-data-[collapsible=icon]:size-2"
    />
  )
}

function ChatSummary({ face, title, age, preview, unread }: ChatSummaryData) {
  return (
    <>
      <span className="relative shrink-0">
        <ChatFaceAvatar
          face={face}
          className="group-data-[collapsible=icon]:size-6"
        />
        {unread ? <UnreadDot /> : null}
      </span>
      {unread ? <span className="sr-only">Unread reply</span> : null}
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
