# Bots

The one flow a signed-in user can complete today is creating a bot. The
`Create a new bot` button on the root page opens a `New bot` dialog that collects a
face, a name, and a job, validates them in the browser, and on submit asks the
`createBot` server action to insert a row for the signed-in user. Success replaces
the dialog with a toast named after the bot. The page that hosts the trigger is
[Home page](./home-page.md). Nothing lists the bots yet, so the new row is read back
from the database rather than from the screen.

## Sub-features

- `bots-open` clicking `Create a new bot` on `/` opens a dialog named `New bot`.
- `bots-presets` the `Job presets` group holds four buttons, and clicking one fills
  the `Job` field with that preset.
- `bots-shuffle` clicking `Shuffle` replaces the face with a new seed.
- `bots-validate` submitting with `Name` or `Job` empty keeps the dialog open and
  prints an inline error under each empty field. Nothing is sent.
- `bots-create` a valid submit inserts one row for the signed-in user, closes the
  dialog, and shows a success toast `<name> is ready`.

## How to get to it (user POV)

- Sign in, open `/`, and click `Create a new bot`.
- Fill or ignore the presets, shuffle the face, type a name and a job, and click
  `Create bot`.

## Driving it with control-grok

Preconditions:

- An owned instance is healthy: `$CG doctor` reports `doctor: healthy`.
- A signed-in session:
  `GROK_VERIFY_EMAIL=... GROK_VERIFY_PASSWORD=... $CG signin`. The trigger lives on a
  page this same session is required for, and the action reads the user from it.
- `DATABASE_URL` in `.env.local` points at a reachable database. Without one the
  action returns its error result instead of inserting.
- Baseline state: `$CG open /`.
- `ART=$($CG artifacts)` is the artifact directory for this run.

- **Open the dialog.** Run
  `$CG click --role button --name "Create a new bot"`, then
  `$CG snapshot "$ART/bots-dialog.aria.txt" --hide "nextjs-portal,next-route-announcer"`.
  The tree gains `dialog "New bot"` holding `heading "New bot" level=2`, the group
  `Job presets` with `button "Research assistant"`, `button "Code reviewer"`,
  `button "Writing editor"`, `button "Tutor"`, then `button "Shuffle"`, textboxes
  `Name`, `Job`, and `How it should work`, and the buttons `Cancel`, `Create bot`,
  and `Close`.
- **Presets.** Run `$CG click --role button --name "Tutor"`, then
  `$CG eval "document.querySelector('#bot-job').value"`. It prints `"Tutor"`.
- **Validation first, with both fields empty.** Run
  `$CG click --role button --name "Create bot"`, then
  `$CG text '[role=dialog]'`. The output contains `Give your bot a name.` and
  `Give your bot a job.`, and a snapshot shows two `alert` nodes inside the dialog.
  The dialog is still open, so no request was sent.
- **Type the name.** Run `$CG click --role textbox --name "Name"`, then
  `$CG type "Ada"`, then `$CG eval "document.querySelector('#bot-name').value"`. It
  prints `"Ada"`. Use `type`, not repeated `press`: `press` refuses punctuation.
- **Shuffle the face.** Run `$CG eval "document.querySelector('[role=dialog] img').src"`
  before and after `$CG click --role button --name "Shuffle"`. The two values differ.
- **Submit.** Run `$CG click --role button --name "Create bot"`, then `sleep 4`. The
  form dialog is gone, checked with
  `$CG eval "!!document.querySelector('#create-bot-form')"` printing `false`, and the
  `Notifications` region holds a toast headed `Ada is ready` with the line
  `Give it something to work on whenever you like.` Capture it with
  `$CG snapshot "$ART/bots-created.aria.txt" --hide "nextjs-portal,next-route-announcer"`.
- **Read the row back.** The screen only shows a toast, so query the database for a
  second view of what the action wrote:

  ```bash
  node -e '
  const fs=require("fs");
  const env=Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["\x27]|["\x27]$/g,"")]}));
  process.env.DATABASE_URL=env.DATABASE_URL;
  const {Client}=require("pg");
  (async()=>{const c=new Client({connectionString:env.DATABASE_URL});await c.connect();
  const r=await c.query("select user_id, name, job, avatar, instructions from bots order by created_at desc limit 1");
  console.log(JSON.stringify(r.rows[0]));await c.end()})()'
  ```

  It prints the row with the signed-in `user_id`, `"name":"Ada"`, `"job":"Tutor"`,
  a non-empty `avatar` seed, and `"instructions":null` because that field was left
  blank.
- **Visual proof.** Run
  `$CG screenshot "$ART/bots-dialog.png" --hide "nextjs-portal,next-route-announcer"`
  while the dialog is open.

## Gotchas

- The field accessible names are `Name`, `Job`, and `How it should work`. `Ada` and
  `Research assistant` are placeholders, not names, so a click by those strings
  fails.
- Job presets are `button`, not `radio` or `Checkbox`, even though they sit in the
  `Job presets` group.
- The success toast is itself a `dialog`, named after the bot. After a submit,
  `document.querySelector('[role=dialog]')` matches the toast, so check
  `#create-bot-form` to decide whether the form is still open.
- Validation is entirely client-side, so a blocked submit sends no request and
  writes no row.
- The database is the only place a created bot is visible. No route lists bots yet,
  so a screenshot cannot prove the insert; use the row query above.
- The action takes `userId` from the Clerk session and re-validates the payload, so
  the client cannot choose the owner.
- Blank `instructions` is stored as `null`, not as an empty string.
- `press` handles one letter, one digit, or a named key. Text goes through `type`.
- The same test account can be signed in twice, so the oldest `bots` rows may come
  from an earlier run. Read the newest row, or filter by the id the toast names.
