import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { markChatRead } from "@/actions/chat"
import { ChatHeader, type ChatHeaderEdit } from "@/components/chat-header"
import { DesktopPanel, DesktopPanelProvider } from "@/components/desktop-panel"
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { missingFeature } from "@/lib/billing"
import { toBotOption, toEditableBot } from "@/lib/bot"
import { isChatUnread, toChatSummary, toEditableGroupChat } from "@/lib/chat"
import { missingAllowance } from "@/lib/usage/quota"
import { getBots } from "@/queries/bot"
import { getChatWithBots } from "@/queries/chat"

import { ChatThread } from "./chat-thread"

export default async function Page({
  params,
}: {
  params: Promise<{ chatId: string }>
}) {
  // The same two rules the action applies, in the same order, so the composer
  // cannot disagree with the server about whether sending is allowed.
  const { has, userId } = await auth.protect()
  const sendBlockedRefusal =
    missingFeature(has, "bots") ??
    (await missingAllowance(has, userId, "ai_tokens"))

  const { chatId } = await params
  const chat = await getChatWithBots(chatId)

  if (!chat) {
    notFound()
  }

  // Rendering this page is the reader seeing the thread, which is the only
  // read signal the app has. The write lives in the data path rather than in a
  // component, so a cached render cannot skip it, and it runs only for a chat
  // that was actually holding an unseen reply.
  const unreadAtOpen = isChatUnread(chat)

  if (unreadAtOpen) {
    await markChatRead(chat.id)
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
                sendBlockedRefusal={sendBlockedRefusal}
                unreadAtOpen={unreadAtOpen}
              />
            </div>
          </ResizablePanel>
          <DesktopPanel chatId={chat.id} botName={owner.name} />
        </ResizablePanelGroup>
      </DesktopPanelProvider>
    </div>
  )
}
