"use client"

import { useChat } from "@ai-sdk/react"
import {
  useChatActions,
  useLoadTranscript,
  useTriggerChatTransport,
} from "@trigger.dev/sdk/chat/react"
import type { UIMessage } from "ai"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import {
  loadChatTranscript,
  markChatRead,
  mintChatAccessToken,
  startChatSession,
} from "@/actions/chat"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ChatAvatar } from "@/components/chat-avatar"
import { useRefusalToast } from "@/components/refusal-toast"
import type { UpgradeRequired } from "@/lib/billing"
import type { BotOption } from "@/lib/bot"
import { answeredSinceUser, handoffFromMessage } from "@/lib/chat"
import type { chatAgent } from "@/trigger/chat"

import { ChatMessage } from "./chat-message"

type ChatThreadProps = {
  chatId: string
  bots: BotOption[]
  /** The refusal sending would hit right now, or null when it would not. */
  sendBlockedRefusal: UpgradeRequired | null
  /** The chat's read cursor was behind its bot's reply when this page rendered. */
  unreadAtOpen: boolean
}

type ChatTransport = ReturnType<
  typeof useTriggerChatTransport<typeof chatAgent>
>

/**
 * How long the read cursor waits for `onTurnComplete` to commit. Measured
 * against the live worker, the hook lands within roughly 200ms of the stream
 * closing, and a write issued on the spot lands on either side of it, so the
 * cursor settles well past that window instead of racing it.
 */
const readSettleMs = 1_000

type ChatThreadMessagesProps = {
  chatId: string
  bots: BotOption[]
  botId: string
  setBotId: (botId: string) => void
  initialMessages: UIMessage[]
  transport: ChatTransport
  sendBlockedRefusal: UpgradeRequired | null
}

function ChatThread({
  chatId,
  bots,
  sendBlockedRefusal,
  unreadAtOpen,
}: ChatThreadProps) {
  const [botId, setBotId] = useState(bots[0].id)
  const { refusalError } = useRefusalToast()
  const router = useRouter()
  const openedUnread = useRef(unreadAtOpen)

  // The page wrote the read cursor while it rendered, but the row that has to
  // lose its dot comes from the server layout, and a soft navigation reuses the
  // layout from the client cache. One refresh fetches the cleared row. The
  // effect cannot loop: the refresh's own render reads the cursor the page just
  // wrote, so it arrives with nothing to clear.
  useEffect(() => {
    if (!openedUnread.current) {
      return
    }

    openedUnread.current = false
    router.refresh()
  }, [router])
  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat",
    accessToken: async ({ chatId }) => {
      const token = await mintChatAccessToken(chatId)

      // A string is a token and anything else is a refusal, so this narrows the
      // union on the primitive side. The `in` operator cannot be used here
      // because one member is a string. The session callback below can, because
      // both of its members are objects.
      if (typeof token !== "string") {
        throw refusalError(token)
      }

      return token
    },
    startSession: async ({ chatId, clientData }) => {
      const session = await startChatSession({ chatId, clientData })

      if ("upgrade" in session) {
        throw refusalError(session)
      }

      return session
    },
    clientData: { botId },
  })
  const {
    messages: initialMessages,
    isLoading,
    error,
  } = useLoadTranscript(chatId, loadChatTranscript, { transport })

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 items-center px-4">
        <p className="text-sm text-destructive">Something went wrong.</p>
      </div>
    )
  }

  return (
    <ChatThreadMessages
      chatId={chatId}
      bots={bots}
      botId={botId}
      setBotId={setBotId}
      initialMessages={initialMessages}
      transport={transport}
      sendBlockedRefusal={sendBlockedRefusal}
    />
  )
}

function ChatThreadMessages({
  chatId,
  bots,
  botId,
  setBotId,
  initialMessages,
  transport,
  sendBlockedRefusal,
}: ChatThreadMessagesProps) {
  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    resume: initialMessages.length > 0,
  })
  const { sendAction } = useChatActions({ sendMessage })
  const { showRefusal } = useRefusalToast()
  const router = useRouter()

  const followed = useRef(new Set<string>())
  const wasBusy = useRef(false)

  // The sidebar's order, age, and preview come from the server layout, and the
  // turn writes them from the worker, which cannot revalidate the way a Server
  // Action does. Refreshing when the turn ends is what moves the row, and the
  // read cursor moves in the same breath: the reply that just landed is one the
  // reader watched arrive. The wait is for `onTurnComplete` to commit the bot's
  // instant, which it can do a beat after the stream closes; a cursor written on
  // the spot lands behind it on some turns and leaves the chat the reader is
  // sitting in flagged on others. The timer is not cleared on unmount, because a
  // reader who leaves a moment later still saw the reply.
  useEffect(() => {
    if (status === "submitted" || status === "streaming") {
      wasBusy.current = true
      return
    }

    if (!wasBusy.current) {
      return
    }

    wasBusy.current = false

    setTimeout(() => {
      void markChatRead(chatId)
        .catch((error) => {
          // A cursor that did not move costs one dot; the row still has to move.
          console.error("failed to move the read cursor", error)
        })
        .finally(() => router.refresh())
    }, readSettleMs)
  }, [chatId, router, status])

  useEffect(() => {
    if (status !== "ready" || error != null) {
      return
    }

    const last = messages[messages.length - 1]
    if (last?.role !== "assistant") {
      return
    }

    const handoff = handoffFromMessage(last)
    if (!handoff || followed.current.has(handoff.toolCallId)) {
      return
    }

    followed.current.add(handoff.toolCallId)
    setBotId(handoff.botId)

    if (answeredSinceUser(messages).includes(handoff.botId)) {
      return
    }

    transport.setClientData({ botId: handoff.botId })
    void sendAction({ type: "handoff" })
  }, [error, messages, sendAction, setBotId, status, transport])

  const activeBot = bots.find((bot) => bot.id === botId) ?? bots[0]

  function handleSubmit(message: PromptInputMessage) {
    const text = message.text.trim()

    if (!text || error != null || status !== "ready") {
      return
    }

    if (sendBlockedRefusal) {
      showRefusal(sendBlockedRefusal)
      return
    }

    sendMessage({ text, metadata: { botId } })
  }

  function handleStop() {
    stop()
    void transport.stopGeneration(chatId)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="min-h-0">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              className="absolute inset-0"
              description=""
              title="Send a message"
            />
          ) : (
            messages.map((message, index) => (
              <ChatMessage
                animate={
                  status === "streaming" && index === messages.length - 1
                }
                bots={bots}
                key={message.id}
                message={message}
              />
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      {error ? (
        <div className="flex items-center justify-between gap-3 px-4 py-2">
          <p className="text-sm text-destructive">Something went wrong.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => regenerate()}
          >
            Retry
          </Button>
        </div>
      ) : null}
      <PromptInput className="px-4 pb-4" onSubmit={handleSubmit}>
        <PromptInputTextarea />
        <PromptInputFooter className="justify-end">
          {bots.length > 1 ? (
            <PromptInputTools className="mr-auto">
              <PromptInputSelect
                value={botId}
                onValueChange={(value) => {
                  if (typeof value === "string") {
                    setBotId(value)
                  }
                }}
              >
                <PromptInputSelectTrigger aria-label="Choose a bot">
                  <ChatAvatar seed={activeBot.avatar} className="size-4" />
                  <PromptInputSelectValue>
                    {(value: unknown) =>
                      bots.find((bot) => bot.id === value)?.name ?? ""
                    }
                  </PromptInputSelectValue>
                </PromptInputSelectTrigger>
                <PromptInputSelectContent align="start">
                  {bots.map((bot) => (
                    <PromptInputSelectItem key={bot.id} value={bot.id}>
                      <ChatAvatar seed={bot.avatar} className="size-4" />
                      {bot.name}
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>
            </PromptInputTools>
          ) : null}
          <PromptInputSubmit
            disabled={
              (error != null || status !== "ready") &&
              status !== "submitted" &&
              status !== "streaming"
            }
            onStop={handleStop}
            status={status}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}

export { ChatThread }
