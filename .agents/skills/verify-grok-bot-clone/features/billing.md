# Billing gate and pricing page

Bots and their sandboxes are the billable capabilities. A signed-in user on the
free plan can create nothing and run nothing: bot creation, the chat composer,
and the desktop panel each refuse with an error toast whose `See plans` action
lands on `/pricing`, which renders Clerk's pricing table and opens checkout.
A user on the paid `pro` plan uses all of it, and a user who stops paying keeps
their history and can still delete what they own.

## Sub-features

- `billing-create-blocked` a free user who submits the bot dialog gets no bot and
  no sandbox, and an error toast whose action reaches `/pricing`.
- `billing-composer-blocked` a free user with an existing bot gets an error toast
  when sending a message, and nothing is sent.
- `billing-screen-blocked` a free user who opens the desktop panel gets an error
  toast in place of the screen, and the panel shows `No screen`.
- `billing-pricing-page` `/pricing` renders the `Plans` heading, the free plan
  marked `Active`, and the paid plan with a `Subscribe` control.
- `billing-checkout` `Subscribe` opens the checkout drawer, and paying with the
  development test card activates the paid plan.
- `billing-paid-allowed` on the paid plan, a bot is created with a sandbox, the
  composer answers, and the desktop panel shows the screen.
- `billing-delete-allowed` a free user can still delete a bot they own.
- `billing-toast-above-modal` the upgrade toast's action is hit-testable while the
  bot dialog is open.

## How to get to it (user POV)

- Sign in on the free plan, open `/`, click `Create a new bot`, fill the form, and
  click `Create bot`.
- On the paid plan, do the same and the bot is created.
- Signed in with a bot, open its chat at `/chats/<id>`, type in the composer, and
  click `Submit`.
- Signed in with a bot, open its chat and click `Toggle Desktop`.
- Click `See plans` on any upgrade toast.
- Open `/pricing` directly. Nothing in the sidebar links to it.

## Driving it with control-grok

Preconditions:

- An owned instance is healthy: `$CG doctor` reports `doctor: healthy`.
- A signed-in session. Two dev-instance accounts exist for the two directions,
  `grok-maintain-verify@example.com` and `grok-foreign-verify@example.com`. Set
  `GROK_VERIFY_EMAIL` and `GROK_VERIFY_PASSWORD` and run `$CG signin`. The two
  recipe sets below need opposite accounts, so sign out between them.
- `ART=$($CG artifacts)` is the artifact directory for this run.
- The account's plan decides which set applies. Confirm it with
  `clerk api users/<user_id>/billing/subscription` and read the item whose status
  is `active`. No active `pro` item means the account is on `free_user`.
- The screen and composer recipes need a chat whose bot has a sandbox id. A free
  account cannot create one, so provision a bot row for it out of band before
  driving that recipe, or run the paid recipes first and read the chat id back.

Free plan, everything blocked:

- **Bot creation.** `$CG open /`, then
  `$CG click --role button --name "Create a new bot"`. Focus `[id=new-bot-name]`
  with `$CG click` then `$CG type "Gate Test"`, then `[id=new-bot-job]` with
  `$CG type "Billing probe"`. Click
  `$CG click --role button --name "Create bot"`. Read
  `$CG text "[data-slot=toast]"`: the title is `This needs the Pro plan`, the
  description is `Bots are part of the Pro plan.`, and the action is
  `See plans`. Query the `bots` count before and after; it must not change.
- **The action is reachable.** With the dialog still open, read
  `document.elementFromPoint` at the action's centre. It must resolve to the
  action button, not to `[data-slot=dialog-overlay]`. Then
  `$CG click --role button --name "See plans"` and check
  `$CG eval "location.pathname"` reads `"/pricing"`.
- **Composer.** Open the chat, then
  `$CG click --role textbox --name "What would you like to know?"`,
  `$CG type "Does this send while free?"`, and
  `$CG click --role button --name "Submit"`. The toast title is
  `This needs the Pro plan` and its description is `Bots are part of the Pro plan.`,
  and `$CG text "[role=log]"` still reads `Send a message`, which is the empty
  state. The composer takes the same two rules the action does, so a spent
  allowance on a paid account gives the same shape with a different sentence. See
  [Usage](./usage.md).
- **Desktop panel.** `$CG click --role button --name "Toggle Desktop"`. The toast
  description is `Sandboxes are part of the Pro plan.`, the panel shows
  `No screen` with that same line, and
  `document.querySelector('iframe')` is `null`.
- **Delete still works.** Open the bot's dialog from the chat header, click
  `Delete`, confirm in `Delete <name>?`, and read the success toast
  `<name> is deleted`.
- **Visual proof.** `$CG screenshot "$ART/free-upgrade-toast.png" --hide
  "nextjs-portal,next-route-announcer"`.

Paid plan, everything allowed:

- **The page.** `$CG open /pricing` and `$CG text`. Stdout contains `Plans`,
  `Bots and their computers are part of the Pro plan.`, `Free`, `Active`, `Pro`,
  and `Subscribe`.
- **Checkout.** `$CG click --role button --name "Subscribe"`, then
  `$CG click --role button --name "Pay with test card"`, then
  `$CG click --role button --name "Continue"`. The plan card reads `Active`,
  `location.pathname` is `/`, and the `bots` row exists with
  `sandbox_id is not null`.
- **Sandbox connection.** Open the chat and
  `$CG click --role button --name "Toggle Desktop"`. After the sandbox starts,
  `document.querySelector('iframe')` exists and its `src` starts with the
  Daytona signed preview host. No upgrade toast appears.
- **Bot usage.** Send a message and read `$CG text "[role=log]"`. The assistant
  answer appears. For sandbox usage, ask it to run a shell command and confirm
  the tool row `bash` reads `Completed` with real output.

## Gotchas

- `has()` is evaluated from the session token's `fea` claim, so a feature only
  reaches the server when it is created with `include_in_jwt: true`. A paying
  user with a feature flagged otherwise denies everywhere, with no error.
- The upgrade toast viewport is `z-[100]` on purpose. Dialog, alert-dialog, sheet,
  and drawer all use `z-50`, and a toast portal sits earlier in the DOM than
  theirs, so at equal z-index the modal paints over the card and the `See plans`
  action is present but unhittable. A dialog stays open when a create is refused,
  which is exactly when this toast fires. Lowering that value breaks the only
  route to `/pricing` and nothing else in the app notices.
- The toast dismisses itself after ten seconds. It is deliberately not
  persistent, because a toast raised before a successful checkout used to
  outlive the upgrade and keep claiming the plan was missing. Click the action
  promptly in a driver, or re-trigger the refusal.
- Cancelling a subscription on the development instance only schedules the
  cancel. The `pro` item stays `active` with a `canceled_at` and a future
  `period_end`, and a `free_user` item appears with status `upcoming`, so
  cancelling does not produce a free account today.
- Clerk's development gateway renders the checkout drawer in `Development mode`
  with a `Pay with test card` button and `Visa ... 4242`. An annual plan is
  charged as one period, so the drawer reads `$240.00` rather than `$20`.
- The pricing page is intentionally absent from the sidebar, which lists chats
  and not routes. A sidebar snapshot will never show it, and its only in-app
  entry point is the toast action.
- `Pro` and `Bots` each appear in more than one place on `/pricing`, in the plan
  name and in copy. Assert with `$CG text` on the body rather than on a specific
  element when the point is that the page rendered.
- The desktop panel only opens on a direct chat. A group chat renders its
  `Toggle Desktop` control disabled, so a recipe driven from a group measures
  nothing.
- A free user cannot reach the composer or the panel without a bot they already
  own, which only a downgraded user has. Provision the second account's bot row
  out of band and say so in the run report, rather than reporting the recipe as
  unreachable.
- `createBot` refuses before `createSandbox()` runs, so the blocked path leaves
  no Daytona sandbox behind. Prove it by reading the `bots` count, not by
  watching for an error.
