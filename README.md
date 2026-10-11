# Next.js template

This is a Next.js template with shadcn/ui.

## Choosing the AI provider

The chat agent streams from whichever provider `AI_MODEL` names. The value is
`provider:model-id`, the same shape the AI SDK's provider registry parses.

```
AI_MODEL=groq:openai/gpt-oss-20b
```

`lib/ai/model.ts` is the only module that imports a provider package.
`trigger/chat.ts` asks it for a model and never names a provider, so moving to
another provider is an environment change rather than a code change. When
`AI_MODEL` is unset, the model falls back to the default declared in
`lib/ai/model.ts`.

The installed providers are the keys of the `providers` record in that file.
Adding one takes a dependency and two lines. Install the `@ai-sdk/<name>`
package, import its provider, and add it to the record. The provider's own
package reads its API key from the environment.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```
