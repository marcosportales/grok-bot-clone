"use client"

import { useChat } from "@ai-sdk/react"
import {
  useLoadTranscript,
  useTriggerChatTransport,
} from "@trigger.dev/sdk/chat/react"
import { getToolName, isToolUIPart, type UIMessage } from "ai"

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
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import { Button } from "@/components/ui/button"
import type { chatAgent } from "@/trigger/chat"

import { ChatToolPart } from "./chat-tool"

type ChatThreadProps = { chatId: string }

type ChatTransport = ReturnType<
  typeof useTriggerChatTransport<typeof chatAgent>
>

type ChatThreadMessagesProps = {
  chatId: string
  initialMessages: UIMessage[]
  transport: ChatTransport
}

function ChatThread({ chatId }: ChatThreadProps) {
  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId }) => startChatSession({ chatId }),
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
      initialMessages={initialMessages}
      transport={transport}
    />
  )
}

function ChatThreadMessages({
  chatId,
  initialMessages,
  transport,
}: ChatThreadMessagesProps) {
  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    resume: initialMessages.length > 0,
  })

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
        <PromptInputFooter className="justify-end">
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
