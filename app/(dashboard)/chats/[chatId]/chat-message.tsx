import { getToolName, isToolUIPart, type UIMessage } from "ai"

import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import { ChatAvatar } from "@/components/chat-avatar"
import type { BotOption } from "@/lib/bot"
import { botIdFromMessage } from "@/lib/chat"

import { ChatToolPart } from "./chat-tool"

type ChatMessageProps = {
  message: UIMessage
  bots: BotOption[]
  animate: boolean
}

function ChatMessage({ message, bots, animate }: ChatMessageProps) {
  const parts = message.parts.filter(
    (part) => !(isToolUIPart(part) && getToolName(part) === "viewScreen")
  )

  if (!parts.some((part) => part.type === "text" || isToolUIPart(part))) {
    return null
  }

  const botId =
    message.role === "assistant" ? botIdFromMessage(message) : undefined
  const bot =
    bots.length > 1 && botId
      ? bots.find((candidate) => candidate.id === botId)
      : undefined

  return (
    <Message
      from={message.role}
      className={bot ? "flex-row items-start gap-2" : undefined}
    >
      {bot ? (
        <ChatAvatar
          seed={bot.avatar}
          alt={bot.name}
          className="mt-0.5 size-6"
        />
      ) : null}
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
            return <ChatToolPart key={part.toolCallId} part={part} />
          }

          return null
        })}
      </MessageContent>
    </Message>
  )
}

export { ChatMessage }
