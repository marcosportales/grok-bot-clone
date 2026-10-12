import "server-only"

import type { auth } from "@clerk/nextjs/server"

// `@clerk/shared/types` does not resolve from this project, so the session
// check is typed from the `auth()` return it is always read from.
export type SessionHas = Awaited<ReturnType<typeof auth>>["has"]

export type PaidFeature = "bots" | "sandboxes"

/** A refused action that the paid plan or its allowance would allow. */
export type UpgradeRequired = {
  ok: false
  /** The toast title, written by whoever decided to refuse. */
  title: string
  /** The longer line under it. */
  error: string
  upgrade: PaidFeature
}

const denials: Record<PaidFeature, string> = {
  bots: "Bots are part of the Pro plan.",
  sandboxes: "Sandboxes are part of the Pro plan.",
}

export function missingFeature(
  has: SessionHas,
  feature: PaidFeature
): UpgradeRequired | null {
  if (has({ feature })) {
    return null
  }

  return {
    ok: false,
    title: "This needs the Pro plan",
    error: denials[feature],
    upgrade: feature,
  }
}
