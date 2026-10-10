# Sidebar

The dashboard shell. Signed in, every page under the root layout renders inside
it, so the rail and its controls sit beside the root page and beside a chat. The
rail collapses to a 3rem icon strip and remembers the choice, its `New` button
opens a menu that starts the bot dialog, its `Search` field and the `⌘K` chord
open a palette over the current chat, its list shows one row per chat with the
open one marked, and its footer holds the Clerk account control. The bot dialog
it starts is [Bot dialog](./bots.md), and opening a row lands on
[Chat page](./chat-page.md).

## Sub-features

- `sidebar-toggle` clicking `Toggle Sidebar` collapses the rail to icons and back.
- `sidebar-shortcut` the `meta+b` or `ctrl+b` chord toggles the rail from anywhere
  on the page.
- `sidebar-persist` the collapse choice survives a reload.
- `sidebar-new-menu` `New` opens a menu holding `Create new bot` and
  `Create group chat`.
- `sidebar-new-bot` `Create new bot` opens the `New bot` dialog.
- `sidebar-new-inert` `Create group chat` closes the menu and changes nothing else.
- `sidebar-search` `Search` opens the `Search chats` palette.
- `sidebar-search-shortcut` the `meta+k` or `ctrl+k` chord opens and closes the
  palette.
- `sidebar-search-filter` typing narrows the results to matching chats.
- `sidebar-search-open` choosing a result opens that chat and closes the palette.
- `sidebar-chat-list` one row per chat, showing the bot's face, name, age, and job.
- `sidebar-active-chat` the open chat's row carries `aria-current="page"`.
- `sidebar-empty` an account with no chats shows an empty list and no empty-state
  copy.
- `sidebar-account` `Open user menu` opens the account panel with `Manage account`
  and `Sign out`.

## How to get to it (user POV)

- Sign in. `/` and any chat render inside the shell.
- Choose `Toggle Sidebar` on the rail's edge, or press `⌘B` or `Ctrl+B`.
- Choose `New` in the rail header, then `Create new bot` or `Create group chat`.
- Choose `Search` in the rail header, or press `⌘K` or `Ctrl+K`, then type a query.
- Choose a chat row in the list, or choose a row in the palette, to open that chat.
- Choose `Open user menu` in the rail footer to reach `Manage account` and
  `Sign out`.

## Driving it with control-grok

Preconditions:

- An owned instance is healthy: `$CG doctor` reports `doctor: healthy`.
- A signed-in session:
  `GROK_VERIFY_EMAIL=... GROK_VERIFY_PASSWORD=... $CG signin`.
- At least one chat exists, so the list and the palette have rows. Create one with
  [Bot dialog](./bots.md) if the account is new.
- Baseline state: `$CG open /`, with the rail expanded.
- `ART=$($CG artifacts)` is the artifact directory for this run.

- **Rail state.** Run
  `$CG eval "document.querySelector('[data-slot=sidebar]').getAttribute('data-state')"`.
  It prints `"expanded"`.
- **Collapse.** Run `$CG click --role button --name "Toggle Sidebar"`, then the
  state read again. It prints `"collapsed"` and the row's width drops from 16rem to
  3rem.
- **Persist.** Run `$CG open /` to reload, then the state read and
  `$CG eval "document.cookie.split('; ').find((c) => c.startsWith('sidebar_state'))"`.
  The state is still `"collapsed"` and the cookie reads `"sidebar_state=false"`.
- **Shortcut.** Run `$CG press meta+b`, then the state read. It prints
  `"expanded"`, and `$CG press meta+b` again returns `"collapsed"`. `ctrl+b` does
  the same, which matters because Chrome treats `Ctrl+B` as a browser shortcut.
- **New menu.** Run `$CG click --role button --name "New"`, then
  `$CG snapshot "$ART/sidebar-new-menu.aria.txt" --hide "nextjs-portal,next-route-announcer"`.
  The tree holds `button "New" expanded=true` and `menu "New"` with
  `menuitem "Create new bot"` and `menuitem "Create group chat"`.
- **Start the bot dialog.** Run
  `$CG click --role menuitem --name "Create new bot"`, then
  `$CG eval "!!document.querySelector('#new-bot-form')"`. It prints `true` and a
  `dialog "New bot"` is open. Close it with `$CG press Escape`.
- **Group chat is inert.** Run `$CG click --role button --name "New"`, then
  `$CG click --role menuitem --name "Create group chat"`, then
  `$CG eval "({path: location.pathname, menus: document.querySelectorAll('[role=menu]').length, forms: document.querySelectorAll('form').length})"`.
  Nothing changed: the path is still `/`, no menu is open, and no form appeared. No
  request is sent. This control does nothing yet; see Gotchas.
- **Search opens.** Run `$CG click --role button --name "Search"`, then
  `$CG eval "!!document.querySelector('[data-slot=dialog-content]')"`. It prints
  `true`. A snapshot shows `dialog "Search chats"` holding an unnamed `combobox`
  and `listbox "Suggestions"` with one `option` per chat, named
  `<title> <age> <preview>`.
- **Search closes.** Run `$CG press meta+k`, then
  `$CG eval "!!document.querySelector('[data-slot=dialog-content]')"`. It prints
  `false`. `meta+k` and `ctrl+k` toggle, so the same chord reopens it.
- **Filter.** Run `$CG press meta+k`, then
  `$CG click "[data-slot=command-input]"`, then `$CG type "Ada"`. The listbox
  narrows to one `option` for each chat whose title or preview matches, and
  `CommandEmpty` reports `No chats found.` when nothing matches.
- **Open a chat from the palette.** Run
  `$CG click --role option --name "<title> <age> <preview>"`, then
  `$CG eval "!!document.querySelector('[data-slot=dialog-content]')"` and
  `$CG eval "location.pathname"`. The palette closes and the path is
  `/chats/<id>`. The navigation runs in the browser, so read the path a moment
  after the click.
- **The list.** On `/`, run
  `$CG eval "[...document.querySelectorAll('[data-slot=sidebar-menu-button]')].map((e) => ({ name: e.textContent.trim().replace(/\s+/g, ' '), current: e.getAttribute('aria-current') }))"`.
  One entry per chat carries the bot's name, its age, and its job as the preview.
- **The open chat is marked.** On `/chats/<id>`, run the same read. The row for that
  chat has `current` equal to `"page"` and every other row is `null`.
- **Empty list.** Sign in as an account with no chats, open `/`, then run the list
  read above. It returns `[]`, the tree holds an empty `list` where the rows would
  be, and the palette reports `No chats found.` The root page still shows its own
  empty state, so the two are independent.
- **Collapsed rows keep their names.** Run `$CG press meta+b`, then
  `$CG snapshot`. The chat rows still read `link "<title> <age> <preview>"`, because
  the label moves to screen-reader-only rather than out of the tree.
- **Account panel.** Run `$CG click --role button --name "Open user menu"`, then
  `sleep 2`, then
  `$CG snapshot "$ART/sidebar-account.aria.txt" --hide "nextjs-portal,next-route-announcer"`.
  The tree holds `dialog "Account panel"` with `button "Manage account"` and
  `button "Sign out"`.
- **Visual proof.** Run
  `$CG screenshot "$ART/sidebar-expanded.png" --hide "nextjs-portal,next-route-announcer"`
  expanded and
  `$CG screenshot "$ART/sidebar-collapsed.png" --hide "nextjs-portal,next-route-announcer"`
  collapsed. The collapsed PNG is the icon strip.

## Gotchas

- Every dashboard page's accessibility tree carries a stray
  `heading "Search chats" level=2` with the palette's description, outside any
  dialog. The closed palette renders its screen-reader-only header into the rail
  instead of into the dialog, so a snapshot of the sidebar, the root page, or a
  chat always shows it. Treat it as shell noise. Do not read it as an open palette,
  and do not assert "no dialog is open" against the heading. Check the `dialog`
  role or `[data-slot=dialog-content]` instead. Reported as a product gap.
- The palette's `combobox` carries no accessible name, so
  `click --role combobox --name "..."` fails. Focus it with
  `$CG click "[data-slot=command-input]"` and then `$CG type`.
- The palette's dialog is named `Search chats`, so while it is open
  `dialog "Search chats"` targets it. The heading from the previous bullet shares
  that name, which is why the check above uses the role.
- `Search` and `New` are `sr-only` labels, so both keep their names while the rail
  is collapsed even though the visible text is gone. Same for a chat row: the label
  is visually hidden, not removed from the tree.
- The stable handle for the rail is
  `document.querySelector('[data-slot=sidebar]').getAttribute('data-state')`. Read
  it after a beat, because a collapse read mid-animation reports an intermediate
  width rather than the 3rem strip.
- `sidebar_state` is a cookie, not `localStorage`. `down` and a fresh `up` start a
  new Chrome profile with the rail expanded, so clear or set the cookie when a
  recipe needs baseline state.
- `Create group chat` is a live menu item that does nothing. It closes the menu and
  sends nothing. Reported as a product gap.
- A brand-new account has no chats. The list then renders no rows and no
  empty-state message, and the palette shows `No chats found.`. Create a bot first
  for every recipe that needs a row, or sign in as a second account that owns no
  chats to drive `sidebar-empty`.
