"use client"

import * as Sentry from "@sentry/nextjs"
import NextError from "next/error"
import { useEffect } from "react"

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        {/*
          `global-error` replaces the root layout, so it has to render its own
          html and body. The App Router does not expose status codes, so the
          default Next.js error page gets 0 and renders a generic message.
        */}
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
