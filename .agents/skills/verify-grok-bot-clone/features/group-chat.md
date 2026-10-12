# Group chat

A group chat is one conversation several bots share. `Create group chat` in the
sidebar's `New` menu opens the dialog that makes one, and a valid submit lands on
`/chats/<id>` with the group's name in the header. The group renders on the same
route as a direct chat and keeps the same composer, with three differences: its
heading is plain text because no single bot owns it, the desktop toggle is
disabled, and the composer holds a picker that chooses which member answers. When the
answering member decides the request is another's job, it hands the request over:
the thread shows a card naming the member, the picker moves to them, and they
answer the same request without the user typing again. The route, the header, and
the conversation around it are [Chat page](./chat-page.md), and the dialog that
creates a bot for the group is [Bot dialog](./bots.md).

## Sub-features

- `group-open` the sidebar's `New` then `Create group chat` opens a dialog named
  `New group chat`.
- `group-validate` a submit with no name or fewer than two bots keeps the dialog
  open with `Name the group.` and `Pick at least two bots.` under the fields.
- `group-create` a valid submit writes the group and its members, closes the
  dialog, toasts `<name> is ready`, and lands on the new chat.
- `group-header` the header names the group and holds no button, so no dialog edits
  it.
- `group-toggle` the `Toggle Desktop` button is shown disabled on a group, so no
  screen is asked for.
- `group-picker` the composer holds `combobox "Choose a bot"`, listing the group's
  members, and the chosen one answers the next message.
- `group-face` each assistant message shows the face of the member who wrote it.
- `group-handoff` a member gives the request to another; a `Handed off to <name>`
  card names them with a one-sentence reason from the member who handed it over,
  the picker moves to them, and they answer the same request.

## How to get to it (user POV)

- Choose `New` in the sidebar, then `Create group chat`, name the group, pick at
  least two bots, and choose `Create group`.
- Choose a group's row in the sidebar list or the search palette, the same as any
  other chat.

## Driving it with control-grok

Preconditions:

- An owned instance is healthy: `$CG doctor` reports `doctor: healthy`.
- A signed-in session:
  `GROK_VERIFY_EMAIL=... GROK_VERIFY_PASSWORD=... $CG signin`.
- At least two bots exist, so the dialog has enough to pick from. Create them with
  [Bot dialog](./bots.md).
- Baseline state: `$CG open /`.
- `ART=$($CG artifacts)` is the artifact directory for this run.

- **Open the dialog.** Run `$CG click --role button --name "New"`, then
  `$CG click --role menuitem --name "Create group chat"`, then
  `$CG snapshot "$ART/group-dialog.aria.txt" --hide "nextjs-portal,next-route-announcer"`.
  The tree holds `dialog "New group chat"`, `heading "New group chat" level=2`, a
  `textbox "Name"`, one `checkbox "<bot name>"` per bot, and the buttons `Cancel`,
  `Create group`, and `Close`.
- **Validate first.** Run `$CG click --role button --name "Create group"` with the
  dialog untouched. The dialog stays open and reads `Name the group.` and
  `Pick at least two bots.` under the two fields.
- **Create it.** Run `$CG click --role textbox --name "Name"`, then
  `$CG type "Handoff check"`, then `$CG click --role checkbox --name "<first bot>"`
  and the same for `"<second bot>"`, then
  `$CG click --role button --name "Create group"`. The `Notifications` region holds
  `<name> is ready` with `Pick which bot answers and start the conversation.`, and
  the page moves to `/chats/<id>`.
- **The header and the empty group.** Run
  `$CG snapshot "$ART/group-page.aria.txt" --hide "nextjs-portal,next-route-announcer"`.
  The tree holds `heading "<group name>" level=1` with no button around it,
  `button "Toggle Desktop" disabled=true`, `heading "Send a message" level=3` in
  the log, and a form holding `textbox "What would you like to know?"`,
  `combobox "Choose a bot"`, and `button "Submit"`.
- **The picker.** Run `$CG click --role combobox --name "Choose a bot"`, then
  `$CG eval "[...document.querySelectorAll('[role=option]')].map((o) => o.innerText)"`.
  It prints one member name per line. Choose one with
  `$CG click --role option --name "<member>"`, then read the trigger back with
  `$CG eval "document.querySelector('[aria-label=\"Choose a bot\"]').innerText"`.
- **Hand it off.** Leave the picker on the member whose job is not the request's,
  then run `$CG click --role textbox --name "What would you like to know?"`, then
  `$CG type "<a request that belongs to another member>"`, then
  `$CG click --role button --name "Submit"`. Wait out both turns, which is two
  model turns and can take a minute. A snapshot then holds
  `image "<first member>"` beside
  `button "Handed off to <second member> Completed"`, with the one-sentence reason
  the first member gave in the card. The picker reads `<second member>` without a
  second user message, and `<second member>`'s answer is the next group in the log.
- **Visual proof.** Run
  `$CG screenshot "$ART/group-chat.png" --hide "nextjs-portal,next-route-announcer"`
  while the group page is open.

## Gotchas

- The group route is the chat route, so every recipe in [Chat page](./chat-page.md)
  applies, including the transcript's lazy load and the message text the ARIA
  snapshot drops.
- The dialog lists every bot the account owns. The checkboxes are the bots, so
  `--role checkbox --name "<bot name>"` is the handle. Two bots can share a name,
  and then both checkboxes do, so give the bots distinct names for this run.
- A group needs at least two bots. Fewer than two checked shows
  `Pick at least two bots.` on submit.
- The picker renders only when the chat has more than one member, so a direct chat
  has no `Choose a bot`.
- Every member of a group works on the first member's computer, so the tools and
  the desktop panel name one machine. The panel stays disabled on a group because
  that member's own direct chat already shows the screen.
- While the handoff turn streams, the card can appear in both the handing-off
  message and the answering one. A reload shows one card, because the transcript
  stores it once.
- A handoff is an action, not a re-sent message, so the answering member's turn
  runs on the history as it stands. Nothing new appears in the user's own message.
