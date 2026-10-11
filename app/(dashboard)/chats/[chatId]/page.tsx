import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { ChatHeader } from "@/components/chat-header"
import { DesktopPanel, DesktopPanelProvider } from "@/components/desktop-panel"
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { toEditableBot } from "@/lib/bot"
import { toChatSummary } from "@/lib/chat"
import { getChatWithBot } from "@/queries/chat"

import { ChatThread } from "./chat-thread"

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
    // The root layout and SidebarProvider set min-h-svh, so flex-1 alone grows
    // the document instead of scrolling.
    <div className="flex h-svh min-h-0 flex-1 flex-col overflow-hidden">
      {/* The desktop panel sits beside the conversation, so the group spans both
          the header and the thread. `flex-1` hands it the height the page root
          holds, whose definite size its own `height: 100%` needs. */}
      <DesktopPanelProvider>
        <ResizablePanelGroup
          orientation="horizontal"
          className="min-h-0 flex-1"
        >
          {/* The conversation keeps a floor of its own, so dragging or Home
              cannot hide it, and with it the control that closes the panel. */}
          <ResizablePanel id="chat" minSize="30%">
            <div className="flex h-full min-h-0 flex-col">
              <ChatHeader title={title} bot={toEditableBot(chat.bot)} />
              <ChatThread key={chat.id} chatId={chat.id} />
            </div>
          </ResizablePanel>
          {/* The panel shows the screen of the chat's computer. */}
          <DesktopPanel chatId={chat.id} botName={chat.bot.name} />
        </ResizablePanelGroup>
      </DesktopPanelProvider>
    </div>
  )
}
