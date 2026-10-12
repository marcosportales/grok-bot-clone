# Chat page

A chat lives at `/chats/<id>` inside the dashboard shell. The page is behind
Clerk, and the id is matched against the signed-in user, so an id you do not own
reads as missing rather than as somebody else's chat. Signed in, the page shows a
header that names the chat and holds the two controls for it: the title itself,
which opens the bot's edit dialog, and the desktop toggle. Under the header the
conversation holds the messages, and a composer at the bottom sends a new one. A
group chat shares this route and adds a picker, so its own behavior is in
[Group chat](./group-chat.md). The dialog the title opens is
[Bot dialog](./bots.md), and the list the id comes from is
[Sidebar](./sidebar.md).

## Sub-features

- `chat-gate` signed out, a request for `/chats/<id>` redirects to the sign-in
  route with a `redirect_url` back to the chat.
- `chat-header` the page shows a header that names the chat and holds its controls.
- `chat-edit` the title button opens the `Edit bot` dialog for that chat's bot.
- `chat-thread` the body shows the conversation's messages, and `Send a message`
  while the conversation is empty.
- `chat-composer` the composer holds the `What would you like to know?` textbox and
  the `Submit` button.
- `chat-send` submitting the composer appends the message to the thread, and the
  bot's answer arrives as a second message.
- `chat-streaming` the composer's button reads `Stop` while an answer streams.
- `chat-desktop` the `Toggle Desktop` button opens the desktop panel beside the
  conversation. The panel holds the live screen of the chat's computer, previews
  it, and opens it fullscreen when the preview is clicked.
- `chat-desktop-group` on a group chat the same button is shown but disabled, so
  the panel cannot be opened there and no screen is asked for.
- `chat-screen` the preview shows what the computer is displaying, and a refresh
  control beside it asks for the screen again.
- `chat-screen-fullscreen` clicking the preview moves that one screen into a
  dialog that fills the window, where it takes the keyboard and the mouse.
- `chat-screen-missing` a chat whose computer has no sandbox shows `No screen`
  instead of an empty box.
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
  `button "<title>"`, and beside it `button "Toggle Desktop"` carrying
  `expanded=false`. `<title>` is the bot's name for a direct chat.
- **Edit the bot.** Run `$CG click --role button --name "<title>"`, then
  `$CG eval "!!document.querySelector('#edit-bot-form')"`. It prints `true`, and a
  `dialog "Edit bot"` holds the bot's own answers.
- **Send a message.** Open a chat that has no messages and run
  `$CG eval "document.querySelector('h3')?.innerText"`. It prints
  `"Send a message"`. Run
  `$CG click --role textbox --name "What would you like to know?"`, then
  `$CG type "Say hello in one word."`, then
  `$CG click --role button --name "Submit"`. The button's accessible name is `Stop`
  while the answer streams and `Submit` again once it ends. Read the thread with
  `$CG eval "document.querySelector('[role=log]').innerText"`. It holds your line
  and the bot's answer, one after the other.
- **Read the thread.** The message text never appears in an ARIA snapshot, because
  a message body is an unnamed `paragraph` and the snapshot drops those. Use
  `$CG text` or the `innerText` read above for the words.
- **Toggle the desktop panel.** Run `$CG click --role button --name "Toggle Desktop"`,
  then
  `$CG eval "[...document.querySelectorAll('[data-panel]')].map((p) => p.id + ':' + Math.round(p.getBoundingClientRect().width))"`,
  then the same click again. Closed, the widths read `chat:<all of it>` and
  `chat-desktop:0` with no separator in the tree. Open, `chat-desktop` holds 40% of
  the group and a `separator` appears between the two. `$CG snapshot` reports
  `expanded=true` on the button while the panel is open.
- **Watch the screen.** With the panel open, run
  `$CG eval "document.querySelector('#chat-desktop iframe')?.src"`. It prints a
  `https://6080-<subdomain>.daytonaproxy01.eu/vnc.html?...` URL, and the frame shows
  the sandbox desktop rather than a black box or a directory listing. The URL is a
  pre-signed Daytona preview URL, so it is a credential and only ever arrives while
  the panel is open.
- **A group chat's toggle.** Open a group chat, then run
  `$CG eval "document.querySelector('button[aria-label=\"Toggle Desktop\"]').disabled"`.
  It prints `true`, `$CG snapshot` reports `button "Toggle Desktop" disabled=true`
  beside `heading "<group name>"`, and
  `$CG eval "getComputedStyle(document.querySelector('button[aria-label=\"Toggle Desktop\"]')).opacity"`
  prints `0.5` against `1` on a direct chat. A pointer press cannot land:
  `$CG click --role button --name "Toggle Desktop"` fails with
  `target is covered at its centre point`. Fire the handler directly instead with
  `$CG eval "document.querySelector('button[aria-label=\"Toggle Desktop\"]').click()"`,
  then re-read the panel widths, which still read `chat:<all of it>` and
  `chat-desktop:0`, re-read `document.querySelector('#chat-desktop iframe')`, which
  is still `null`, and compare
  `performance.getEntriesByType('resource').filter(e=>e.initiatorType==='fetch').map(e=>e.name)`
  before and after, which is the same list.
- **Open the screen fullscreen.** Run
  `$CG click --role button --name "Open <bot>'s screen fullscreen"`. A
  `dialog "<bot>'s screen"` holds the same screen, and
  `$CG eval "document.querySelector('#chat-desktop iframe') === null"` prints
  `true`: the one frame has moved into the dialog rather than a second one being
  built. Count frames before and after to prove nothing reconnected, per Gotchas.
- **The dialog keeps its screen.** Run `$CG press Escape`, then `$CG press Enter`,
  then any letter. The dialog stays open and the keys reach the computer instead.
  `$CG eval "!!document.querySelector('[data-slot=dialog-content]')"` still prints
  `true`. Leave by
  `$CG click --role button --name "Close the fullscreen screen"`.
- **A chat with no computer.** Open a chat whose first member has no sandbox, then
  open the panel. The box reads `No screen` with `This bot has no screen yet.`, and
  `$CG eval "!!document.querySelector('#chat-desktop iframe')"` prints `false`.
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
- The transcript loads after the first paint, so the thread is briefly empty even
  on a chat with history. Wait for a message before asserting on one.
- `snapshot` drops unnamed `paragraph` nodes, and a message body is one. Pair every
  assertion about what a message says with `$CG text` or an `innerText` read of
  `[role=log]`.
- The composer's textbox has no label. Its accessible name is the placeholder
  `What would you like to know?`.
- The submit button is `Submit` at rest and `Stop` while a turn streams, so a
  recipe that clicks `Submit` mid-turn finds no such button.
- `control-grok`'s `press` accepts one letter, one digit, `d`, `Tab`, `Enter`,
  `Escape`, space, or a modifier chord, so it cannot send the arrow keys, `Home`,
  `End`, or `F6` that resize a separator. Until it can, drive a resize by
  dispatching the key at the focused separator with `$CG eval`, for example
  `document.querySelector('[data-slot=resizable-handle]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))`.
  Measured on a 1024px group: one arrow moves the boundary 5%, and `Home` takes
  the split to the chat panel's own `minSize`.
- `Enter` on the chat page's separator does nothing. The library collapses the
  first panel beside the separator, which is the conversation, and the
  conversation is not collapsible.
- The screen is one iframe serving two hosts, so a plain DOM move would tear it
  down and reconnect the VNC. It is moved with `Element.moveBefore`, which
  preserves it. To prove a change did not break that, tag iframes as they are
  created and count their `load` events:
  `$CG eval "(() => { window.__f = 0; const c = document.createElement.bind(document); document.createElement = (t, ...r) => { const e = c(t, ...r); if (String(t).toLowerCase() === 'iframe') { window.__f += 1; window.__e = e; let n = 0; e.addEventListener('load', () => { e.dataset.n = String(++n) }) } return e }; return 'tagged' })()"`.
  One frame and `data-n` of `1` after opening the panel, opening the dialog, and
  closing it again is the pass. Two of either means the connection restarted.
- The fullscreen dialog ignores every close the dialog itself would take, so
  Escape, an outside press, and the theme's `d` hotkey do nothing while it is
  open. That is deliberate: those keys belong to the computer on screen. The
  close button is the only way out.
- The preview is view only. A transparent button covers the screen so a click
  opens the dialog instead of landing on the desktop, and the frame is left out of
  the tab order until it is fullscreen.
- A group chat's toggle is disabled, and the disabled button variant sets
  `pointer-events: none`, so `click --role button --name "Toggle Desktop"` fails
  with `target is covered at its centre point`. On a group that is the pass, not a
  broken run. Use the `eval` click above to show the handler does nothing.
- The screen is asked for only once per page and only when the panel is first
  opened, because answering it can start a stopped sandbox. A cold start takes a
  while, and the box reads `Starting the screen` until the URL arrives. Give a
  cold run a minute before calling it broken.
