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
  // A face that stands for a named bot carries its name; a decorative one is
  // left for a screen reader.
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
      // A data URI is already a vector; next/image serves it as-is.
      unoptimized
      className={cn("size-8 shrink-0 rounded-full", className)}
    />
  )
}

// A chat's face is one seed for a direct chat and every member's seed for a
// group, so callers that only have the summary pick the right drawing here.
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
