# Chat tool cards

A chat turn runs tools on the bot's computer, and each call renders a card in the
thread above the answer. The card holds a header naming the call and its state, and
a body whose shape depends on the tool. `bash` gets a two-tab sandbox with `Command` and
`Output`; `readFile`, `writeFile`, and `listFiles` get a path title and a code
block; `showScreen` gets an image; the pointer and keyboard tools get a title
alone; anything unmapped falls back to a card named after the tool.
[Chat file tools](./chat-files.md) owns what the file tools read and write;
`handoff` is [Group chat](./group-chat.md); the thread around the cards is
[Chat page](./chat-page.md).

## Sub-features

- `tool-bash` a `bash` call renders a card titled with the command, holding a
  `Command` tab and an `Output` tab.
- `tool-state` the card header carries the call's state, `Completed` once it
  returns, so its accessible name reads `<title> Completed`.
- `tool-exit-badge` the `Output` tab adds a destructive `Exit <n>` badge, and only
  when the command's exit code is not zero.
- `tool-list` a `listFiles` call renders `List <path>`.
- `tool-pointer` a `mouseClick`, `mouseMove`, or `mouseScroll` call renders a
  title-only card naming the point and the action.
- `tool-keyboard` a `keyboardType` call renders the typed text as its title and
  `keyboardPress` renders the chord.
- `tool-screen` a `showScreen` call renders a `Screen` card holding an image named
  `The desktop`.
- `tool-view-dropped` a `viewScreen` part renders nothing at all.
- `tool-fallback` a tool with no card renders under its own tool name with its
  input and output.

## How to get to it (user POV)

- Ask the bot in a chat to do something on its computer, and its tool calls appear
  as cards in the thread above the answer.
- Expand a card's header to read the command, the output, or the image.

## Driving it with control-grok

Preconditions:

- An owned instance is healthy: `$CG doctor` reports `doctor: healthy`.
- A signed-in session on the paid plan, because the composer refuses a free one
  ([Billing](./billing.md)).
- A direct chat whose bot has a `sandbox_id`, which bot creation gives it, and a
  running `trigger dev` worker: the tools only exist inside a task.
- Baseline state: the chat open at `/chats/<id>`.
- `ART=$($CG artifacts)` is the artifact directory for this run.

- **The bash card.** Run
  `$CG click --role textbox --name "What would you like to know?"`, then
  `$CG type "Run the command echo hello-tool in a bash shell on your computer and show me the result."`,
  then `$CG click --role button --name "Submit"`. Wait until
  `$CG eval "document.querySelectorAll('button[aria-label=\"Stop\"]').length"` reads
  `0`, then
  `$CG snapshot "$ART/chat-tool-bash.aria.txt" --hide "nextjs-portal,next-route-announcer"`.
  The tree holds `button "echo hello-tool Completed" expanded=true`, a `tablist`
  with `tab "Command" selected=true` and `tab "Output"`, and `tabpanel "Command"`.
  `$CG eval "document.querySelector('[role=log]').innerText"` holds the command and
  the answer's `hello-tool`.
- **The screen card.** Run the same three commands with
  `$CG type "Take a screenshot of your screen and show it to me."`. A snapshot then
  holds `button "Screen Completed" expanded=true` and `image "The desktop"`.
- **The exit badge.** Ask for a command that fails, such as
  `$CG type "Run the command exit 3 on your computer and tell me what happened."`.
  A snapshot of the card holds `Exit 3` and the `Output` tab. A command that exits
  `0` adds no badge.
- **Visual proof.** Run
  `$CG screenshot "$ART/chat-tool-bash.png" --hide "nextjs-portal,next-route-announcer"`
  with the card open.

## Gotchas

- Every card is a `button` whose accessible name is `<title> <state>`, so match the
  whole string: `echo hello-tool Completed`, not `echo hello-tool`.
- The title is the model's own argument, clipped to 80 characters (`chat-tool.tsx`),
  so a command, a typed line, or a clicked point differs between runs. Assert on the
  tool's effect and the card's state, not on the title text.
- A card body is named and does appear in an ARIA snapshot, unlike the bot's prose,
  which is an unnamed `paragraph` the snapshot drops. The words inside a code block
  still need `$CG text` or an innerText read.
- The bash card's `Output` tab is selected once the call returns, so
  `tab "Command" selected=true` means the call has not come back yet.
- The `Exit <n>` badge is destructive and conditional, so its absence means an exit
  code of `0` and never a broken card.
- `mouseClick`, `mouseMove`, `mouseScroll`, `keyboardType`, and `keyboardPress`
  render a header with no body at all. An expanded snapshot then shows the title
  alone.
- `viewScreen` is dropped on purpose and renders nothing, so a turn that asks for
  the screen inline adds no card. The desktop panel is the way to see a screen
  ([Chat page](./chat-page.md)).
- The model chooses its tools, so a prompt that asks only for a result may be
  answered with `bash` and no other card. Read the cards, not the answer, when the
  point is that a card renders.
- A pointer card repeats the coordinates the model asked for, so the same click
  lands at a different point on a differently sized screen.
