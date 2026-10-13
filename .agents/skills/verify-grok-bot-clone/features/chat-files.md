# Chat file tools

A chat turn can read and write a file on the bot's computer. `writeFile` writes
text to a path in the sandbox, creating the file or replacing it, and `readFile`
returns what is there. Both run inside the Trigger task, where the SDK's own file
transfer cannot resolve `form-data` and `busboy` from the bundle, so both go
through the sandbox shell instead ([MAR-184](https://linear.app/marcos-portales/issue/MAR-184/make-readfile-and-writefile-work-inside-a-trigger-task)).
Each call renders a card in the thread: `Write <path>` holds the text and the
byte count, `Read <path>` holds the contents.

## Sub-features

- `chat-files-write` a turn writes a file, and the card reads `Write <path>` with
  the text, `Wrote <n> bytes.`, and a `Completed` header.
- `chat-files-read` a turn reads that file back, and the card reads
  `Read <path>` with the contents and `Completed`.
- `chat-files-parent` writing a path whose directory does not exist creates the
  directory, which is what the SDK's upload did.
- `chat-files-path` a path with a space and a quote in its name round trips,
  because the tool single-quotes it for the shell.
- `chat-files-empty` an empty file reads as empty contents, not an error. In the
  thread the card renders no code block at all, because the body draws only when
  the contents are truthy.
- `chat-files-binary` a file with a NUL byte reads as `That file is not text.`
  instead of contents.
- `chat-files-too-large` a file one byte above 512,000 bytes reads as
  `That file is too large to read.`, while one exactly at 512,000 bytes is read
  and clipped to 64,000 characters.
- `chat-files-missing` a path that is not there, or a directory, reports an error
  rather than throwing the turn.

## How to get to it (user POV)

- Ask the bot in a chat to write a file and then read it back.

## Driving it with control-grok

Preconditions:

- An owned instance is healthy: `$CG doctor` reports `doctor: healthy`.
- A signed-in session on the paid plan, because the composer refuses a free one
  ([Billing](./billing.md)). The chat's bot needs a `sandbox_id`, which bot
  creation gives it.
- `DAYTONA_API_KEY` and `TRIGGER_SECRET_KEY` for the probe half, and a running
  `trigger dev` worker: the tools only exist inside a task.
- Baseline state: the chat open at `/chats/<id>`.
- `ART=$($CG artifacts)` is the artifact directory for this run.

- **The round trip.** Run
  `$CG click --role textbox --name "What would you like to know?"`, then
  `$CG type "Call the writeFile tool, not bash, to write 'readFile and writeFile work' to /tmp/mar-184-proof/hello.txt. Wait for its result, then call readFile, not bash, on the same path. Reply with exactly what readFile returned."`,
  then `$CG click --role button --name "Submit"`. Wait for the thread to settle
  and read it with `$CG eval "document.querySelector('[role=log]').innerText"`.
  It holds `Write <path>`, `Completed`, `readFile and writeFile work`,
  `Wrote 27 bytes.`, then `Read <path>`, `Completed`,
  `readFile and writeFile work`. Neither card is an error. `<path>` is the string
  the model passed to the tool, echoed by the card and clipped to 80 characters
  (`chat-tool.tsx`), so the model may send `/tmp/mar-184-proof/hello.txt` or
  `tmp/mar-184-proof/hello.txt`: assert on the file name and the contents, never on
  the leading slash.
- **Visual proof.** Run
  `$CG screenshot "$ART/chat-files.png" --hide "nextjs-portal,next-route-announcer"`
  with the two cards in view.
- **The policy the composer cannot reach.** Run
  `node scripts/sandbox-fs-probe.ts`. It creates its own sandbox, runs
  `readSandboxFile` and `writeSandboxFile`, which are the two functions the tools
  call, inside the `fs-probe` task through the dev worker, and prints ten checks.
  All ten pass: a written file reads back byte for byte, the write reports its
  byte count, a path with a space and a quote round trips, an empty file reads as
  empty, a file exactly at the cap is read and clipped, a file one byte past the
  cap is refused, a binary file is refused, a directory reports an error, a
  missing file reports an error naming the path, and a write creates a missing
  parent directory. The script prints two blocks carrying the same field names: a
  `local (node_modules, no bundle)` control whose `sdkUpload` and `sdkDownload`
  succeed because it runs outside the task, and the `worker` result whose copies
  fail with `Cannot find module 'form-data'` and `Cannot find module 'busboy'`,
  which is the reason the tools do not use them. Read the worker block.
- **A turn that asks for one tool.** Read the cards, not the answer: the model
  writes the file with `bash` when the request allows it, and then the round trip
  proves the shell rather than the tool.

## Gotchas

- The tools are only reachable from inside a task, so `pnpm typecheck`,
  `pnpm lint`, and `pnpm build` all pass while both are broken at runtime. The
  probe is the only local check that sees them.
- `readSandboxFile` checks the size before it reads, so an oversized file is
  never transferred. The order against the binary check therefore differs from
  the SDK's: a file that is both oversized and binary reads as too large.
- The binary check is a NUL byte after decoding, so a file that is merely invalid
  UTF-8 still comes back as text with replacement characters.
- `writeFile` single-quotes the path for the shell, so a name with a space or a
  quote round trips, and the probe checks that one does. `pathOf` still rejects a
  NUL byte, which is the one thing the shell cannot carry.
- Two tool calls in one step run concurrently, so a turn that writes and reads in
  the same step can read before the write lands. The model's own retry hides it,
  and the order of the cards in the thread is the order the model asked in, not
  the order the sandbox saw.
- The turn's answer is the model's paraphrase. Only the card's contents are the
  file's bytes.
- The write tool caps its input before any shell runs: a path over 500 characters or
  content over 100,000 characters is refused by its schema and renders an error
  card (`trigger/computer.ts`).
- A turn stops after 15 model steps (`trigger/chat.ts`), which a round trip that
  writes, reads, and then answers can spend.
