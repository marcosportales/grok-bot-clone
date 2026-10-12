import * as Sentry from "@sentry/nextjs"

import { beforeSendLog, browserConsoleLogLevels } from "./lib/sentry-logs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  replaysSessionSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  replaysOnErrorSampleRate: 1.0,
  beforeSendLog,

  // Replay keeps the SDK's default privacy posture: all text masked, media blocked.
  integrations: [
    Sentry.replayIntegration(),
    Sentry.consoleLoggingIntegration({ levels: browserConsoleLogLevels }),
  ],

  // `release` is injected by the build plugin (git HEAD SHA), so it is not set here.
  // `environment` resolves from SENTRY_ENVIRONMENT, then Vercel, then NODE_ENV.
})

// Next.js 15.3+ reports App Router navigations through this hook. Without it,
// client-side navigations are not instrumented.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
