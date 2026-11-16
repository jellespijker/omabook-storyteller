# The plugin's JavaScript

Storyteller runs in Omabook's script engine (`omabook plugin api` has the whole
API). Its rules are not style: code that breaks them doesn't run, or runs
somewhere it shouldn't. Enforced by `rules/js/*.yml` on the lines a change adds.

## The script language

- **No `async`/`await`, modules or timers.** Slow things are promises chained
  with `.then`; files are joined with `omabook.include`; later work is
  `omabook.after`. (`no-async-await`, `no-modules`, `no-timers`)
- **Every call returns within five seconds** of its own running time (waiting
  for the model doesn't count): nothing loops over anything big.
- **Running the top level changes nothing.** Omabook loads a script more than
  once; effects happen in a command, an event or a function.
- **The world only through `omabook`**: the network through `omabook.http`,
  files through `omabook.files`, never `fetch` or `XMLHttpRequest`
  (`no-host-network`). Never `eval` or `new Function`, least of all on what a
  model wrote (`no-eval`).

## The plugin's design

- **The model only through `Ai`** (`lib/ai.js`), which checks every answer.
  `omabook.ai.available()` may be asked anywhere. (`ai-through-ai`)
- **Every word sent to the model is in `Prompts`** (`lib/prompts.js`), so all of
  them can be read in one place. (`prompts-in-prompts`, a warning)
- **Originality is a rule, not a hope**: every name a story invents goes
  through `Originality`; nothing may reuse the people, places or plots of
  existing books.
- **Errors are `Error`s whose message the reader can act on**:
  `throw new Error("Open one of Storyteller's stories first.")`. Omabook shows
  the message; a thrown string loses where it came from. (`no-throw-literal`)

## Style

- `===` and `!==`, never `==` and `!=`. (`no-loose-equality`)
- `const` for what doesn't change, `let` for what does; `var` only for the one
  global a part makes.
- Comments say *why*, in the voice of the existing code.
