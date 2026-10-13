# Usage page

The `/usage` route shows what this account has spent in the current UTC month.
One card per meter gives the amount used against its allowance and a bar filled
with that ratio, which turns red once there is nothing left, and the page closes
with the day the window resets. The account panel's `Usage` item is the only
in-app way in.

## Sub-features

- `usage-entry` the account panel's `Usage` item opens `/usage`.
- `usage-meters` the page shows one card per meter, in the order `AI tokens`,
  `Sandbox time`, `Bots`.
- `usage-amounts` a card whose meter has an allowance reads
  `<used> of <limit> used`, with both amounts grouped.
- `usage-fill` a card's bar is filled with the used share of that meter's
  allowance and stops at the end of the track.
- `usage-spent` a meter at or past its allowance fills in the destructive colour
  and states the message the refusal gives.
- `usage-free` an account whose plan lacks the capability reads
  `Part of the Pro plan` and shows an empty bar rather than `0 of 0`.
- `usage-overshoot` a meter past its allowance keeps the true numbers while the
  bar stays full.
- `usage-window` the page names the month and, when the account holds any
  allowance, the reset day in UTC with the whole days left.
- `usage-window-free` an account holding no allowance reads
  `Every meter here is part of the Pro plan.` instead of a reset day, because
  nothing resets for it.

## How to get to it (user POV)

- Sign in, choose `Open user menu` in the sidebar footer, then `Usage`.
- Signed in, open `/usage` directly. Nothing in the sidebar links to it.

## Driving it with control-grok

Preconditions:

- An owned instance is healthy: `$CG doctor` reports `doctor: healthy`.
- A signed-in session. Set `GROK_VERIFY_EMAIL` and `GROK_VERIFY_PASSWORD`, run
  `$CG signin`, and confirm `$CG eval "location.pathname"` reads `"/"`.
- `ART=$($CG artifacts)` is the artifact directory for this run.
- The account's plan decides which set applies. Confirm it with
  `clerk api users/<user_id>/billing/subscription` and read the item whose status
  is `active`. No active `pro` item means every meter reads `Part of the Pro plan`.
- `usage-spent` and `usage-overshoot` need a meter at or past its allowance. Only
  `Bots` is reachable by hand, by owning three. Provision the other two with
  `usage_events` rows out of band and say so in the run report.

The entry:

- **From the account panel.** Run
  `$CG click --role button --name "Open user menu"`, then `sleep 2`, then
  `$CG click --role button --name "Usage"`, then `$CG eval "location.pathname"`.
  It prints `"/usage"`.
- **Direct.** Run `$CG open /usage` and `$CG text "h1"`. Stdout contains `Usage`.

The meters, on an account whose plan carries the capabilities:

- **One card per meter, in order.** Run
  `$CG eval "[...document.querySelectorAll('[data-slot=card-title]')].map((t) => t.innerText)"`.
  It prints `["AI tokens","Sandbox time","Bots"]`.
- **The amounts.** Run
  `$CG eval "[...document.querySelectorAll('[data-slot=card-description]')].map((d) => d.innerText)"`.
  It prints three entries shaped `<used> of <limit> used`, one per meter, each
  amount grouped with commas.
- **The fill.** Run
  `$CG eval "[...document.querySelectorAll('[data-slot=progress-indicator]')].map((i) => i.style.width)"`.
  It prints three percentages, in the same order as the cards, each the used share
  of that meter's allowance and never above `100%`.
- **The window.** Run
  `$CG eval "[...document.querySelectorAll('p')].map((p) => p.innerText).find((t) => t.startsWith('What this account'))"`.
  It prints `What this account has used in <Month YYYY>.` Then run
  `$CG eval "[...document.querySelectorAll('p')].map((p) => p.innerText).find((t) => t.startsWith('Limits reset'))"`.
  It prints
  `Limits reset on <Month D, YYYY>. <N> days left in this window.`, reading `day`
  instead of `days` on the last UTC day of the month. The day of the month is always
  `1`, and the month is the one after the month the header names.
- **Visual proof.** Run
  `$CG screenshot "$ART/usage-page.png" --hide "nextjs-portal,next-route-announcer"`
  and `$CG snapshot "$ART/usage-page.aria.txt" --hide "nextjs-portal,next-route-announcer"`.

A spent meter, with three owned bots on the paid plan:

- **The numbers.** The `Bots` card reads `3 of 3 used`.
- **The message.** Run `$CG text`. Stdout contains
  `You have reached your limit of 3 bots.`
- **The distinct look.** Run
  `$CG eval "[...document.querySelectorAll('[data-slot=progress-indicator]')].map((i) => getComputedStyle(i).backgroundColor)"`.
  The entry for `Bots` is a colour no other card uses while it is the only meter at
  its limit; two spent meters share the destructive colour. The same read of
  `i.style.width` is `100%` for it.

An account on the free plan:

- **Every meter is gated.** Run
  `$CG eval "[...document.querySelectorAll('[data-slot=card-description]')].map((d) => d.innerText)"`.
  It prints `["Part of the Pro plan","Part of the Pro plan","Part of the Pro plan"]`,
  and the indicator widths are `0%` three times. `$CG text` contains no `0 of 0`.
- **No reset promise.** Run `$CG text`. Stdout contains
  `Every meter here is part of the Pro plan.` and does not contain `Limits reset`,
  because a zero allowance never comes back.

An overshoot, provisioned out of band:

- **The numbers stay true.** Sum more than the allowance into `usage_events` for
  the account and the current period, then run `$CG open /usage`. The card names
  the real amount, for example `1,200,000 of 1,000,000 used`, while that meter's
  indicator width is still `100%`.

## Gotchas

- The bar's `aria-valuenow` is the fill percentage, not an amount. Read the amounts
  from `[data-slot=card-description]`, and read `aria-valuenow` only to prove the
  fill is a number. Each progress root also carries its meter's name as an
  `aria-label`, so a snapshot shows `progressbar "AI tokens"`,
  `progressbar "Sandbox time"`, and `progressbar "Bots"`.
- A free account has an allowance of zero on every meter. Its cards carry no
  numbers at all, so a run that wants to see `of <limit> used` needs a paid
  account. Reporting the free cards as a broken amount is a misread.
- `used` can pass `limit`: a chat turn is metered after it runs, and sandbox minutes
  accrue from creating, touching, and deleting a bot with a cap per window
  (`lib/usage/sandbox.ts`), so that meter moves with no chat activity at all. A card
  can read `1,200,000 of 1,000,000 used` while its bar is pinned at the track's end.
  That is `usage-overshoot`, not a rendering fault.
- A spent card repeats the sentence the refusal uses, so the same line appears on
  the page and in a toast raised from a chat. Match it with `$CG text`, not with a
  card-scoped selector.
- 1,000,000 AI tokens and 600 sandbox minutes are out of reach by driving the UI.
  Use three owned bots for `usage-spent`, and say in the run report that the other
  two were provisioned.
- The account panel item navigates through Clerk's router and the panel closes on
  the click. Read the path after `sleep 2`, not in the same command.
- The month is UTC, so the reset day is the first day of the next UTC month even
  while the workstation's own date has not turned over. Compare against a UTC
  computation rather than the local calendar.
- The allowance is read from the session token's `fea` claim, the same source as
  the plan gate, so a paying account whose features are not in the token reads
  `Part of the Pro plan` everywhere. See
  [Billing](./billing.md#gotchas).
- `/usage` is absent from the sidebar, which lists chats and not routes. A sidebar
  snapshot proves nothing about this page, and the account panel is its only
  in-app entry.
- `$CG text` on this page returns a bare `x` once per meter. It is base-ui's own
  screen-reader element inside the progress root, one pixel square and clipped
  with `clip-path: inset(50%)`, so it is invisible. Filter `^x$` out of a text
  assertion rather than reporting a stray character.
- The `Bots` meter is a cap on what is held, not a monthly amount, so its refusal
  offers `Delete a bot to free a slot.` where the other two offer a reset. Waiting
  a month never frees a bot slot.
- Every dashboard page's accessibility tree carries a stray
  `heading "Search chats"` from the closed command palette, `/usage` included. See
  [Sidebar](./sidebar.md#gotchas).
