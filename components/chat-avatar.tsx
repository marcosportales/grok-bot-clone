import Image from "next/image"

import { cn } from "cn"

import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { avatarDataUri } from "@/lib/avatar"
import type { ChatFace } from "@/lib/chat"

const size = 32

type ChatAvatarProps = {
  seed: string
  animated?: boolean
  className?: string
  alt?: string
}

function ChatAvatar({
  seed,
  animated = false,
  className,
  alt = "",
}: ChatAvatarProps) {
  return (
    <Image
      src={avatarDataUri(seed, animated)}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      className={cn("size-8 shrink-0 rounded-full", className)}
    />
  )
}

function ChatFaceAvatar({
  face,
  className,
}: {
  face: ChatFace
  className?: string
}) {
  if (face.kind === "group") {
    return <GroupChatAvatar seeds={face.seeds} className={className} />
  }

  return <ChatAvatar seed={face.seed} className={className} />
}

export { ChatAvatar, ChatFaceAvatar }
export type { ChatAvatarProps }
