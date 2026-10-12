import { google } from "@ai-sdk/google"
import { groq } from "@ai-sdk/groq"
import { createProviderRegistry, type LanguageModel } from "ai"

const providers = { google, groq }

const registry = createProviderRegistry(providers)

type ModelId = `${keyof typeof providers}:${string}`

const defaultModel: ModelId = "google:gemini-3.8-flash"

function isModelId(value: string): value is ModelId {
  const separator = value.indexOf(":")

  return (
    separator > 0 &&
    separator < value.length - 1 &&
    value.slice(0, separator) in providers
  )
}

export function chatModelId(): ModelId {
  const id = process.env.AI_MODEL?.trim() || defaultModel

  if (!isModelId(id)) {
    throw new Error(
      `AI_MODEL is "${id}". Use "provider:model-id" with one of: ${Object.keys(providers).join(", ")}.`
    )
  }

  return id
}

export function chatModel(): LanguageModel {
  return registry.languageModel(chatModelId())
}
