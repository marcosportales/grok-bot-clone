# Auth

Signed out, the header carries two controls. Clicking `Sign in` opens the Clerk
sign-in form as a modal over the current page, and `/sign-in` and `/sign-up` render
the same forms as full pages. Signed in, the two controls become one account
control that opens an account panel. The root page is itself behind Clerk, so a
signed-out visitor to `/` never sees these controls there. The signed-in state
needs a dev-instance test account, which the harness provisions and can sign in
with, so it is reachable.

## Sub-features

- `auth-gate` signed out, a request for `/` redirects to the sign-in route with a
  `redirect_url` back to `/`, so `/` shows no header at all in that state.
- `auth-header` signed out, the header shows the controls `Sign in` and `Sign up`.
- `auth-modal` clicking `Sign in` opens the sign-in dialog over the current page
  without changing the URL.
- `auth-signin-route` `/sign-in` renders the sign-in form in the page body.
- `auth-signup-route` `/sign-up` renders the sign-up form with an email field, a
  password field, and a show-password control.
- `auth-form-switch` the link at the foot of either form switches to the other
  form. On a page route it navigates; inside the modal it swaps the form in place.
- `auth-signed-in` signing in replaces the header controls with the account
  control `Open user menu`, which opens a panel holding `Manage account` and
  `Sign out`.
- `auth-signed-in-redirect` signed in, `/sign-in` and `/sign-up` both redirect
  back to `/`.

## How to get to it (user POV)

- Click `Sign in` in the header. The sign-in form opens as a modal.
- Click `Sign up` in the header. The sign-up form opens as a modal.
- Open `/` signed out, and follow the redirect to the sign-in route.
- Open `/sign-in` or `/sign-up` directly. The same forms render as pages.
- Sign in with the harness test account to reach the account control.

## Driving it with control-grok

Preconditions:

- An owned instance is healthy: `$CG doctor` reports `doctor: healthy`.
- Baseline state: `$CG open /sign-in`. Signed out, `/` redirects here anyway, and
  the auth routes are only reachable signed out; see Gotchas.
- `ART=$($CG artifacts)` is the artifact directory for this run.
- `clerk-js` fetches from the network on first render, so allow a moment after a
  click or navigation before snapshotting.
- The signed-in recipes need `GROK_VERIFY_EMAIL=... GROK_VERIFY_PASSWORD=... $CG signin`.

- **The gate.** Run `$CG open /` and `$CG eval "location.pathname + location.search"`.
  It prints `"/sign-in?redirect_url=http%3A%2F%2Flocalhost%3A3000%2F"`.
- **Header controls.** With the page on `/sign-in`, run
  `$CG snapshot "$ART/auth-header.aria.txt" --hide "nextjs-portal,next-route-announcer"`.
  The `banner` contains `button "Sign in"` and `button "Sign up"`.
- **Modal opens.** Run `$CG click --role button --name "Sign in"`, then `sleep 3`,
  then
  `$CG snapshot "$ART/auth-signin-modal.aria.txt" --hide "nextjs-portal,next-route-announcer"`.
  The tree contains a `dialog` holding `heading "Sign in to grok-bot-clone" level=1`,
  `button "Close modal"`, `button "Continue with Google"`, a required textbox, and
  `button "Continue"`.
- **Modal keeps the page.** Run `$CG eval "location.pathname"`. It prints
  `"/sign-in"`, the route the modal was opened from.
- **Modal closes.** Run `$CG click --role button --name "Close modal"`, then
  `$CG snapshot`. The `dialog` is gone and the page's own sign-in form is back,
  under `heading "Sign in to grok-bot-clone" level=1` inside `main`.
- **Sign-in route.** Run `$CG open /sign-in` and `$CG eval "location.pathname"`.
  The path is `"/sign-in"` and the tree holds the same form inside `main` rather
  than in a `dialog`, under `heading "Sign in to grok-bot-clone" level=1`.
- **Sign-up route.** Run `$CG open /sign-up` and `$CG eval "location.pathname"`.
  The path is `"/sign-up"` and the tree holds
  `heading "Create your account" level=1`, `textbox "Email address" required=true`,
  `textbox "Password" required=true`, and `button "Show password"`.
- **Visual proof.** Run
  `$CG screenshot "$ART/auth-signin-page.png" --hide "nextjs-portal,next-route-announcer"`
  on `/sign-in` and `$CG screenshot "$ART/auth-signup-page.png" --hide "nextjs-portal,next-route-announcer"`
  on `/sign-up`.
- **Form switch on a page route.** On `/sign-in`, run
  `$CG click --role link --name "Sign up"`. Then `$CG eval "location.pathname"`
  prints `"/sign-up"`.
- **Form switch inside the modal.** With the page on `/sign-in`, click `Sign in`,
  wait, then run `$CG click --role link --name "Sign up"`. The path stays
  `"/sign-in"` and the dialog's heading becomes `Create your account`. Clicking
  `link "Sign in"` inside that dialog brings the heading back to
  `Sign in to grok-bot-clone`.
- **Signed in.** Run `$CG signin`, then `$CG open /` and
  `$CG eval "location.pathname"`. It prints `"/"`, the `banner` holds
  `button "Open user menu"` and no `Sign in`.
- **Account panel.** Run `$CG click --role button --name "Open user menu"`, then
  `sleep 2`, then
  `$CG snapshot "$ART/auth-user-menu.aria.txt" --hide "nextjs-portal,next-route-announcer"`.
  The tree holds `dialog "Account panel"` with `button "Manage account"` and
  `button "Sign out"`.
- **Signed-in redirect.** Still signed in, run `$CG open /sign-in` and
  `$CG eval "location.pathname"`. It prints `"/"`.

## Gotchas

- Clerk renders the modal into a dialog and hides the rest of the page from the
  accessibility tree. While it is open only the dialog's own contents are
  reachable, so close it before asserting on the page behind it.
- The sign-in field has two different accessible names. In the page route the
  label wins and the field is `textbox "Email address" required=true`; inside the
  modal it is named by a hint string, read live as
  `textbox "Example format: name@example.com" required=true`. `--role textbox`
  alone would be ambiguous, because the page behind the modal keeps its own field.
- The header keeps showing `Sign in` and `Sign up` on `/sign-in` and `/sign-up`.
  Those are the header's controls, and the form's own submit button is named
  `Continue`. Assert on the page's `level=1` heading to tell the two routes apart.
- The Clerk `dialog` carries no accessible name, so target it by role alone rather
  than as `dialog "..."`. Assert on the heading inside it instead. The bot dialog
  and the Clerk account panel do carry names, so they can be targeted as
  `dialog "New bot"` and `dialog "Account panel"`.
- `Sign in` and `Sign up` each name both a header `button` and a form `link`. Use
  `--role button` for the header control and `--role link` for the form's switch.
- Modal sign-in does not change the URL, so `location.pathname` stays on whichever
  route the modal was opened from. That page is never `/` while signed out,
  because `/` redirects. Only the page routes move the path, and the form's own
  link moves it only where that form renders as a page.
- A snapshot taken immediately after the click shows no `dialog`, because the
  Clerk bundle is still loading. That is a timing artifact, not a product bug; wait
  before snapshotting.
- `auth-signed-in` needs a dev-instance test account. The harness provisions one
  and `$CG signin` drives the real form, so this state is reachable without human
  credentials. Provisioning and the two environment variables are in the README.
- The email-code verification step, the sign-up CAPTCHA, and completing Google
  sign-in still need human credentials or an inbox, and stay unreachable.
- Signed in, the auth routes bounce to `/`. Sign out from the account panel, or
  clear the session, before driving the signed-out recipes.
- Clerk development keys log a warning and a telemetry notice to the console.
  Both are expected in dev and are not failures.
