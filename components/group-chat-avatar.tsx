import Image from "next/image"

import { cn } from "cn"

import { avatarDataUri } from "@/lib/avatar"

const size = 32

type Cell = { cx: number; cy: number; r: number }

// One geometry per tile count, in the 32x32 space of the viewBox. Every tile is
// a circle of radius `r` at `cx`, `cy`: one face fills the box, two sit side by
// side and overlap, three form a triangle, four fill a 2x2 grid. A count tile
// takes the fourth cell of that grid.
const layouts: Record<number, Cell[]> = {
  1: [{ cx: 16, cy: 16, r: 16 }],
  2: [
    { cx: 10.5, cy: 16, r: 10.5 },
    { cx: 21.5, cy: 16, r: 10.5 },
  ],
  3: [
    { cx: 16, cy: 9.5, r: 9 },
    { cx: 9, cy: 22.5, r: 9 },
    { cx: 23, cy: 22.5, r: 9 },
  ],
  4: [
    { cx: 8, cy: 8, r: 8 },
    { cx: 24, cy: 8, r: 8 },
    { cx: 8, cy: 24, r: 8 },
    { cx: 24, cy: 24, r: 8 },
  ],
}

// The surface under a group face differs: the sidebar, the chat header, and a
// dialog each have their own background, and the theme changes all three. A
// face that overlaps another therefore cuts a transparent moat out of the one
// beneath it, so the seam is the surface showing through rather than a colour
// this avatar would have to guess.
function moatHoles(above: Cell[]) {
  return above
    .map(
      (cell) =>
        `<circle cx="${cell.cx}" cy="${cell.cy}" r="${cell.r + 1.2}" fill="#000"/>`
    )
    .join("")
}

function groupMarkup(seeds: string[]) {
  // A chat keeps at least one member, and the table stops at four: members past
  // the third are what the count tile is for.
  const tiles = Math.min(Math.max(seeds.length, 1), 4)
  const layout = layouts[tiles]
  const shown = seeds.slice(0, 3)
  const extra = seeds.length - shown.length

  const defs = shown
    .map((_, index) => {
      const cell = layout[index]
      const clipPath = `<clipPath id="c${index}"><circle cx="${cell.cx}" cy="${cell.cy}" r="${cell.r}"/></clipPath>`
      const above = layout.slice(index + 1, shown.length)

      if (above.length === 0) {
        return clipPath
      }

      return `${clipPath}<mask id="m${index}" maskUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="#fff"/>${moatHoles(above)}</mask>`
    })
    .join("")

  const faces = shown
    .map((seed, index) => {
      const cell = layout[index]
      const mask = index < shown.length - 1 ? ` mask="url(#m${index})"` : ""

      return `<g${mask}><image href="${avatarDataUri(seed, false)}" x="${cell.cx - cell.r}" y="${cell.cy - cell.r}" width="${cell.r * 2}" height="${cell.r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#c${index})"/></g>`
    })
    .join("")

  const count =
    extra > 0
      ? `<circle cx="${layout[3].cx}" cy="${layout[3].cy}" r="${layout[3].r}" fill="#71717a"/><text x="${layout[3].cx}" y="${layout[3].cy}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#fafafa"${extra > 99 ? ` textLength="12" lengthAdjust="spacingAndGlyphs"` : ""}>+${extra}</text>`
      : ""

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><defs>${defs}</defs>${faces}${count}</svg>`
}

const dataUriCache = new Map<string, string>()

function groupAvatarDataUri(seeds: string[]) {
  // A seed is client-supplied on bot create, so the key is the whole list rather
  // than a delimiter-joined string two different lists could share.
  const key = JSON.stringify(seeds)

  const cached = dataUriCache.get(key)
  if (cached !== undefined) {
    return cached
  }

  const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(groupMarkup(seeds))}`

  if (dataUriCache.size >= 500) {
    dataUriCache.clear()
  }
  dataUriCache.set(key, dataUri)

  return dataUri
}

type GroupChatAvatarProps = {
  seeds: string[]
  className?: string
}

/**
 * A group's face: up to three member faces in one SVG, plus a count tile for
 * the members that did not fit. It is one image, so it takes the same box a
 * single avatar takes and the caller sizes it the same way.
 */
function GroupChatAvatar({ seeds, className }: GroupChatAvatarProps) {
  return (
    <Image
      src={groupAvatarDataUri(seeds)}
      alt=""
      width={size}
      height={size}
      // A data URI is already a vector; next/image serves it as-is.
      unoptimized
      className={cn("size-8 shrink-0", className)}
    />
  )
}

export { GroupChatAvatar }
export type { GroupChatAvatarProps }
