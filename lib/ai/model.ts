import { google } from "@ai-sdk/google"
import { groq } from "@ai-sdk/groq"
import { createProviderRegistry, type LanguageModel } from "ai"

const providers = { google, groq }

// The port is the AI SDK's own `LanguageModel`, the type `streamText` accepts.
// A port declared here would re-implement streaming to hand the SDK its own type
// back.
const registry = createProviderRegistry(providers)

type ModelId = `${keyof typeof providers}:${string}`

// A checkout with no `AI_MODEL` keeps running the model it ran before.
const defaultModel: ModelId = "google:gemini-3.8-flash"

// `AI_MODEL` is external input, so it is parsed at this boundary. Left unparsed,
// a wrong value fails later inside a Trigger run as an SDK error.
function isModelId(value: string): value is ModelId {
  const separator = value.indexOf(":")

  return (
    separator > 0 &&
    separator < value.length - 1 &&
    value.slice(0, separator) in providers
  )
}

export function chatModel(): LanguageModel {
  const id = process.env.AI_MODEL?.trim() || defaultModel

  if (!isModelId(id)) {
    throw new Error(
      `AI_MODEL is "${id}". Use "provider:model-id" with one of: ${Object.keys(providers).join(", ")}.`
    )
  }

  return registry.languageModel(id)
}
