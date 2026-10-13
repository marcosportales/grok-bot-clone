/**
 * Preamble for the scripts in `scripts/`. Node runs TypeScript by stripping
 * types, which does not resolve the `@/` alias Next sets up, the extensionless
 * relative imports the bundler resolver allows, or `server-only`, which throws
 * outside the Next server. One hook fixes all three so a script imports the
 * app's own modules rather than a copy of them. It also loads `.env.local` the
 * way Next does.
 *
 * A static `import "./lib/ts-hooks.ts"` is enough: the hook only has to be
 * registered before the app modules resolve, and they resolve when a script
 * reaches its own `await import("@/...")`.
 */
import nextEnv from "@next/env"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

export const root = path.join(import.meta.dirname, "..", "..")

type ResolveResult = { url: string; shortCircuit?: boolean }
type ResolveContext = { parentURL?: string }
type ResolveHook = (
  specifier: string,
  context: ResolveContext,
  nextResolve: (specifier: string, context: ResolveContext) => ResolveResult
) => ResolveResult

// `registerHooks` shipped in Node 22.15 and the project's `@types/node` is 20, so
// the hook's type comes from the runtime rather than the declarations.
const { registerHooks } = (await import("node:module")) as unknown as {
  registerHooks: (hooks: { resolve: ResolveHook }) => void
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,", shortCircuit: true }
    }

    const from = context.parentURL?.startsWith("file:")
      ? path.dirname(fileURLToPath(context.parentURL))
      : root
    const base = specifier.startsWith("@/")
      ? path.join(root, specifier.slice(2))
      : specifier.startsWith(".")
        ? path.resolve(from, specifier)
        : null

    if (base !== null) {
      for (const candidate of [
        base + ".ts",
        base + ".tsx",
        path.join(base, "index.ts"),
      ]) {
        if (existsSync(candidate)) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true }
        }
      }
    }

    return nextResolve(specifier, context)
  },
})

nextEnv.loadEnvConfig(root)
