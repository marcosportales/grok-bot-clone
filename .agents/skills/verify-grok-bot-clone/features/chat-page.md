# Chat page

A chat lives at `/chats/<id>` inside the dashboard shell. The page is behind
Clerk, and the id is matched against the signed-in user, so an id you do not own
reads as missing rather than as somebody else's chat. Signed in, the page shows a
header that names the chat and holds the two controls for it: the title itself,
which opens the bot's edit dialog, and a share placeholder. The conversation body
is still empty, because nothing sends a message yet. The dialog the title opens is
[Bot dialog](./bots.md), and the list the id comes from is
[Sidebar](./sidebar.md).

## Sub-features

- `chat-gate` signed out, a request for `/chats/<id>` redirects to the sign-in
  route with a `redirect_url` back to the chat.
- `chat-header` the page shows a header that names the chat and holds its controls.
- `chat-edit` the title button opens the `Edit bot` dialog for that chat's bot.
- `chat-share` the `Share desktop` button is a placeholder that sends nothing.
- `chat-missing` an unknown id renders the not-found page, with the shell still
  around it.

## How to get to it (user POV)

- Choose a chat row in the sidebar list, or a result in the search palette.
- Type the chat URL into a browser.
- Choose the chat's name in its header to edit the bot.

## Driving it with control-grok

Preconditions:

- An owned instance is healthy: `$CG doctor` reports `doctor: healthy`.
- A signed-in session:
  `GROK_VERIFY_EMAIL=... GROK_VERIFY_PASSWORD=... $CG signin`.
- At least one chat exists. Create one with [Bot dialog](./bots.md) if the account
  is new.
- Baseline state: `$CG open /`.
- `ART=$($CG artifacts)` is the artifact directory for this run.

- **Read an id.** Run
  `$CG eval "[...document.querySelectorAll('a[href^=\"/chats/\"]')][0].getAttribute('href')"`.
  It prints `"/chats/<id>"`.
- **Open it.** Run `$CG open /chats/<id>`. The page renders inside the shell.
- **Header.** Run
  `$CG snapshot "$ART/chat-page.aria.txt" --hide "nextjs-portal,next-route-announcer"`.
  The tree holds a `sectionheader` with `heading "<title>" level=1` around
  `button "<title>"`, and beside it `button "Share desktop"`. `<title>` is the
  bot's name for a direct chat.
- **Edit the bot.** Run `$CG click --role button --name "<title>"`, then
  `$CG eval "!!document.querySelector('#edit-bot-form')"`. It prints `true`, and a
  `dialog "Edit bot"` holds the bot's own answers.
- **Share sends nothing.** Run
  `$CG click --role button --name "Share desktop"`, then
  `$CG eval "({ path: location.pathname, dialogs: document.querySelectorAll('[role=dialog]').length, toasts: document.querySelectorAll('[data-slot=toast]').length })"`.
  The click exits `0`, the path is unchanged, and no dialog or toast appears. This
  control is a placeholder; see Gotchas.
- **Missing id.** Run `$CG open /chats/does-not-exist-xyz`, then `$CG text`. Stdout
  contains `404` and `This page could not be found.`, and it still contains the
  sidebar's `New` and `Search`, so the shell stayed around the missing page.
- **The gate.** Sign out, then run `$CG open /chats/<id>` and
  `$CG eval "location.pathname + location.search"`. The path starts with
  `"/sign-in?redirect_url="` and the query decodes to the app URL for that chat.
- **Visual proof.** Run
  `$CG screenshot "$ART/chat-page.png" --hide "nextjs-portal,next-route-announcer"`.

## Gotchas

- The page gates on Clerk before it reads the id, so a signed-out request for a
  chat never shows the not-found page. It lands on the sign-in route instead.
- An id owned by another account reads exactly like an unknown id: the same
  not-found page. To prove that case you need a chat owned by a second account, so
  treat it as unreachable until one exists. The unknown-id recipe covers the
  rendering.
- The header is a `sectionheader`, not a `banner`, because it sits inside the
  layout's `<main>`. A recipe that looks for a `banner` finds nothing.
- The heading and its button share the chat's name. Use `--role heading` to read
  the name and `--role button` to open the dialog.
- The title button's accessible name is the chat title, so a chat named `Ada`
  makes `--role button --name "Ada"` ambiguous with anything else on the page that
  carries that name. On this page it is the only one.
- The closed search palette leaves a `heading "Search chats"` in the tree here too.
  See [Sidebar](./sidebar.md#gotchas).
- The page stops after the header. There is no message list and no composer, so a
  recipe that looks for a conversation finds none.
