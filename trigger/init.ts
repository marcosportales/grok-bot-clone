import { logger, tasks } from "@trigger.dev/sdk"
import * as Sentry from "@sentry/node"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (!dsn) {
  logger.warn("NEXT_PUBLIC_SENTRY_DSN is not set, so task failures will not reach Sentry.")
}

Sentry.init({
  dsn,
  environment:
    process.env.SENTRY_ENVIRONMENT ??
    (process.env.NODE_ENV === "production" ? "production" : "development"),
  // Sentry's default integrations patch console output and module loading inside
  // a bundled worker; error capture needs neither.
  defaultIntegrations: false,
  integrations: [Sentry.onUncaughtExceptionIntegration()],
  // Trigger.dev owns the worker's OpenTelemetry provider. The Node SDK already
  // defaults this to false; keep it explicit so an upgrade cannot take it over.
  enableOpenTelemetrySetup: false,
})

tasks.onFailure(({ ctx, task, error }) => {
  Sentry.captureException(error, {
    tags: {
      "trigger.task.id": task,
      "trigger.run.id": ctx.run.id,
      "trigger.attempt.number": ctx.attempt.number,
      "trigger.environment.type": ctx.environment.type,
    },
    contexts: {
      trigger: {
        task: { id: task, filePath: ctx.task.filePath },
        run: {
          id: ctx.run.id,
          url: `https://cloud.trigger.dev/projects/${ctx.project.ref}/runs/${ctx.run.id}`,
        },
        attemptNumber: ctx.attempt.number,
        environment: { slug: ctx.environment.slug, type: ctx.environment.type },
        queue: ctx.queue.name,
        machine: ctx.machine.name,
      },
    },
  })
})
