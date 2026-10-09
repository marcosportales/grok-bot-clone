import { Avatar, Style } from "@dicebear/core"
import gaze from "@dicebear/styles/gaze.json" with { type: "json" }
import Image from "next/image"

import { cn } from "cn"

const style = new Style(gaze)
const size = 32

// The SVG is a pure function of seed + animated, so identical avatars (the
// same bot across a message list) reuse one data URI instead of re-rendering
// on every parent render. Bounded so long chats cannot grow it forever.
const dataUriCache = new Map<string, string>()

function avatarDataUri(seed: string, animated: boolean) {
  const key = `${seed}:${animated}`

  const cached = dataUriCache.get(key)
  if (cached !== undefined) {
    return cached
  }

  const dataUri = new Avatar(style, {
    seed,
    size,
    // Animation is opt-in for animated styles; the option alone would be
    // ignored without the tag.
    ...(animated ? { tags: ["animation"] } : {}),
  }).toDataUri()

  if (dataUriCache.size >= 500) {
    dataUriCache.clear()
  }
  dataUriCache.set(key, dataUri)

  return dataUri
}

type ChatAvatarProps = {
  seed: string
  animated?: boolean
  className?: string
}

function ChatAvatar({ seed, animated = false, className }: ChatAvatarProps) {
  return (
    <Image
      src={avatarDataUri(seed, animated)}
      alt=""
      width={size}
      height={size}
      // A data URI is already a vector; next/image serves it as-is.
      unoptimized
      className={cn("size-8 shrink-0 rounded-full", className)}
    />
  )
}

export { ChatAvatar }
export type { ChatAvatarProps }
