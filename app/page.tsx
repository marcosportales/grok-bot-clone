import { auth } from "@clerk/nextjs/server"
import { nanoid } from "nanoid"

import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"

export default async function Page() {
  await auth.protect()

  // auth.protect() reads cookies, so this renders per request: a fresh seed
  // means a new face on every refresh.
  const seed = nanoid()

  return (
    <div className="flex flex-1 p-6">
      <Empty>
        <EmptyHeader>
          <ChatAvatar seed={seed} className="mb-2 size-10" />
          <EmptyTitle>Meet your first bot</EmptyTitle>
          <EmptyDescription>
            Every bot gets its own personality, memory, and face. Spin one up
            and start the conversation.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <BotDialog />
        </EmptyContent>
      </Empty>
    </div>
  )
}
