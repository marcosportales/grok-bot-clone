"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"

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

type ChatThreadProps = { chatId: string }

function ChatThread({ chatId }: ChatThreadProps) {
  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    id: chatId,
    transport: new DefaultChatTransport({
      api: `/api/chats/${chatId}/messages`,
    }),
  })

  function handleSubmit(message: PromptInputMessage) {
    const text = message.text.trim()

    if (!text || error != null || status !== "ready") {
      return
    }

    sendMessage({ text })
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

              return (
                <Message from={message.role} key={message.id}>
                  <MessageContent>
                    {message.parts.map((part, partIndex) =>
                      part.type === "text" ? (
                        <MessageResponse
                          key={partIndex}
                          {...(animate ? { isAnimating: true } : {})}
                        >
                          {part.text}
                        </MessageResponse>
                      ) : null
                    )}
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
            onStop={stop}
            status={status}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}

export { ChatThread }
