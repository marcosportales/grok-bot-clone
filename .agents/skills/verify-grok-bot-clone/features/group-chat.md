# Group chat

A group chat is one conversation several bots share. `Create group chat` in the
sidebar's `New` menu opens the dialog that makes one, and a valid submit lands on
`/chats/<id>` with the group's name in the header. The group renders on the same
route as a direct chat and keeps the same composer, with two differences: the
desktop toggle is disabled, and the composer holds a picker that chooses which
member answers. The group's name in the header is a button that opens the
`Edit group chat` dialog, where the name, the members, and the group's existence
are changed. When the answering member decides the request is another's job, it
hands the request over: the thread shows a card naming the member, the picker
moves to them, and they answer the same request without the user typing again.
The route, the header, and the conversation around it are
[Chat page](./chat-page.md), and the dialog that creates a bot for the group is
[Bot dialog](./bots.md).

## Sub-features

- `group-open` the sidebar's `New` then `Create group chat` opens a dialog named
  `New group chat`.
- `group-validate` a submit with no name or fewer than two bots keeps the dialog
  open with `Name the group.` and `Pick at least two bots.` under the fields.
- `group-create` a valid submit writes the group and its members, closes the
  dialog, toasts `<name> is ready`, and lands on the new chat.
- `group-header` the header names the group in a button that opens the
  `Edit group chat` dialog.
- `group-edit` the dialog holds the group's name, a checked `checkbox` per current
  member, and an unchecked one per bot that is not a member; a valid submit
  renames the group and adds and drops members.
- `group-edit-validate` a submit that leaves fewer than two members checked shows
  `Pick at least two bots.` and keeps the dialog open.
- `group-delete` the dialog's `Delete` opens `alertdialog "Delete <name>?"`;
  confirming removes the group and its membership rows and lands on `/`.
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
- Choose the group's name in its header to change its name or its members, or to
  delete the group.

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
  The tree holds `heading "<group name>" level=1` around
  `button "<group name>"`,
  `button "Toggle Desktop" disabled=true`, `heading "Send a message" level=3` in
  the log, and a form holding `textbox "What would you like to know?"`,
  `combobox "Choose a bot"`, and `button "Submit"`.
- **Edit the group.** Run `$CG click --role button --name "<group name>"`. A
  `dialog "Edit group chat"` holds a `textbox "Name"` with the group's name, a
  `checkbox "<member>" checked=true` for each current member, an unchecked
  `checkbox "<other bot>"` for each bot that is not in the group, and the buttons
  `Delete`, `Cancel`, and `Save changes`.
- **Rename and swap a member.** Click the `Name` textbox, run `$CG press ctrl+a`,
  then `$CG type "<new name>"`. Uncheck one member and check a bot that is not in
  the group, then run `$CG click --role button --name "Save changes"`. The
  `Notifications` region holds `<new name> is updated`, the dialog closes, the
  header's button and the sidebar row read the new name, and a read of `chats.name`
  and `chat_members` shows the new name and the new membership. A member that stays
  keeps its `joined_at`.
- **A group needs two.** Uncheck down to one member and submit. The dialog stays
  open and reads `Pick at least two bots.`
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
- **Delete the group.** Open the dialog and run
  `$CG click --role button --name "Delete"`. An `alertdialog "Delete <name>?"`
  holds `Keep it` and `Delete`. The footer's own `Delete` shares that name, so click
  the confirmation's action by selector:
  `$CG click "[data-slot=alert-dialog-action]"`. The `Notifications` region holds
  `<name> is deleted`, the page moves to `/`, the sidebar row is gone, and `chats`
  and `chat_members` hold no row for the id.
- **Visual proof.** Run
  `$CG screenshot "$ART/group-chat.png" --hide "nextjs-portal,next-route-announcer"`
  while the group page is open.

## Gotchas

- The group route is the chat route, so every recipe in [Chat page](./chat-page.md)
  applies, including the transcript's lazy load and the message text the ARIA
  snapshot drops.
- The group header's title is a `button` named after the group, the same shape a
  direct chat's header has. The sidebar row is a `link` whose accessible name also
  carries the age and the preview, so `--role link --name "<group name>"` finds
  nothing. Reach the row by its href.
- Every member of a group works on one computer, the oldest member's, so the tools
  and the desktop panel name that machine, and removing the oldest member moves the
  group onto the next-oldest remaining one. A member that stays keeps its join
  order, so a rename alone never moves the group. The panel stays disabled on a
  group because that member's own direct chat already shows the screen.
- The delete confirmation is a second modal, so `Delete` names two buttons at once.
  Target `[data-slot=alert-dialog-action]` for the one that deletes.
- The dialog lists every bot the account owns. The checkboxes are the bots, so
  `--role checkbox --name "<bot name>"` is the handle. Two bots can share a name,
  and then both checkboxes do, so give the bots distinct names for this run.
- A group needs at least two bots. Fewer than two checked shows
  `Pick at least two bots.` on submit.
- The picker renders only when the chat has more than one member, so a direct chat
  has no `Choose a bot`.
- While the handoff turn streams, the card can appear in both the handing-off
  message and the answering one. A reload shows one card, because the transcript
  stores it once.
- A handoff is an action, not a re-sent message, so the answering member's turn
  runs on the history as it stands. Nothing new appears in the user's own message.
