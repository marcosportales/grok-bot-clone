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
- `chat-files-binary` reading a file with a NUL byte returns `That file is not
text.` instead of contents.
- `chat-files-too-large` reading a file above 512,000 bytes returns
  `That file is too large to read.`
- `chat-files-missing` reading a path that is not there returns the shell's
  error rather than throwing the turn.

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
  It holds `Write /tmp/mar-184-proof/hello.txt`, `Completed`,
  `readFile and writeFile work`, `Wrote 27 bytes.`, then
  `Read /tmp/mar-184-proof/hello.txt`, `Completed`,
  `readFile and writeFile work`. Neither card is an error.
- **Visual proof.** Run
  `$CG screenshot "$ART/chat-files.png" --hide "nextjs-portal,next-route-announcer"`
  with the two cards in view.
- **The refusals and the rest of the policy.** Run
  `node scripts/sandbox-fs-probe.ts`. It creates its own sandbox, runs
  `readSandboxFile` and `writeSandboxFile` — the two functions the tools call —
  inside the `fs-probe` task through the dev worker, and prints the six checks.
  All six pass: a written file reads back byte for byte, the write reports its
  byte count, a binary file is refused, a file above the cap is refused, a
  missing file reports an error, and a write creates a missing parent directory.
  The `sdkUpload` and `sdkDownload` fields beside them still fail with
  `Cannot find module 'form-data'` and `Cannot find module 'busboy'`, which is
  the reason the tools do not use them.
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
- `writeFile` quotes the path for the shell, so a name with a space or a quote
  works. `pathOf` rejects a NUL byte, which is what the shell cannot carry.
- Two tool calls in one step run concurrently, so a turn that writes and reads in
  the same step can read before the write lands. The model's own retry hides it,
  and the order of the cards in the thread is the order the model asked in, not
  the order the sandbox saw.
- The turn's answer is the model's paraphrase. Only the card's contents are the
  file's bytes.
