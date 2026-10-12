"use client"

import { useRouter } from "next/navigation"
import { useCallback } from "react"

import { toast } from "@/components/ui/toast"

const pricingPath = "/pricing"

/** The words of a refusal, written by the server that took the decision. */
export type Refusal = { title: string; error: string }

/**
 * The one owner of the refusal toast. Every action the plan or an allowance
 * refuses raises this, and the toast is the route to the pricing page. The
 * title comes from the server, so a spent allowance does not tell a paying
 * reader to buy the plan they already hold.
 */
export function useRefusalToast() {
  const router = useRouter()

  const showRefusal = useCallback(
    (refusal: Refusal) => {
      toast.add({
        title: refusal.title,
        description: refusal.error,
        type: "error",
        // Long enough to read and click, and short enough that a toast raised
        // before a successful checkout cannot outlive the upgrade and keep
        // claiming the plan is missing.
        timeout: 10_000,
        actionProps: {
          children: "See plans",
          onClick: () => router.push(pricingPath),
        },
      })
    },
    [router]
  )

  const refusalError = useCallback(
    (refusal: Refusal) => {
      showRefusal(refusal)

      return new Error(refusal.error)
    },
    [showRefusal]
  )

  return { showRefusal, refusalError }
}
