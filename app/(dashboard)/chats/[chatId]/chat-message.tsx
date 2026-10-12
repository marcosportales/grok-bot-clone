import { getToolName, isToolUIPart, type UIMessage } from "ai"

import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import { Badge } from "@/components/ui/badge"
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

  const messageBotId = botIdFromMessage(message)
  const messageBot =
    bots.length > 1 && messageBotId
      ? bots.find((candidate) => candidate.id === messageBotId)
      : undefined
  const assistantBot = message.role === "assistant" ? messageBot : undefined
  const addressedBot = message.role === "user" ? messageBot : undefined

  return (
    <Message
      from={message.role}
      className={assistantBot ? "flex-row items-start gap-2" : undefined}
    >
      {assistantBot ? (
        <ChatAvatar
          seed={assistantBot.avatar}
          alt={assistantBot.name}
          className="mt-0.5 size-6"
        />
      ) : null}
      <MessageContent
        className={addressedBot ? "flex-row items-start gap-2" : undefined}
      >
        {addressedBot ? (
          <Badge variant="outline" className="gap-1 pl-1 text-muted-foreground">
            <ChatAvatar seed={addressedBot.avatar} className="size-3.5" />
            <span className="max-w-24 truncate">{addressedBot.name}</span>
          </Badge>
        ) : null}
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
