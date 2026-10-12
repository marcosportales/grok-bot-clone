import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // `release` is injected by the build plugin (git HEAD SHA), so it is not set here.
  // `environment` resolves from SENTRY_ENVIRONMENT, then Vercel, then NODE_ENV.
})
