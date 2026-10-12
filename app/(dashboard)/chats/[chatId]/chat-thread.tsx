"use client"

import { useChat } from "@ai-sdk/react"
import {
  useChatActions,
  useLoadTranscript,
  useTriggerChatTransport,
} from "@trigger.dev/sdk/chat/react"
import type { UIMessage } from "ai"
import { useEffect, useRef, useState } from "react"

import {
  loadChatTranscript,
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
import { ChatAvatar } from "@/components/chat-avatar"
import type { BotOption } from "@/lib/bot"
import { answeredSinceUser, handoffFromMessage } from "@/lib/chat"
import type { chatAgent } from "@/trigger/chat"

import { ChatMessage } from "./chat-message"

type ChatThreadProps = { chatId: string; bots: BotOption[] }

type ChatTransport = ReturnType<
  typeof useTriggerChatTransport<typeof chatAgent>
>

type ChatThreadMessagesProps = {
  chatId: string
  bots: BotOption[]
  botId: string
  setBotId: (botId: string) => void
  initialMessages: UIMessage[]
  transport: ChatTransport
}

function ChatThread({ chatId, bots }: ChatThreadProps) {
  const [botId, setBotId] = useState(bots[0].id)
  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
    clientData: { botId },
  })
  const {
    messages: initialMessages,
    isLoading,
    error,
  } = useLoadTranscript(chatId, loadChatTranscript, { transport })

  if (isLoading) {
    return <div className="flex min-h-0 flex-1 flex-col" />
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
}: ChatThreadMessagesProps) {
  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    resume: initialMessages.length > 0,
  })
  const { sendAction } = useChatActions({ sendMessage })

  const followed = useRef(new Set<string>())

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

    sendMessage({ text })
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
