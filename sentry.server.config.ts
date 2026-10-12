import * as Sentry from "@sentry/nextjs"

import { beforeSendLog, consoleLogLevels } from "./lib/sentry-logs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  integrations: [Sentry.consoleLoggingIntegration({ levels: consoleLogLevels })],
  beforeSendLog,

  // `release` is injected by the build plugin (git HEAD SHA), so it is not set here.
  // `environment` resolves from SENTRY_ENVIRONMENT, then Vercel, then NODE_ENV.
})
