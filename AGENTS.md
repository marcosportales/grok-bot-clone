<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## GIT

- Never create branches, worktrees, or commits automatically. Only do so when the user explicitly asks for that specific action in the current request.
- Leave changes uncommited in the working tree on the current branch and let the user decide when and how to commit.

## DiceBear

Use DiceBear 10. Documentation: <https://www.dicebear.com/llms.txt>

There are seven native cores with identical output, not one library with
wrappers. Use the one matching this project's language. Do not reach for the
JavaScript core when the project is written in something else:

    JavaScript  @dicebear/core + @dicebear/styles
    PHP         dicebear/core + dicebear/styles
    Python      dicebear-core + dicebear-styles
    Rust        dicebear-core + dicebear-styles
    Go          github.com/dicebear/dicebear-go/v10 + github.com/dicebear/styles/v10
    Dart        dicebear_core + dicebear_styles
    C#          DiceBear.Core + DiceBear.Styles

Every style page carries a loading snippet for all seven, for example
<https://www.dicebear.com/styles/lorelei/index.md>

HTTP API: <https://api.dicebear.com/10.x/><style>/svg?seed=<seed> The seed is a
query parameter, not a path segment. Options are query parameters too; array
values are separated by commas.

Options named after a component end in Variant: eyesVariant, not eyes. This
holds in all seven cores and in the HTTP API. Look up the options of a style at
<https://api.dicebear.com/10.x/><style>/options.json

Write these forms, not the ones on the left. The left column is pre-10 and the
API does not reject it, so an outdated call runs and silently does the wrong
thing:

    avatars.dicebear.com/api/<style>/<seed>.svg  ->  api.dicebear.com/10.x/<style>/svg?seed=<seed>
    api.dicebear.com/9.x/<style>/svg             ->  api.dicebear.com/10.x/<style>/svg
    npm install @dicebear/collection             ->  npm install @dicebear/styles
    npm install @dicebear/lorelei                ->  npm install @dicebear/styles
    createAvatar(lorelei, { seed })              ->  new Avatar(new Style(definition), { seed })
    { eyes: ['variant01'] }                      ->  { eyesVariant: ['variant01'] }
    ?radius=50                                   ->  ?borderRadius=50

Only JavaScript and the HTTP API have a pre-10 form. The other six cores were
released in 2026 and never had one, so any older-looking PHP, Python, Rust, Go,
Dart or C# API attributed to DiceBear is invented rather than outdated.

## Forms

Per table, one zod schema in `lib/db/schema.ts`, derived from the table with
`createInsertSchema` from `drizzle-zod`. The form, the action, and the table
share it, and `z.infer` gives one type for the values:

    export const insertBotSchema = createInsertSchema(bots, {
      name: (schema) => schema.trim().min(1, "Give your bot a name."),
      instructions: (schema) => schema.max(2000, "Keep the instructions under 2000 characters."),
    }).omit({ id: true, userId: true, sandboxId: true, createdAt: true })

    export type InsertBot = z.infer<typeof insertBotSchema>

An override receives the base column schema, and `drizzle-zod` applies the
optional and nullable wrapping after your override returns. Call `.trim()` and
`.min()` on that base schema.

Omit the columns the server owns. `userId` comes from the Clerk session, `id`
and `createdAt` are generated, and `sandboxId` is assigned later. A client can
never assert them. `drizzle-zod` leaves a generated column optional in the
insert schema, so a form that picks that value sends it in the payload. The
dialog's `avatar` seed is one.

Parse the schema again inside the action, because a Server Action is a public
endpoint that anyone can post to. Take `userId` from `auth()` instead of the
payload, and return a result such as `{ ok, bot }` instead of throwing. Return
only what the form renders, because the return value is serialized into the RSC
payload. Report the outcome with `toast.add()` from `@/components/ui/toast`.

Build the fields from `Field`, `FieldLabel`, `FieldDescription`, and
`FieldError`, driven by `Controller` and `zodResolver`. The shadcn skill owns
those component rules in `.agents/skills/shadcn/rules/forms.md`.

A `sm:max-w-md` dialog is 448px wide at the `sm` breakpoint and up, and its
`p-4` leaves 416px for content. Four option chips at the default `ToggleGroup`
size overflow that 416px, so a dialog of this width sets `size="sm"`,
`spacing={1}`, and `className="w-full flex-wrap justify-between"` on its
`ToggleGroup`.

Measure a row with `getBoundingClientRect` through the `verify-grok-bot-clone`
skill instead of trusting a screenshot. The home page is behind Clerk, so render
a form on a temporary unauthenticated route to reach it in a browser, and delete
that route before committing.
