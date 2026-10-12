import type { LanguageModelUsage } from "ai"
import { getUsage } from "tokenlens"

/**
 * What one turn's tokens cost us, in micro-USD. Micros rather than dollars so
 * the ledger stores an exact integer and repeated addition cannot drift.
 * `tokenlens` prices by model id and is already how this project renders cost
 * in `components/ai-elements/context.tsx`. An unpriced model yields zero rather
 * than throwing, which would otherwise turn a price-catalog gap into a failed
 * chat turn.
 */
export function aiCostMicros(
  modelId: string,
  usage: LanguageModelUsage
): number {
  const cost = getUsage({
    modelId,
    usage: {
      input: usage.inputTokens ?? 0,
      output: usage.outputTokens ?? 0,
    },
  }).costUSD?.totalUSD

  return Math.max(0, Math.round((cost ?? 0) * 1_000_000))
}
