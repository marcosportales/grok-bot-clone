import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { ChatHeader } from "@/components/chat-header"
import { DesktopPanel, DesktopPanelProvider } from "@/components/desktop-panel"
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { toBotOption, toEditableBot } from "@/lib/bot"
import { toChatSummary } from "@/lib/chat"
import { getChatWithBots } from "@/queries/chat"

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
  const chat = await getChatWithBots(chatId)

  if (!chat) {
    notFound()
  }

  // The header names the chat the way the sidebar does. A direct chat hands the
  // bot's own answers to the dialog its title opens; a group has no single bot
  // to edit, so it only gets its members as composer choices.
  const { title, face } = toChatSummary(chat)
  // The chat's computer is its first member's, the same one the agent's own
  // tools reach for, so the panel and the tools name one machine.
  const [owner] = chat.bots
  // The screen a group would show is its first member's machine, and that bot's
  // own chat already shows it, so only a direct chat opens a panel.
  const canOpen = chat.kind === "direct"

  return (
    // The root layout and SidebarProvider set min-h-svh, so flex-1 alone grows
    // the document instead of scrolling.
    <div className="flex h-svh min-h-0 flex-1 flex-col overflow-hidden">
      {/* The desktop panel sits beside the conversation, so the group spans both
          the header and the thread. `flex-1` hands it the height the page root
          holds, whose definite size its own `height: 100%` needs. */}
      <DesktopPanelProvider canOpen={canOpen}>
        <ResizablePanelGroup
          orientation="horizontal"
          className="min-h-0 flex-1"
        >
          {/* The conversation keeps a floor of its own, so dragging or Home
              cannot hide it, and with it the control that closes the panel. */}
          <ResizablePanel id="chat" minSize="30%">
            <div className="flex h-full min-h-0 flex-col">
              <ChatHeader
                title={title}
                face={face}
                bot={chat.kind === "direct" ? toEditableBot(owner) : undefined}
              />
              <ChatThread
                key={chat.id}
                chatId={chat.id}
                bots={chat.bots.map(toBotOption)}
              />
            </div>
          </ResizablePanel>
          {/* The panel shows the screen of the chat's computer. */}
          <DesktopPanel chatId={chat.id} botName={owner.name} />
        </ResizablePanelGroup>
      </DesktopPanelProvider>
    </div>
  )
}
