import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { ChatHeader } from "@/components/chat-header"
import { toEditableBot } from "@/lib/bot"
import { toChatSummary } from "@/lib/chat"
import { getChatWithBot } from "@/queries/chat"

export default async function Page({
  params,
}: {
  params: Promise<{ chatId: string }>
}) {
  // A chat belongs to one user, so the route is gated before the id is looked
  // at: a signed-out visitor is sent to sign in rather than shown a 404.
  await auth.protect()

  const { chatId } = await params
  const chat = await getChatWithBot(chatId)

  if (!chat) {
    notFound()
  }

  // The header names the chat the way the sidebar does, and hands the bot's
  // own answers to the dialog its title opens.
  const { title } = toChatSummary(chat)

  return (
    <div className="flex flex-1 flex-col">
      <ChatHeader title={title} bot={toEditableBot(chat.bot)} />
    </div>
  )
}
