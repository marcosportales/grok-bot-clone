# Auth

Signed out, the header carries two controls. Clicking `Sign in` opens the Clerk
sign-in form as a modal over the current page, and `/sign-in` and `/sign-up` render
the same forms as full pages. Reaching the signed-in header, where the controls
become an account menu, needs a real account, so that state is out of reach for
this harness.

## Sub-features

- `auth-header` signed out, the header shows the controls `Sign in` and `Sign up`.
- `auth-modal` clicking `Sign in` opens the sign-in dialog over the current page
  without changing the URL.
- `auth-signin-route` `/sign-in` renders the sign-in form in the page body.
- `auth-signup-route` `/sign-up` renders the sign-up form with an email field, a
  password field, and a show-password control.
- `auth-form-switch` the link at the foot of either form switches to the other
  form. On a page route it navigates; inside the modal it swaps the form in place.
- `auth-signed-in` signing in replaces the header controls with the account menu.
  Unreachable without a real account; see Gotchas.

## How to get to it (user POV)

- Click `Sign in` in the header. The sign-in form opens as a modal.
- Click `Sign up` in the header. The sign-up form opens as a modal.
- Open `/sign-in` or `/sign-up` directly. The same forms render as pages.
- Complete a sign-in with a real Clerk account to reach the account menu.

## Driving it with control-grok

Preconditions:

- An owned instance is healthy: `$CG doctor` reports `doctor: healthy`.
- Baseline state: `$CG open /`.
- `ART=$($CG artifacts)` is the artifact directory for this run.
- `clerk-js` fetches from the network on first render, so allow a moment after a
  click or navigation before snapshotting.

- **Header controls.** Run
  `$CG snapshot "$ART/auth-header.aria.txt" --hide "nextjs-portal,next-route-announcer"`.
  The `banner` contains `button "Sign in"` and `button "Sign up"`.
- **Modal opens.** Run `$CG click --role button --name "Sign in"`, then `sleep 3`,
  then
  `$CG snapshot "$ART/auth-signin-modal.aria.txt" --hide "nextjs-portal,next-route-announcer"`.
  The tree contains a `dialog` holding `heading "Sign in to grok-bot-clone" level=1`,
  `button "Continue with Google"`, `textbox "Email address" required=true`, and
  `button "Continue"`.
- **Modal keeps the page.** Run `$CG eval "location.pathname"`. It prints `"/"`.
- **Modal closes.** Run `$CG click --role button --name "Close modal"`, then
  `$CG snapshot`. The `dialog` is gone and `button "Button"` from the root page is
  back.
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
- **Form switch inside the modal.** From `/`, click `Sign in`, wait, then run
  `$CG click --role link --name "Sign up"`. The path stays `"/"` and the dialog's
  heading becomes `Create your account`. Clicking `link "Sign in"` inside that
  dialog brings the heading back to `Sign in to grok-bot-clone`.

## Gotchas

- Clerk renders the modal into a dialog and hides the rest of the page from the
  accessibility tree. While it is open, `heading "Project ready!"` and
  `button "Button"` are absent. Close the modal before asserting on the root page.
- The header keeps showing `Sign in` and `Sign up` on `/sign-in` and `/sign-up`.
  Those are the header's controls, and the form's own submit button is named
  `Continue`. Assert on the page's `level=1` heading to tell the two routes apart.
- The `dialog` carries no accessible name, so target it by role alone rather than
  as `dialog "..."`. Assert on the heading inside it instead.
- `Sign in` and `Sign up` each name both a header `button` and a form `link`. Use
  `--role button` for the header control and `--role link` for the form's switch.
- Modal sign-in does not change the URL, so `location.pathname` stays `/`. Only the
  `/sign-in` and `/sign-up` routes move it, and the form's own link moves it only
  where that form renders as a page.
- A snapshot taken immediately after the click shows no `dialog`, because the
  Clerk bundle is still loading. That is a timing artifact, not a product bug; wait
  before snapshotting.
- `auth-signed-in` needs a real account. The harness holds no credentials, so
  report it as unreachable with that prerequisite rather than inferring the
  signed-in tree from the signed-out one. The same applies to the email-code
  verification step, the sign-up CAPTCHA, and completing Google sign-in.
- Clerk development keys log a warning and a telemetry notice to the console.
  Both are expected in dev and are not failures.
