"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { ChatFaceAvatar } from "@/components/chat-avatar"
import { GroupChatDialog } from "@/components/group-chat-dialog"
import { Button } from "@/components/ui/button"
import type { BotOption } from "@/lib/bot"
import type { ChatFace } from "@/lib/chat"
import type { UpdateGroupChat } from "@/lib/db/schema"

function EditGroupChatButton({
  title,
  face,
  bots,
  chat,
}: {
  title: string
  face: ChatFace
  bots: BotOption[]
  chat: UpdateGroupChat
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="min-w-0 shrink gap-2 px-1.5 text-sm font-semibold"
        onClick={() => setOpen(true)}
      >
        <ChatFaceAvatar face={face} className="size-5" />
        <span className="truncate">{title}</span>
      </Button>
      <GroupChatDialog
        bots={bots}
        chat={chat}
        open={open}
        onOpenChange={setOpen}
        onDeleted={() => router.push("/")}
      />
    </>
  )
}

export { EditGroupChatButton }
