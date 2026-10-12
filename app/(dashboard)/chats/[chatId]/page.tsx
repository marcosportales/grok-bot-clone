import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { ChatHeader, type ChatHeaderEdit } from "@/components/chat-header"
import { DesktopPanel, DesktopPanelProvider } from "@/components/desktop-panel"
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { toBotOption, toEditableBot } from "@/lib/bot"
import { toChatSummary, toEditableGroupChat } from "@/lib/chat"
import { getBots } from "@/queries/bot"
import { getChatWithBots } from "@/queries/chat"

import { ChatThread } from "./chat-thread"

export default async function Page({
  params,
}: {
  params: Promise<{ chatId: string }>
}) {
  await auth.protect()

  const { chatId } = await params
  const chat = await getChatWithBots(chatId)

  if (!chat) {
    notFound()
  }

  const { title, face } = toChatSummary(chat)
  const [owner] = chat.bots
  const canOpen = chat.kind === "direct"

  let edit: ChatHeaderEdit

  if (chat.kind === "group") {
    const bots = await getBots()

    edit = {
      kind: "group",
      chat: toEditableGroupChat(chat),
      bots: bots.map(toBotOption),
    }
  } else {
    edit = { kind: "direct", bot: toEditableBot(owner) }
  }

  return (
    <div className="flex h-svh min-h-0 flex-1 flex-col overflow-hidden">
      <DesktopPanelProvider canOpen={canOpen}>
        <ResizablePanelGroup
          orientation="horizontal"
          className="min-h-0 flex-1"
        >
          <ResizablePanel id="chat" minSize="30%">
            <div className="flex h-full min-h-0 flex-col">
              <ChatHeader title={title} face={face} edit={edit} />
              <ChatThread
                key={chat.id}
                chatId={chat.id}
                bots={chat.bots.map(toBotOption)}
              />
            </div>
          </ResizablePanel>
          <DesktopPanel chatId={chat.id} botName={owner.name} />
        </ResizablePanelGroup>
      </DesktopPanelProvider>
    </div>
  )
}
