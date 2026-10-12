# Not-found pages

Two 404 surfaces carry one frame: a face, a heading, one line of copy, and a
single `Back to chats` action to `/`. `app/not-found.tsx` answers an unmatched
URL and renders outside the dashboard group, so nothing is around it.
`app/(dashboard)/not-found.tsx` answers any `notFound()` raised inside the group,
so a chat link that matches no chat renders it with the sidebar and the reader's
own chats still listed. Both build `components/not-found.tsx` and differ in copy
only, and both answer `404`. The chat link that reaches the second one is
[Chat page](./chat-page.md), whose `chat-missing` case lands here.

## Sub-features

- `nopage-unmatched` an unmatched URL renders `Page not found` with no sidebar
  around it.
- `nopage-missing-chat` a chat id the reader does not own renders `Chat not
  found` inside the sidebar, with the reader's chats still listed.
- `nopage-status` both pages answer `404`, not a `200` carrying an apology.
- `nopage-one-action` each offers exactly one link, `Back to chats`, to `/`.
  Neither offers `Create a new bot`, because the reader either has a bot already
  or is not signed in.
- `nopage-fixed-face` the face above the heading comes from a fixed seed, so it
  is the same on every request and in both variants.
- `nopage-narrow` both hold at a 320px viewport with no horizontal scroll.

## How to get to it (user POV)

- Type a path the app does not have, such as `/no-such-page`.
- Follow a chat link whose chat was deleted.
- Follow a chat link that belongs to another account, signed in as the reader who
  does not own it.
- The unmatched page needs no session. The chat page does.

## Driving it with control-grok

Preconditions:

- An owned instance is healthy: `$CG doctor` reports `doctor: healthy`.
- For `nopage-missing-chat`, a signed-in session and a chat id owned by the
  other verification account. See the [README](./README.md#the-second-account).
- Baseline state: `$CG open /`.
- `ART=$($CG artifacts)` is the artifact directory for this run.

- **The unmatched status.** Run `curl -si <app-url>/no-such-page | head -1`. It
  prints `HTTP/1.1 404 Not Found`. Signed out the same line is a `404` too, which
  is what makes this page usable for a visitor who never signed in.
- **The unmatched page.** Run `$CG open /no-such-page`, then
  `$CG snapshot "$ART/unmatched.aria.txt" --hide "nextjs-portal,next-route-announcer"`.
  The tree holds `heading "Page not found" level=1`, one `generic` whose name is
  the copy, and `link "Back to chats"`, and holds no `button "New"`, no
  `button "Search"`, and no chat `list`: the shell is not around this page.
- **The missing chat.** Sign in as the account that owns chats, then run
  `$CG open /chats/<id owned by the other account>` and
  `$CG snapshot "$ART/missing-chat.aria.txt" --hide "nextjs-portal,next-route-announcer"`.
  The same three nodes are in the tree under the heading `Chat not found`, and
  above them stand the sidebar's `button "New"`, `button "Search"`, and one
  `link "<bot name> <age> <preview>"` per chat the signed-in account owns.
- **The missing chat's status.** The document response is `404`. Read it in the
  browser with a `Network.responseReceived` listener while holding the session,
  or from the shell once a session cookie exists: a signed-out
  `curl -i <app-url>/chats/<id>` is a `307` to `/sign-in?redirect_url=...`
  instead, because the page gates on Clerk before it reads the id.
- **One action.** Run
  `$CG eval "document.querySelectorAll('[data-slot=empty-content] a').length"` on
  each page. It prints `1`. Run `$CG click --role link --name "Back to chats"` and
  then `$CG eval "location.pathname"`, which prints `"/"`.
- **The fixed face.** Run
  `$CG eval "document.querySelector('[data-slot=empty-header] img').src"`, then
  `$CG open /no-such-page`, read it again, open the other variant, and read it
  again. The three values are one string, and so is the read after a reload.
- **Narrow.** Set the viewport to 320px with
  `Emulation.setDeviceMetricsOverride` and read
  `document.documentElement.scrollWidth === document.documentElement.clientWidth`.
  It is `true` on both pages, in both themes, with the `empty` block measuring
  `272` wide inside a `320` viewport and nothing crossing the right edge. The
  driver has no viewport command, so this one needs a CDP call of your own.
- **Visual proof.** Run
  `$CG screenshot "$ART/unmatched-light.png" --hide "nextjs-portal,next-route-announcer"`
  for each page, and `$CG press d` between frames for the dark pair.

## Gotchas

- The chat variant is behind Clerk. Signed out, a request for `/chats/<id>`
  redirects to the sign-in route and never renders the page, so `nopage-missing-chat`
  cannot be driven from a signed-out run.
- A chat id owned by another account and a chat id that never existed render the
  same page with the same status. The reader can not tell them apart, which is
  the point.
- The description block is a `div` with no role, and the driver's snapshot skips
  unnamed `generic` nodes, so the block carries the copy as its own `aria-label`.
  Strip that label and the snapshot loses the description while the visible text
  stays. The same reason applies to `EmptyDescription` anywhere else: on the home
  page the copy is absent from the tree and has to be read with `$CG text`.
- There is no `paragraph` in either tree. The description is a `generic`.
- `EmptyTitle` renders a `div`, and these two pages give it `role="heading"` and
  `aria-level={1}` so the page has one heading. The home page's title carries no
  such role, so a snapshot of `/` has no heading at all.
- The closed search palette's `heading "Search chats"` is in the dashboard
  variant's tree. It is not this page. See [Sidebar](./sidebar.md#gotchas).
- The unmatched page renders outside the dashboard group. A snapshot of it that
  holds a sidebar is measuring a different path, and so is a run whose
  `location.pathname` is a chat URL.
- The dashboard variant's tree holds more than one link, because the sidebar's
  chat rows are links. The "one link" in `nopage-one-action` is the page's own
  action, and the only link inside `[data-slot=empty-content]`.
- Below 768px the shell turns the sidebar into an off-canvas sheet, and the shell
  renders no control that opens it, so a 320px run proves the page and its copy
  and not the chat list beside it. The page itself is unaffected: `scrollWidth`
  equals `clientWidth` at 320.
- The face is a pure function of a fixed seed, so two runs always match. Assert
  that the seed does not change, never that it draws a particular face.
- Copy is sentence case with no exclamation marks, and neither variant offers
  `Create a new bot`. A run that finds that button here is on `/`.
