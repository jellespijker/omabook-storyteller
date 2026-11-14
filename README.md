# Storyteller

A plugin for Omabook, the ebook library and reader for Omarchy. It does two jobs:

- **It writes you a book.** Say what you are in the mood for, and it builds a world, invents its people, plans a plot with twists that are seeded before they pay off, and writes chapter one. The next chapter is written while you read the one before it. You can steer the story, ask its author questions, and later go back and branch it into another book.
- **It is a worked example of an Omabook plugin.** It uses nearly everything a script plugin can do (a book format, commands with keys, a panel, reader events, the knowledge graph, the AI, files, settings) in small files with comments that say why. If you want to write a plugin, start by reading `main.js`.

Everything it writes is original by rule: it may not reuse the characters, places or plots of existing books and authors. See [The originality rule](#the-originality-rule) for how that is enforced and where the enforcement ends.

## Install

```bash
omabook plugin install /path/to/omabook-storyteller --name storyteller   # a folder or a .zip; it is checked first
omabook plugins enable folder:storyteller                                # it is off until you say so
```

Or press `P` in Omabook, `I` to install, and `Space` to switch it on. It needs an AI set up in Omabook's settings (`,`); whatever you chose there writes the stories.

### What it asks to be allowed

| Permission | Why |
|---|---|
| `files` | To keep its stories and unfinished work under its own `data/` folder, and to add the books it writes to the library (a plugin's book starts as a file it wrote). |

Nothing else: no network (`http`) and no programs (`run`). The model is reached through Omabook's own `omabook.ai.ask`, which needs no permission and uses the AI you set up.

## Using it

| Where | Key | What |
|---|---|---|
| Library | `Ctrl+Shift+W` | **Write me a story.** Asks what you are in the mood for; leave it empty to be surprised. A few minutes later the book opens. |
| Reader | `Ctrl+Shift+S` | **Steer the story**: "more of the smuggler", "kill nobody", "slower", "follow the sister". |
| Reader | `Ctrl+Shift+A` | **Ask the author** about the story so far. No spoilers unless you ask for them in so many words ("spoil me: …"). |
| Reader | `Ctrl+Shift+N` | **Write the next chapter now**, without waiting to be near the end. Also tries again after a problem. |
| Reader | `Ctrl+Shift+B` | **Branch the story from here**: a new book with the chapters up to the one you are in, which then goes another way. |
| Anywhere | `Ctrl+Shift+E` | **Write a sequel** in the world of a story that has ended. |

The keys can be changed in Omabook's `keys.json` like any other (`?` shows them). The panel beside the page shows how the story stands ("Writing chapter 4…"), has a field to steer and one to ask, the branch and sequel buttons, and a list of what you know of the world so far.

A story is an ordinary book in the library. Contents, search, bookmarks, the reading companion (`A`), catch-up and who-is-who all work on it, because Omabook reads it through the format this plugin registers.

Steering, continuing and branching are for Storyteller's own books only. For any other book the commands say so and do nothing, the functions refuse, and Omabook itself refuses to let a plugin rewrite a book it did not make. A book by a person stays as its author wrote it.

## How it works

### The story file

A story is one file with the extension `.story`, JSON inside. The plugin keeps the master copy in `data/stories/<id>.story`; the library holds a copy, made with `omabook.library.create` and renewed with `omabook.library.replaceFile` each time a chapter is added.

```text
{
  "format": "omabook-story", "version": 1, "id": "smb1x2k3a",
  "title", "author", "language", "created", "updated",
  "premise":  {"wish", "logline", "genre", "tone", "voice", "blurb"},
  "world":    {"seen": "world:<id>", "plan": "world:<id>:plan"},        the two graphs, below
  "lineage":  null | {"kind": "fork" | "sequel", "story", "title", "chapter", "difference", "recap"},
  "plan":     {"chapters": 12, "beats": [{"chapter", "title", "pov", "goal", "events", "seeds", "turn"}]},
  "chapters": [{"number", "title", "text" (Markdown), "written", "summary", "record", "renames", "recorded"}],
  "steering": [{"at", "chapter", "text", "planned", "applied"}],
  "asked":    [{"at", "chapter", "question", "answer", "spoilers"}],
  "revealed": 3, "reached": 4, "ended": false,
  "cost":     {"calls", "sent", "received"}
}
```

The format (`lib/storyfile.js`) hands Omabook the chapters and nothing else, so the plan and the logs never reach the reader, search or the AI companion. The plan is in the file as plain JSON, though: someone who opens the `.story` file in an editor can read ahead.

### The world is two graphs

Omabook's knowledge graph has scopes: `""` is the general graph of everything you have read, and any other name is a graph of its own. Each story keeps two:

- **`world:<id>:plan`, the author's.** Places, peoples and factions, the rules of the world (magic, technology, economy, religion, law) with what they cost, history with what really happened, and the people with their wants, needs, fears, secrets, contradictions and hidden ties. The plot is in it as nodes too: threads, promises made to the reader, twists (with the seeds to plant, the chapters to plant them in, the chapter they pay off in, and whether that has happened yet) and the endings the story is steering toward. This is what the model is shown.
- **`world:<id>`, the reader's.** Only what the chapters you have read have shown, in words that give nothing else away. This is what the panel lists, and what is safe to browse: `omabook graph show --scope world:<id>`.

Why two scopes rather than one graph with a "spoiler" flag: a flag hides nothing unless every viewer honours it, and the graph view, `omabook graph`, the MCP tools and the exports know nothing of this plugin's flags. A scope is a boundary all of them already keep. A fact crosses from the plan to the reader's graph in one place only (`World.reveal`), once you are past the middle of the chapter that shows it. Spoiler-bearing plan nodes carry `data.spoiler: true` as well, for tools that want to look.

Both graphs grow as the story does. After each chapter the model is asked what the chapter established; things it invented on the way join the author's graph, the ledger of seeds and promises is brought up to date, and the reader's graph gets its share when you get there. That growing world is what a sequel or a branch starts from.

The general graph is read, never written: it is where the taste profile and the forbidden names come from.

### Taste, not content

Before a world is built, `lib/taste.js` reads what you have read and how you rated it, and writes a few lines of abstractions: the kinds of book you rate highly and the kinds you don't, the themes that run through them, real-world subjects you like meeting, the kinds of invented system you enjoyed (described, never named), the kinds of thing you ask about. Every name the library knows is taken out before the model sees it. `omabook plugin run storyteller taste` prints exactly what would be sent.

### The originality rule

A story may not reuse the characters, places, named things, plots or distinctive inventions of existing books and authors, nor imitate a named author's voice. It is enforced twice.

1. **In words.** Every request to the model states the rule in full (`Prompts.ORIGINALITY` in `lib/prompts.js`), and says it outranks everything else, your own wishes included: ask for "something like" a famous school and you get a school with secrets, invented from the ground up.
2. **Mechanically.** `lib/originality.js` collects the names of every character, place, group, item, series, book and author in the general graph, with their other names; the titles, authors and series of the library's books; a short built-in list of names too famous to leave to chance; and whatever you add. A world, a plan or a chapter that uses one is sent back to the model for new names, and checked again. After two tries it is refused: a chapter that still collides is not published, and the panel says which names were the trouble.

You can add to both sides:

```bash
omabook plugin run storyteller forbid '["Zorvath"]'      # never use this name
omabook plugin run storyteller allow '["Rose"]'          # let this one through, though a book of mine has a Rose
omabook plugin run storyteller forbiddenNames            # everything that is forbidden now, and where each comes from
omabook plugin run storyteller checkOriginality '["They sailed for Harrowgate at dawn."]'
```

**What this does not catch.** It catches names, and only names it knows. A plot borrowed under new names, a scene, a magic system renamed, a voice: no list of words can see those, and they rest on the rule in the prompt and on the model keeping it. A name from a book you never added to your library is unknown to it unless it is one of the sixty on the built-in list. And it errs both ways with ordinary words: a single-word name counts only when it is written with a capital in the middle of a sentence, so a character called Hope is seldom mistaken for hope, but a name used only at the start of sentences would slip through, and a name that is also a common word ("River", "King") is let go altogether.

### When the next chapter is written

On every page turn in one of its books (`page.turned`, which Omabook sends a moment after you stop), the plugin looks at where you are. It writes the next chapter when you are in the last chapter there is, at least 35% of the way through it (`write_at`), and nothing is being written already.

- Not at the start of the chapter: every story abandoned after a page would have cost a chapter nobody reads, and a wish to steer would always arrive one chapter too late.
- Not at the end: a chapter takes a minute or two to write, about what the rest of a chapter takes to read, and a quick reader should find it waiting.
- Never more than one chapter ahead of you, unless you ask (`Ctrl+Shift+N`).

With `write_ahead` off, chapters are written only when you ask.

A story ends. Its plan has a last chapter; when that is written the chapter is told to land the ending, the book says "The end", and nothing more is written. From there you can ask for a sequel, which is a new book in a copy of the same world (everything established stays true, the old plot becomes history, new people arrive), or branch from any earlier chapter.

### Steering and asking

What you ask for is kept in the story's log. Before the next chapter is written the plan is revised to honour it (one extra request), and every later chapter is reminded of it, so "kill nobody" holds to the end. If the next chapter was already written ahead and you have not opened it, it is thrown away and written again; if it is being written at that moment, your wish shapes the one after.

A question to the author is answered from what you have read and nothing more: the earlier chapters as summaries, the chapter you are in up to your place, and your own graph. The plan is not in the request, so it cannot leak. Ask for spoilers in so many words ("spoil me", "with spoilers", or the box in the panel) and the plan is sent along.

### Branching

"Branch the story from here" makes a new book: the chapters up to the one you are in, a copy of both graphs with everything later taken back out, the plan revised for the way you said it should differ, and the first chapter of the new road. Its lineage (which story, which chapter, what you asked for) is in its file and its description. The original is untouched, and the two go on independently.

### When things go wrong

- **Every answer is checked** (`lib/ai.js`). Prose must be prose of some length and not a refusal; JSON must parse and have the shape asked for. A bad answer is asked for once more, with the reason; after that the problem is reported and nothing is changed.
- **The story file is never half written.** A chapter joins the story only when it is complete and checked; the file is written whole (to a temporary file, then renamed) before the library's copy is replaced.
- **Nothing important is in memory.** Work in progress is a small file, `data/jobs/<id>.json`, that holds every result so far. If Omabook quits or crashes mid-chapter, the work is picked up at the stage it was in the next time you turn a page in that book, and at most the one request that was cut off is made again. A story that was still being started is picked up by "Write me a story".
- **A failure is not retried by itself.** It is tried again when you ask (`Ctrl+Shift+N`, or "Try again" in the panel), so a model that keeps failing does not keep costing.
- **A lost working copy comes back.** If `data/` is gone (a new computer, a synced library), opening the book restores the master copy from the library's.

## What it costs

Every request goes to the AI you set up in Omabook, on your subscription or key. The plugin makes them only when you start something or read on, and their number is fixed:

| What | Requests | Roughly sent | Roughly received |
|---|---|---|---|
| A new story (world, cast, plot) | 3 | 1,500 + 2,500 + 4,500 tokens | 1,500 + 2,000 + 2,500 tokens |
| Each chapter (the chapter, then what it established) | 2 | 5,000 to 8,000 + 4,500 to 6,500 tokens | 1.4 × the chapter's words + 700 tokens |
| A chapter after you steered (the plan revised first) | +1 | 5,500 tokens | 1,200 tokens |
| A question to the author | 1 | 1,500 to 4,000 tokens (6,000 with spoilers) | 200 tokens |
| A branch | 3 | as a steered chapter | |
| A sequel | 3 | 6,000 tokens for its plan, then a chapter | 2,500 tokens, then a chapter |
| A draft that used a taken name | +1 or +2 | 400 tokens each | 100 tokens each |
| An answer that could not be used | +1 | the same request again | |

So a twelve-chapter book at the default 1,200 words a chapter is about 27 requests and some 190,000 tokens in all, most of it sent. The numbers are for chapters of 1,200 words; they were measured in the trials described in this repository's history and scale with `chapter_words`.

A chapter's request does not grow with the book. The model is sent the plan and the world (cut at 24,000 characters), one short summary per chapter (older ones shorter), and the last 2,500 characters of the previous chapter: not the book.

What each story has actually used is in its file, under `cost` (requests, and characters sent and received), and in `omabook plugin run storyteller stories`.

Reading a story also feeds Omabook's own knowledge graph if you have that set to grow as you read, like any book; that is Omabook's setting and its cost, not this plugin's.

## Settings

```bash
omabook plugin run storyteller settings                                   # show them
omabook plugin run storyteller settings '[{"chapter_words": 800, "write_ahead": false}]'
```

| Setting | Default | |
|---|---|---|
| `chapter_words` | 1200 | About how long a chapter is. The biggest lever on cost. |
| `chapters` | 12 | How many chapters a new story is planned to take. Steering may change it. |
| `write_ahead` | true | Write the next chapter by itself as you near the end of what there is. |
| `write_at` | 0.35 | How far into the last chapter (0 to 1) you must be before the next is started. |
| `language` | English | The language stories are written in. |
| `pen_name` | Storyteller | The author on the cover. |
| `forbidden_names`, `allowed_names` | none | Your own additions to the originality check. |
| `stale_seconds` | 30 | How long unfinished work may show no sign of life before it counts as interrupted. |

They are kept in `data/settings.json`, which can be edited by hand.

## How it is put together

```text
plugin.json           what it is, which script to run, the permission it asks for
main.js               the front door: includes the rest, registers the format, the panel and the
                      commands, listens to the reader, and defines the functions the command line
                      and the panel call. Read this first.
Panel.qml             the panel beside the page; draws one value the script hands it
lib/util.js           small helpers: ids, clipping, reading JSON out of an answer, whole-word matching
lib/config.js         the settings and their defaults
lib/storyfile.js      the .story file: its shape, reading and writing it, the book format, publishing
lib/prompts.js        every word sent to the model, one function per request
lib/ai.js             asking the model and checking the answer; one retry
lib/originality.js    the forbidden names: collecting them, finding them, having them renamed
lib/taste.js          what the reader likes, as abstractions with the names taken out
lib/world.js          the two graphs: laying a world in, reading it back as text, revealing, copying, cutting back
lib/jobs.js           work in progress on disk, so it survives a crash
lib/status.js         what the panel and the line at the bottom of the window say
lib/writer.js         the writing: a new story, a chapter, a branch, a sequel, as stages
lib/reading.js        page turns (when to write, what to reveal), steering, asking the author
tests/run.py          the tests: the whole life of a story, driven from the command line
tests/stub_ai.py      a stand-in for the model that answers canned text
data/                 made when the plugin runs: stories/, jobs/, settings.json (not in the repository)
```

Each file in `lib/` makes one global (`Util`, `Stories`, `World`, …) because a script plugin has no modules; `omabook.include` runs a file in the plugin's one engine, and `main.js` includes them in the order they build on each other.

## Trying it from the command line

Every top-level function in `main.js` can be run without the window, which is how to see what each part does. `plugin run` waits for promises, up to ten minutes, so a chapter can be written this way.

```bash
omabook plugin check storyteller                                   # loads it; errors come with file and line

omabook plugin run storyteller taste                               # what the model would be told of your taste
omabook plugin run storyteller startStory '["a heist that goes right for the wrong reasons"]'
                                                                   # -> {"book": 41, "story": "smb…", "title": …}
omabook plugin run storyteller stories                             # every story, its book, its state, what it cost
omabook plugin run storyteller world '[41]'                        # what the reader knows: the "seen" graph
omabook plugin run storyteller world '[41, "plan"]'                # the author's graph, spoilers and all
omabook plugin run storyteller nextChapter '[41]'                  # write the next chapter now
omabook plugin run storyteller steer '[41, "more of the locksmith, and nobody dies"]'
omabook plugin run storyteller askAuthor '[41, "why did she keep the key?"]'
omabook plugin run storyteller askAuthor '[41, "who is behind it?", true]'      # with spoilers
omabook plugin run storyteller branch '[41, "what if the vault had been empty?", 2]'   # from chapter 2
omabook plugin run storyteller sequel '[41, "the locksmith, ten years on"]'     # once the story has ended
omabook plugin run storyteller unfinished                          # what was cut off or failed, and why
omabook plugin run storyteller resume                              # pick it up
omabook plugin run storyteller abandon '["smb…"]'                  # or give it up

# What the reader does, as the window would report it:
omabook plugin run storyteller event:page.turned \
    '{"id": 41, "generated": "storyteller", "identifiers": {"storyteller": "smb…"}, "section": 0, "sections": 1, "fraction": 0.5}'
omabook plugin run storyteller command:story-branch '{"book": 12}' # a command; on someone else's book it refuses

omabook toc 41 ; omabook text 41 --section 0                       # the book, as any book
omabook graph show --scope world:smb…                              # the reader's graph, as any graph
```

`plugin run` reads a plugin's book format only from the default plugin folder (`~/.config/omabook/plugins`), so a `.story` book can't be made with `--folder` pointing somewhere else. To try the plugin without touching your own setup, point `XDG_CONFIG_HOME` at a scratch folder, put the plugin in `omabook/plugins/` under it, and pass `--library` a scratch library; `tests/run.py` does exactly that.

## Tests

```bash
python3 tests/run.py            # needs omabook on the PATH, or OMABOOK=/path/to/omabook
python3 tests/run.py --keep     # leave the scratch folder to look at
```

The tests need no window and no model. They make a scratch home, a scratch library with one ordinary book and a little graph, copy the plugin into a scratch plugin folder, set Omabook's AI to the command `tests/stub_ai.py`, and then drive `omabook plugin run` through the whole life of a story: a world built in its own scope, a collision with a library name rejected and renamed, chapter one, page turns that do and do not write chapter two, steering, asking the author with and without spoilers, a chapter interrupted and picked up, the end, a sequel, a branch with copied graphs and lineage, the refusals for a book by a person, answers that are no good, and a lost working copy restored.

The panel is not covered by them: it needs a window.

## Writing your own plugin, starting from this one

1. **Start small.** `omabook plugin new mine --template format` (or `command`, `hook`, `panel`, `metadata`, `catalog`) makes a plugin of twenty lines that does one thing. This plugin is those templates grown up: its format is `Stories.register` in `lib/storyfile.js`, its commands and hooks are in `main.js`, its panel is `Panel.qml` fed by `lib/status.js`.
2. **Read the reference once.** `omabook plugin api` prints the whole `omabook` object, the events and the permissions. It is generated from Omabook's code, so it is never out of date.
3. **Keep the loop tight.** Edit, `omabook plugin check mine`, `omabook plugin run mine someFunction '[arguments]'`. Make the things you want to try top-level functions; that is the only reason half the functions in `main.js` exist.
4. **Know the language.** JavaScript on Qt's engine: no `async`/`await` (chain `.then`), no modules (`omabook.include`), no `setTimeout` (`omabook.after`), no `fetch` (`omabook.http`). Also missing, as this plugin found: object rest (`{a, ...rest}`), `Array.prototype.flat`, `String.prototype.replaceAll`, `\p{…}` in regular expressions, and lookbehind that works.
5. **Five seconds.** Every call into the script has to come back within five seconds of its own running time. Waiting for a promise doesn't count, so do slow work in `.then` steps, one piece each (see `stage` in `lib/writer.js`).
6. **Keep state on disk.** The script can be loaded again at any time (you saved a file, Omabook restarted, the command line loaded a second copy to read your format). `omabook.settings` and files under `data/` survive; variables do not. Running the top level of your script should change nothing.
7. **Ask for little.** A permission is shown to whoever installs the plugin. This one needs `files` and nothing else.
8. **Things worth copying from here:** checking every AI answer before using it (`lib/ai.js`); a stand-in model for tests (`tests/stub_ai.py`); the panel finding its own plugin's values without knowing the folder's name (`Panel.qml`); refusing in one place to touch books that are not yours (`own` in `main.js`).

## Limits

- The panel's text is English only; a plugin has no translation catalog. Stories themselves are written in whatever `language` says.
- The panel sits beside every book, not only Storyteller's (a plugin can't show a panel for some books and not others). Beside other books it shows one line.
- Omabook's graph view can't be opened on a scope from a plugin, so "what you know so far" is a list in the panel, and the whole graph is a command away: `omabook graph show --scope world:<id>`.
- A branch opens at its first page; find the chapter where it parts ways in the contents (`T`). A plugin can't open a book at a place.
- The commands are listed among the reader's keys for every book, since a command can't be offered for some books only. On any other book they say why not.
- The originality check catches names, not ideas. See above.

## License

MIT. See [LICENSE](LICENSE).
