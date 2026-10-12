import { Avatar, Style } from "@dicebear/core"
import gaze from "@dicebear/styles/gaze.json" with { type: "json" }

const style = new Style(gaze)
const size = 32

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
    ...(animated ? { tags: ["animation"] } : {}),
  }).toDataUri()

  if (dataUriCache.size >= 500) {
    dataUriCache.clear()
  }
  dataUriCache.set(key, dataUri)

  return dataUri
}

export { avatarDataUri }
