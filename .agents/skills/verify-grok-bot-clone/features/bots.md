# Bot dialog

The bot dialog is one component in three modes. `Create a new bot` on the root page
and `New` then `Create new bot` in the sidebar both open it in create mode, where it
collects a face, a name, and a job, validates them in the browser, and on submit
writes the bot, its direct chat, and the row that links them. The same dialog in
edit mode opens from the chat header's title, and it edits the bot's own answers.
Edit mode also carries the delete path, behind a confirmation. Each mode reports
its outcome with a toast. A created chat shows up in the sidebar list; the dialog
itself is the only place the bot's answers are edited.

## Sub-features

- `bots-open` the `Create a new bot` button on `/` opens a dialog named `New bot`.
- `bots-open-from-sidebar` the sidebar's `New` then `Create new bot` opens the same
  dialog.
- `bots-presets` the `Job presets` group holds four buttons, and clicking one fills
  the `Job` field with that preset.
- `bots-shuffle` clicking `Shuffle` replaces the face with a new seed.
- `bots-validate` submitting with `Name` or `Job` empty keeps the dialog open and
  prints an inline error under each empty field. Nothing is sent.
- `bots-create` a valid submit writes the bot, one direct chat for the signed-in
  user, and one `chat_members` row joining them, closes the dialog, and shows a
  success toast `<name> is ready`.
- `bots-edit-open` the chat header's title button opens a dialog named `Edit bot`
  with the bot's current answers filled in.
- `bots-edit` a valid submit saves the changed answers, closes the dialog, and
  shows a success toast `<name> is updated`. The sidebar row and the chat header
  show the new values.
- `bots-delete-cancel` the confirmation's `Keep it` closes the question and leaves
  the bot in place.
- `bots-delete` the confirmation's `Delete` removes the bot and its direct chat and
  shows a success toast `<name> is deleted`. On a chat page the reader lands on `/`.

## How to get to it (user POV)

- Sign in, open `/`, and click `Create a new bot`.
- Choose `New` in the sidebar, then `Create new bot`.
- In create mode, fill or ignore the presets, shuffle the face, type a name and a
  job, and click `Create bot`.
- Open a chat and click its name in the header to reach edit mode.
- In edit mode, change the answers and click `Save changes`, or click `Delete` and
  answer the confirmation.

## Driving it with control-grok

Preconditions:

- An owned instance is healthy: `$CG doctor` reports `doctor: healthy`.
- A signed-in session:
  `GROK_VERIFY_EMAIL=... GROK_VERIFY_PASSWORD=... $CG signin`. The triggers live on
  pages this same session is required for, and the actions read the user from it.
- `DATABASE_URL` in `.env.local` points at a reachable database. Without one the
  actions return their error result instead of writing.
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
- **The sidebar entry point.** With the dialog closed, run
  `$CG click --role button --name "New"`, then
  `$CG click --role menuitem --name "Create new bot"`, then
  `$CG eval "!!document.querySelector('#new-bot-form')"`. It prints `true`, the same
  form the root trigger opens.
- **Presets.** Run `$CG click --role button --name "Tutor"`, then
  `$CG eval "document.querySelector('#new-bot-job').value"`. It prints `"Tutor"`.
- **Validation first, with both fields empty.** Run
  `$CG click --role button --name "Create bot"`, then
  `$CG text '[role=dialog]'`. The output contains `Give your bot a name.` and
  `Give your bot a job.`, and a snapshot shows two `alert` nodes inside the dialog.
  The dialog is still open, so no request was sent.
- **Type the name.** Run `$CG click --role textbox --name "Name"`, then
  `$CG type "Ada"`, then `$CG eval "document.querySelector('#new-bot-name').value"`.
  It prints `"Ada"`. Use `type`, not repeated `press`: `press` refuses punctuation.
- **Shuffle the face.** Run
  `$CG eval "window.__face = document.querySelector('[role=dialog] img').src"`,
  then `$CG click --role button --name "Shuffle"`, then
  `$CG eval "document.querySelector('[role=dialog] img').src !== window.__face"`.
  It prints `true`. Compare the whole data URI, because two faces share a long
  prefix.
- **Submit.** Run `$CG click --role button --name "Create bot"`, then `sleep 4`. The
  form dialog is gone, checked with
  `$CG eval "!!document.querySelector('#new-bot-form')"` printing `false`, and the
  `Notifications` region holds a toast headed `Ada is ready` with the line
  `Give it something to work on whenever you like.` Capture it with
  `$CG snapshot "$ART/bots-created.aria.txt" --hide "nextjs-portal,next-route-announcer"`.
- **Read the rows back.** The screen only shows a toast, so query the database for a
  second view of what the action wrote. The join below returns the newest bot with
  the chat it belongs to and the membership row that joins them:

  ```bash
  node -e '
  const fs=require("fs");
  const env=Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["\x27]|["\x27]$/g,"")]}));
  const {Client}=require("pg");
  (async()=>{const c=new Client({connectionString:env.DATABASE_URL});await c.connect();
  const joined=await c.query("select b.id, b.user_id, b.name, b.job, b.avatar, b.instructions, c.id as chat_id, c.kind, c.user_id as chat_user_id, cm.bot_id as member_bot_id from bots b left join chat_members cm on cm.bot_id=b.id left join chats c on c.id=cm.chat_id order by b.created_at desc limit 1");
  console.log(JSON.stringify(joined.rows[0]));
  const orphans=await c.query("select (select count(*) from bots b where not exists (select 1 from chat_members cm where cm.bot_id=b.id)) as bots_without_member, (select count(*) from chats c where not exists (select 1 from chat_members cm where cm.chat_id=c.id)) as chats_without_member");
  console.log(JSON.stringify(orphans.rows[0]));await c.end()})()'
  ```

  It prints the row with the signed-in `user_id`, `"name":"Ada"`, `"job":"Tutor"`,
  a non-empty `avatar` seed, `"instructions":null` because that field was left
  blank, one `chat_id` whose `kind` is `direct` and whose `chat_user_id` matches the
  bot's `user_id`, and a `member_bot_id` equal to the bot's id. The second line reads
  `{"bots_without_member":"0","chats_without_member":"0"}`, so no bot was left
  without a conversation. Keep the printed `id` and `chat_id` for the edit and
  delete recipes below.
- **Open edit mode.** Run `$CG open /chats/<chat_id>`, then
  `$CG click --role button --name "Ada"`, then
  `$CG eval "({ form: !!document.querySelector('#edit-bot-form'), name: document.querySelector('#edit-bot-name').value, job: document.querySelector('#edit-bot-job').value })"`.
  It prints `true`, `"Ada"`, and the job, so the dialog holds the bot's own answers.
  A snapshot shows `dialog "Edit bot"` with `Save changes` and `Delete`.
- **Save the edit.** Focus a field and append text with
  `$CG click --role textbox --name "Job"` then `$CG type " Lead"`, then run
  `$CG click --role button --name "Save changes"` and `sleep 4`. A toast reads
  `Ada is updated` with the line
  `The new name and face are what you will see from now on.`, and the sidebar row
  now reads `<name> now <new job>`. Read the row back:

  ```bash
  BOT_ID='<id>' node -e '
  const fs=require("fs");
  const env=Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["\x27]|["\x27]$/g,"")]}));
  const {Client}=require("pg");
  (async()=>{const c=new Client({connectionString:env.DATABASE_URL});await c.connect();
  const r=await c.query("select id, name, job from bots where id=$1",[process.env.BOT_ID]);
  console.log(JSON.stringify(r.rows[0]));await c.end()})()'
  ```

  The row's `job` carries the new value.
- **Delete, and back out once.** Reopen edit mode, run
  `$CG click --role button --name "Delete"`, then `sleep 1`. A snapshot shows
  `alertdialog "Delete Ada?"`, the line `Its chat goes with it. This cannot be
  undone.`, and the buttons `Keep it` and `Delete`. Run
  `$CG click --role button --name "Keep it"`, then
  `$CG eval "!!document.querySelector('#edit-bot-form')"`. It prints `true`, so the
  bot is still there and the form is back.
- **Delete for real.** Run `$CG click --role button --name "Delete"`, then
  `$CG click --role button --name "Delete"`, then `sleep 4`. A toast reads
  `Ada is deleted` with the line `Its chat is gone from the sidebar.` The path is
  `/`, and a sidebar read shows no row named `Ada`. Read the rows back:

  ```bash
  BOT_ID='<id>' CHAT_ID='<chat_id>' node -e '
  const fs=require("fs");
  const env=Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["\x27]|["\x27]$/g,"")]}));
  const {Client}=require("pg");
  (async()=>{const c=new Client({connectionString:env.DATABASE_URL});await c.connect();
  const r=await c.query("select (select count(*) from bots where id=$1) as bot_left, (select count(*) from chats where id=$2) as chat_left, (select count(*) from chat_members where bot_id=$1) as member_left",[process.env.BOT_ID,process.env.CHAT_ID]);
  console.log(JSON.stringify(r.rows[0]));await c.end()})()'
  ```

  All three counts are `"0"`, so the bot, its direct chat, and the membership row
  are gone.
- **Visual proof.** Run
  `$CG screenshot "$ART/bots-dialog.png" --hide "nextjs-portal,next-route-announcer"`
  while the create dialog is open.

## Gotchas

- The field accessible names are `Name`, `Job`, and `How it should work`. `Ada` and
  `Research assistant` are placeholders, not names, so a click by those strings
  fails.
- The element ids name the mode: create uses `new-bot-form`, `new-bot-name`,
  `new-bot-job`, and `new-bot-instructions`; edit uses the same with an `edit-bot`
  prefix. A recipe that reads `#bot-job` or `#create-bot-form` is stale.
- Job presets are `button`, not `radio` or `Checkbox`, even though they sit in the
  `Job presets` group.
- The success toast is itself a `dialog`, named after the bot. After a submit,
  `document.querySelector('[role=dialog]')` matches the toast, so check
  `#new-bot-form` or `#edit-bot-form` to decide whether the form is still open.
- A page can hold two bot dialogs at once, the sidebar's create dialog and a chat
  header's edit dialog. The mode-specific ids are what tell them apart.
- The confirmation is its own `alertdialog`, and it hides the edit form behind it.
  So `--role button --name "Delete"` reaches the confirmation's button while the
  question is open, and the form's own `Delete` while it is not.
- Deleting removes the direct chat with the bot. Any other chat that had the bot as
  one of several members stays.
- Validation is entirely client-side, so a blocked submit sends no request and
  writes no row.
- The database is the only place the full answer set is visible after a create. The
  sidebar row shows the name and the job, not the instructions. Use the join above.
- The action takes `userId` from the Clerk session and re-validates the payload, so
  the client cannot choose the owner or edit a bot it does not own.
- Blank `instructions` is stored as `null`, not as an empty string.
- `press` handles one letter, one digit, a named key, or a modifier chord. Text goes
  through `type`, and `type` appends at the caret.
- The same test account can be signed in twice, so the oldest `bots` rows may come
  from an earlier run. Read the newest row, or filter by the id the toast names.
- Delete the row a run created once the run is done. Leftover bots keep showing up
  as sidebar rows in later runs.
