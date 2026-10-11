"use client"

import { useChat } from "@ai-sdk/react"
import {
  useLoadTranscript,
  useTriggerChatTransport,
} from "@trigger.dev/sdk/chat/react"
import { getToolName, isToolUIPart, type UIMessage } from "ai"
import { useState } from "react"

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
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
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
import type { chatAgent } from "@/trigger/chat"

import { ChatToolPart } from "./chat-tool"

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
  // A group chat picks which member answers. The choice lives on the transport
  // rather than on each message, so the first turn's boot metadata carries it
  // as well as every later append.
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

  // The select lists the ids, and the trigger draws the face and the name of
  // the bot the current id names.
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
            messages.map((message, index) => {
              const animate =
                status === "streaming" && index === messages.length - 1
              const parts = message.parts.filter(
                (part) =>
                  !(isToolUIPart(part) && getToolName(part) === "viewScreen")
              )

              if (
                !parts.some(
                  (part) => part.type === "text" || isToolUIPart(part)
                )
              ) {
                return null
              }

              return (
                <Message from={message.role} key={message.id}>
                  <MessageContent>
                    {parts.map((part, partIndex) => {
                      if (part.type === "text") {
                        return (
                          <MessageResponse
                            key={`${message.id}-text-${partIndex}`}
                            {...(animate ? { isAnimating: true } : {})}
                          >
                            {part.text}
                          </MessageResponse>
                        )
                      }

                      if (isToolUIPart(part)) {
                        return (
                          <ChatToolPart key={part.toolCallId} part={part} />
                        )
                      }

                      return null
                    })}
                  </MessageContent>
                </Message>
              )
            })
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
        {/* The picker is a group's alone, and `mr-auto` keeps the submit where
            a direct chat's footer puts it. */}
        <PromptInputFooter className="justify-end">
          {bots.length > 1 ? (
            <PromptInputTools className="mr-auto">
              {/* The vendored wrapper types the select's value as unknown, so
                  the chosen id is narrowed before it reaches state. */}
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
                  {/* The vendored wrapper takes the name through the value's
                      render prop; its own label lookup needs an `items` prop
                      the wrapper cannot pass. */}
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
