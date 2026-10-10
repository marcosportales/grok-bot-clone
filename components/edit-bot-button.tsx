"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import type { EditableBot } from "@/lib/bot"

function EditBotButton({ title, bot }: { title: string; bot: EditableBot }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        // The name is one of the answers the dialog edits, so the row reads as
        // the heading it stands in for: semibold, and truncating from the end.
        className="min-w-0 shrink gap-2 px-1.5 text-sm font-semibold"
        onClick={() => setOpen(true)}
      >
        <ChatAvatar seed={bot.avatar} className="size-5" />
        <span className="truncate">{title}</span>
      </Button>
      <BotDialog
        bot={bot}
        open={open}
        onOpenChange={setOpen}
        // This page is the deleted bot's chat, so it stops existing along with
        // it: the reader goes back to the index instead of a 404.
        onDeleted={() => router.push("/")}
      />
    </>
  )
}

export { EditBotButton }
