# Storyteller

A plugin for Omabook, the ebook library and reader for Omarchy. It does two jobs:

- **It writes you a book.** Say what you are in the mood for, and it builds a world, invents its people, plans a plot with twists that are seeded before they pay off, and writes chapter one. The next chapter is written while you read the one before it. You can steer the story, ask its author questions, and later go back and branch it into another book.
- **It is a worked example of an Omabook plugin.** It uses nearly everything a script plugin can do (a book format, commands with keys, a panel, reader events, the knowledge graph, the AI, files, settings) in small files with comments that say why. If you want to write a plugin, start by reading `main.js`.

Everything it writes is original by rule: it may not reuse the characters, places or plots of existing books and authors. See [The originality rule](#the-originality-rule) for how that is enforced and where the enforcement ends.

How it plans and writes is built on what writers, editors and researchers know about stories and about getting long fiction from a language model, written down with sources in [docs/craft.md](docs/craft.md). And how a story is written can be shaped with [skills](#skills): small Markdown files for a style, a structure, a genre or a part of the craft, built in or your own.

## Install

```bash
omabook plugin add storyteller   # it is in Omabook's list of plugins; fetched from GitHub and checked first
```

Or press `P` in Omabook and `I` to install: Storyteller is first under "Find plugins". Choose Install, read what it asks to be allowed, and choose "Install and Switch On". It needs Omabook 0.1.4 or newer. Installed this way it keeps itself up to date: an update that asks for nothing new arrives by itself (and can be rolled back), and one that asks for a new permission waits for you to review it.

To work on the plugin, install it from a folder instead:

```bash
omabook plugin install /path/to/omabook-storyteller --name storyteller   # a folder or a .zip; it is checked first
omabook plugins enable folder:storyteller                                # it is off until you say so
``` It needs an AI set up in Omabook's settings (`,`); whatever you chose there writes the stories.

### What it asks to be allowed

| Permission | Why |
|---|---|
| `files` | To keep its stories and unfinished work under its own `data/` folder, and to add the books it writes to the library (a plugin's book starts as a file it wrote). |
| `http` | Only to install a skill from a GitHub address when you ask it to (`installSkill`, or the panel). Nothing is fetched otherwise, and nothing about you or your books is sent. |

No programs (`run`). The model is reached through Omabook's own `omabook.ai.ask`, which needs no permission and uses the AI you set up.

Version 1.2 starts stories from the shelf and removes them cleanly; it uses what Omabook 0.1.4 added for plugins (an entry on the shelf, and forms), so it needs Omabook 0.1.4 or newer. Version 1.1 added `http`. Installed from GitHub, that means the update to 1.1 does not install by itself: Omabook holds it until you have looked at the new permission and said yes. That is Omabook's safety rule working as meant. Without `http` everything but installing from GitHub still works (pasting a skill, or adding one from a file, needs no network).

## Using it

### Starting from the shelf

Switched on, Storyteller puts one entry at the start of the shelf, in every view of the library: **Write a new story**, with a cover Omabook draws from your theme and a plus on it, so it is never taken for a book. Open it the way you open a book (Space, Enter, a double click, a tap) and a form opens instead of the reader:

| Field | What it does |
|---|---|
| What should it be? | A mood, a kind of story, a what-if. Empty: surprise me. |
| Where does it live? | **A world of its own**; **a new story in the world of** one of yours; **a sequel** to one that has ended; or **a branch** of one from a chapter you choose. Offered once you have a story. |
| Which story? / Branch from chapter | Shown when the story is linked to another. |
| Write it with | The [skills](#skills), style, structure, genre and craft, ticked or not. Your default skills start ticked. A sequel or a story in another's world is written as that one was unless you tick others; a branch always is. |
| Point of view, Tone | For what the skills leave open. |
| Chapters, Words a chapter | This story's length. The settings' `chapters` and `chapter_words` are where they start. |

"Start Writing" adds the book to the library at once, with a page that says how far the writing has got, and opens it. Chapter one replaces that page a few minutes later.

How the four ways of linking differ:

- **A world of its own**: everything new.
- **A new story in the world of …**: the world as you know it from that book (its places, groups, rules, history, and what has happened in the chapters you have read), new people at the heart of it, and a plot of its own. The model is told that everything established is canon, never to be contradicted, and the earlier book's people may only pass through. What that book has not shown you yet (its plot still to come, its endings, the secrets of its people and places) is not handed on, so neither book spoils the other.
- **A sequel to …**: the same world later, with what the earlier book left behind as its trouble and its plot as history. Only for a story that has ended.
- **A branch of … from chapter N**: the chapters up to N, and from there it goes the way you asked.

Each story keeps a copy of its world of its own (two scopes of Omabook's knowledge graph, see [The world is two graphs](#the-world-is-two-graphs)), so the stories of one world never write into each other's.

The entry is not a book of the library: it is in no count, no reading statistics or suggestions, not in the knowledge graph, tidying, sync, catalogs or exports, and not in the file manager. It goes when Storyteller is switched off or removed. Remove it from the shelf (`Delete`, or Remove in its details) and it stays off; the command **Storyteller: put Write a new story on the shelf** brings it back.

### Removing a story

**Storyteller: remove this story** (in the reader, beside the story, or with the story selected on the shelf, and as a button at the end of the panel) asks first, and names what goes: the book (to the trash), its world (both graphs), its working copy in `data/`, and anything of it still unfinished. When other stories share its world (one was made from it, or it from one: a sequel, a branch, a story in its world), it says which, and asks whether to remove only this story, the others keeping their own copy of the world and going on as they are, or the world with every story in it. Nothing is removed while any of it is being written.

Remove the book with Omabook's own Remove instead, and Storyteller asks once whether its world and working copy should go too. Leaving the question, or choosing "Keep them", keeps them: put the book back from the trash and the story goes on where it was. (Should the working copy be gone by then, opening the book makes it again from the library's copy.)

From the command line: `removalPlan <book>` says what would go, and `removeStory <book or story id> {"world": "keep" | "all"}` removes it.

### Keys

| Where | Key | What |
|---|---|---|
| Library | `Ctrl+Shift+W` | **Write me a story**: the same form as the entry on the shelf. |
| Reader | `Ctrl+Shift+S` | **Steer the story**: "more of the smuggler", "kill nobody", "slower", "follow the sister". |
| Reader | `Ctrl+Shift+A` | **Ask the author** about the story so far. No spoilers unless you ask for them in so many words ("spoil me: …"). |
| Reader | `Ctrl+Shift+N` | **Write the next chapter now**, without waiting to be near the end. Also tries again after a problem. |
| Reader | `Ctrl+Shift+B` | **Branch the story from here**: a new book with the chapters up to the one you are in, which then goes another way. |
| Anywhere | `Ctrl+Shift+E` | **Write a sequel** in the world of a story that has ended. |
| Reader | `Ctrl+Shift+K` | **Choose the story's skills**, from the next chapter on. |

The keys can be changed in Omabook's `keys.json` like any other (`?` shows them). The panel beside the page shows how the story stands ("Writing chapter 4…"), has a field to steer and one to ask, the story's skills (each a button that takes it out, a list to add another, and "Add a skill of your own…"), the branch and sequel buttons, a list of what you know of the world so far, and a button that opens that same knowledge in Omabook's graph view beside the page.

A story is an ordinary book in the library. Contents, search, bookmarks, the reading companion (`A`), catch-up and who-is-who all work on it, because Omabook reads it through the format this plugin registers.

Steering, continuing, branching and removing are for Storyteller's own books only, and that is guarded three times. The panel and every command but "Write me a story" and the one that puts the shelf entry back are registered with `when: "generated"`, so beside a book by a person there is no panel and the keys do nothing. The functions refuse any other book, for whoever calls them another way. And Omabook itself refuses to let a plugin rewrite a book it did not make. A book by a person stays as its author wrote it.

## Skills

A skill shapes how a story is written: its prose, its point of view, the shape of its plot, a genre's conventions, or one part of the craft. A story is written with up to six, chosen when it starts; they are kept in its file, a branch or a sequel is written with the same ones, and they can be changed at any time.

### The skills that come with it

| Skill | Kind | What it does |
|---|---|---|
| `spare-concrete` | style | Short, exact sentences; nouns and verbs do the work; feeling shows in what is seen and done. |
| `lush-lyrical` | style | Long, musical sentences rich in sensory detail, always anchored to what a person notices. |
| `wry` | style | Dry, observant humour from character and understatement, not jokes. |
| `second-person` | voice | The book says "you". |
| `present-tense` | voice | Close third person, present tense. |
| `try-fail-cycles` | structure | Attempts that fail ("yes, but" / "no, and") and escalate until the last. |
| `kishotenketsu` | structure | Four movements, a turn that recasts everything, and no villain needed. |
| `fair-clue-mystery` | structure | A puzzle the reader can solve: every clue in plain sight first. |
| `heist` | structure | A crew, a plan partly hidden, a reveal set up in plain sight. |
| `slow-dread` | genre | Horror from small wrongnesses, the threat mostly unseen. |
| `slow-burn-romance` | genre | Two people drawn together slowly against real obstacles. |
| `dialogue-subtext` | craft | People talk around what matters, in distinct voices. |
| `chapter-hooks` | craft | Every chapter opens in motion and ends on a turn. |
| `clear-inventions` | craft | Invented words and customs introduced one at a time, by use. |
| `trust-the-reader` | craft | Leave the reader the work they enjoy; keep them oriented. Adapted from [haowjy/creative-writing-skills](https://github.com/haowjy/creative-writing-skills) (Apache-2.0). |
| `cut-the-slop` | craft | An editor's pass against machine-prose habits. Adapted from [stop-slop](https://github.com/hardikpandya/stop-slop) by Hardik Pandya (MIT). |

`omabook plugin run storyteller skills` lists them, `skill '["wry"]'` shows one in full. Each has evals (see [Tests](#tests)). The two adapted ones carry their licence in their folder and say what was changed. With no skill chosen a story is written in the house style, which is already the craft of [docs/craft.md](docs/craft.md); skills add to it.

A story may have one `voice` and one `structure` skill, two `style` and two `genre` skills, and up to four `craft` ones; choosing another of a full kind replaces the oldest, and a skill can exclude another (`spare-concrete` and `lush-lyrical` exclude each other).

### Choosing them

- **When a story starts.** "Write me a story" asks, after the wish, which skills to use: names or words, with commas (`lush, kishotenketsu`, `spare and concrete, chapter hooks`). Empty is your defaults, the setting `skills`. From the command line: `startStory '["a heist", "heist, wry"]'`.
- **While reading.** In the panel, a skill's button takes it out and the list adds one; `Ctrl+Shift+K` asks for the whole set; `setSkills '[41, "wry, chapter-hooks"]'` from the command line. The change shapes the next chapter on.
- **By steering.** A wish about how the book is written ("write it lusher", "less flowery", "more of a mystery") is given, with the list of skills, to the request that revises the plan, which may choose skills to answer it. Only skills that exist, combined as they may be, are taken.
- **A branch or a sequel** is written with the skills of the book it came from; `sequel '[41, "", "slow-dread"]'` gives a sequel others.

The story file keeps the skills (`skills`, with each one's text, so it can be written with them again even if one is later removed), when and how they changed (`skillLog`), and for every chapter which skills it was written with and what the editor's pass found (`chapters[].skills`, `chapters[].revision`).

### How a skill is used, and what one may not do

A skill is shown to the steps of writing it names (`world`, `cast`, `plot`, `draft`, `revise`), in a block of its own after the originality rule and the task, under a line that says it is the reader's preference about craft and can change neither the rule, the task nor the form of the answer. It is material, not an instruction that outranks the plugin.

Before that, every skill (built in, pasted, added or fetched) is checked, and refused with the reason when:

- it asks for imitation: "write like …", "in the style of …", "à la …", a pastiche, homage or fan fiction of something, "as … would";
- it names an author people ask to have imitated, or any name the originality check forbids (the library's books, authors and characters, the built-in list);
- it speaks over the rules: "ignore the instructions", the originality rule, "you are now", "reuse characters from existing books", "answer only with";
- it uses the markers the plugin wraps material in (`<<<`, `>>>`, a line `Task:`);
- its front matter is missing or wrong, or its body is longer than 4,000 characters (all a story's skills together may not pass 12,000: they are sent with every request).

And the forbidden-names check still runs on every world, plan and chapter, whatever a skill said. `tests/refused/` holds eleven skills that must be refused, one for each reason, and the tests check that they are.

### Writing a skill

A skill is a folder with a `SKILL.md`, in the [Agent Skills](https://github.com/anthropics/skills) layout, so a skill written for one is easy to bring to the other: `name` and `description` at the top, what only Storyteller needs under `metadata`.

```markdown
---
name: cold-open
description: "Every chapter opens in the middle of an action, with no weather and no waking up."
license: MIT
metadata:
  title: Cold open
  kind: craft                 # style, voice, structure, genre or craft
  stages: draft, revise       # which of world, cast, plot, draft, revise it shapes
  cues: start faster, less setup     # words that, when steering, suggest it (optional)
  excludes: lush-lyrical      # skills it can't be combined with (optional)
---
- Open on a verb: someone already doing something, in a place, wanting something.
- No weather, no waking up, no looking in a mirror, no "it was a day like any other".
- Let the reader catch up on who and where from what happens in the first lines.
```

Write it as plain guidance about what the writing does: qualities, practices, things to check. Name no author or book to copy; describe the quality you like in them instead. A `SKILL.md` from elsewhere with no `metadata` comes in as a craft skill for drafting and revising. Only `SKILL.md`'s body is used; scripts and reference files in the folder are not.

### Adding your own

- **Paste it** in the panel: "Add a skill of your own…", paste the `SKILL.md`, "Check and keep it".
- **From a file**, on the command line: `omabook plugin run storyteller addSkill "$(jq -Rs '[.]' cold-open/SKILL.md)"`.
- **Drop it in**: a folder `data/skills/<name>/SKILL.md` (or a loose `data/skills/<name>.md`) in the plugin's folder is read the next time skills are listed.
- **From GitHub**, in the panel's address field or with `installSkill '["owner/repo"]'`. The address can be a repository, a folder, or a file, in the forms Omabook's own `plugin add` takes: `owner/repo`, `https://github.com/owner/repo`, `…/tree/<ref>/<folder>`, `…/blob/<ref>/<folder>/SKILL.md`, or a `raw.githubusercontent.com` link. A folder of skills (or a repository with a `skills/` folder) installs every one in it that passes the checks and says which were refused and why. Where each came from is kept beside it (`source.json`).

Your skills live in `data/skills/`, which survives updates; one with the name of a built-in one takes its place. `switchSkill '["wry", false]'` switches any skill off (it is offered to no story and stops shaping those that had it; the setting `skills_off`), `removeSkill '["cold-open"]'` removes one of yours. `skills '[true]'` lists them all, with any that are switched off or can't be used, and why.

### Skills elsewhere

Other people's fiction skills that are worth a look, and why they are not bundled:

| Skill | Licence | Note |
|---|---|---|
| [danjdewhurst/story-skills](https://github.com/danjdewhurst/story-skills) | MIT | 24 skills for the whole novel workflow (scene craft, line editing, worldbuilding). Good, but 10,000 to 19,000 characters each and tied to its own tools: too long to send with every request. Install one and trim it, or take its ideas. |
| [jwynia/agent-skills](https://github.com/jwynia/agent-skills) (`skills/creative/fiction/`) | `license: MIT` in each skill, but no licence file in the repository | Strong on clichés, prose style and revision; 15,000+ characters each. Not bundled while the licence is unclear. |
| [rhavekost/author-toolkit](https://github.com/rhavekost/author-toolkit) | MIT | Prose mechanics and a fiction workshop; long. |
| [AIStoryHub LLM cliché corpus](https://github.com/AIStoryHub/AIStoryHub_LLM_Cliche_Corpus) | MIT | A fiction-specific list of machine-prose tells; useful beside `cut-the-slop`. |
| [howells/fiction](https://github.com/howells/fiction) | none | Not redistributable. |

Some published fiction skills tell the model to write "like" named authors; Storyteller refuses those when they are installed, as it should.

## How it works

### The story file

A story is one file with the extension `.story`, JSON inside. The plugin keeps the master copy in `data/stories/<id>.story`; the library holds a copy, made with `omabook.library.create` and renewed with `omabook.library.replaceFile` each time a chapter is added.

```text
{
  "format": "omabook-story", "version": 1, "id": "smb1x2k3a",
  "title", "author", "language", "created", "updated",
  "premise":  {"wish", "logline", "genre", "tone", "voice", "blurb", "avoid"},     avoid: what earlier stories leaned on
  "world":    {"seen": "world:<id>", "plan": "world:<id>:plan"},        the two graphs, below
  "lineage":  null | {"kind": "fork" | "sequel", "story", "title", "chapter", "difference", "recap"},
  "plan":     {"chapters": 12, "structure", "arcs": [{"name", "chapters", "purpose", "ends_with"}],
               "beats": [{"chapter", "title", "pov", "goal", "events", "scenes": [{"goal", "conflict", "outcome"}], "seeds", "turn", "hook"}]},
  "skills":   [{"id", "name", "kind", "stages", "description", "source", "body"}],   what it is written with
  "skillLog": [{"at", "chapter", "skills", "by": "start" | "parent" | "reader" | "panel" | "steering"}],
  "chapters": [{"number", "title", "text" (Markdown), "written", "summary", "record", "renames", "recorded",
                "skills", "revision": {"checks", "applied", "skipped", "counted"}}],
  "steering": [{"at", "chapter", "text", "planned", "applied"}],
  "asked":    [{"at", "chapter", "question", "answer", "spoilers"}],
  "revealed": 3, "reached": 4, "ended": false,
  "cost":     {"calls", "sent", "received", "tasks": {"<task>": {"calls", "sent", "received"}}}
}
```

The format (`lib/storyfile.js`) hands Omabook the chapters and nothing else, so the plan and the logs never reach the reader, search or the AI companion. The plan is in the file as plain JSON, though: someone who opens the `.story` file in an editor can read ahead.

### The world is two graphs

Omabook's knowledge graph has scopes: `""` is the general graph of everything you have read, and any other name is a graph of its own. Each story keeps two:

- **`world:<id>:plan`, the author's.** Places, peoples and factions, the rules of the world (magic, technology, economy, religion, law) with what they cost, what they cannot do and where a reader first sees them work, history with what really happened, and the people with their wants, needs, the lie each believes, their arc, fears, secrets, contradictions and hidden ties. The plot is in it as nodes too: threads (with their kind and the chapters they open and close in), promises made to the reader (with the chapter each is due), twists (with the seeds to plant, the chapters to plant them in, the chapter they pay off in, and whether that has happened yet) and the endings the story is steering toward. And continuity: after each chapter, a note on every person in it (where they are, what they have learned, what they want now, how they changed) and on every thread it moved, and a `moment` node for the chapter (when it happens, the questions it leaves open). This is what the model is shown.
- **`world:<id>`, the reader's.** Only what the chapters you have read have shown, in words that give nothing else away. This is what the panel lists, and what is safe to browse: `omabook graph show --scope world:<id>`.

Why two scopes rather than one graph with a "spoiler" flag: a flag hides nothing unless every viewer honours it, and the graph view, `omabook graph`, the MCP tools and the exports know nothing of this plugin's flags. A scope is a boundary all of them already keep. A fact crosses from the plan to the reader's graph in one place only (`World.reveal`), once you are past the middle of the chapter that shows it. Spoiler-bearing plan nodes carry `data.spoiler: true` as well, for tools that want to look.

Both graphs grow as the story does. After each chapter the model is asked what the chapter established; things it invented on the way join the author's graph, the ledger of seeds and promises is brought up to date, and the reader's graph gets its share when you get there. That growing world is what a sequel or a branch starts from.

The general graph is read, never written: it is where the taste profile and the forbidden names come from.

### How a story is planned, and a chapter written

Each step is one request, and its answer is saved before the next is asked (see [When things go wrong](#when-things-go-wrong)). Why each step is there is in [docs/craft.md](docs/craft.md), whose last section maps every practice to the place in the plugin that carries it.

1. **The world** (`world`): places, groups whose wants collide, rules with costs and limits, history remembered wrongly. It is told what models fall back on (tides, ledgers, lighthouses and the rest), the names they reach for first, and what your earlier stories leaned on, counted from their text, so this one goes elsewhere.
2. **The people** (`cast`): want, need, the lie they believe, their arc, what they do unasked.
3. **The plot** (`plot`), top down in one answer: the shape it takes and why, its movements, the threads (closed in reverse order of opening), the promises with the chapter each is due, the twists with their seeds, two endings, and a beat per chapter with its scenes (goal, conflict, outcome) and the question it leaves open.
4. **Each chapter**:
   - **the plan revised** (`replan`), only when you steered or branched;
   - **the draft** (`chapter`), given the plan, the world, the chapters so far as summaries, the last pages of the one before, where everyone stands (continuity), what the ledger says is due here (a seed to plant, a twist or a promise to pay), and the skills;
   - **the editor's pass** (`revise`): the draft is read against nine concrete checks (continuity, point of view and tense, scenes that turn, the ending, clarity of invented words, repetition, telling, the skills, originality), with what the plugin counted in it (stock phrases, phrases used three times, phrases taken over from the chapter before, overused motifs), and mended by edits. An edit is placed only where its passage occurs once; what is good is left alone. No model is asked to give the chapter a score: the research says they judge quality badly;
   - **the originality check** on the final text;
   - **what it established** (`update`, the quick model): what the reader now knows, the plot's ledger, and continuity.

### Taste, not content

Before a world is built, `lib/taste.js` reads what you have read and how you rated it, and writes a few lines of abstractions: the kinds of book you rate highly and the kinds you don't, the themes that run through them, real-world subjects you like meeting, the kinds of thing you ask about. Every name the library knows is taken out before the model sees it. `omabook plugin run storyteller taste` prints exactly what would be sent.

What is left out on purpose: the inventions of the books you liked. The graph knows each book's magic systems, technologies and rules of the world, and a line such as "an economy where air is the currency" would say a great deal about your taste. It is also a description of another author's idea, and the originality rule comes first, so nothing of a concept is passed on, not even reworded. Taste stays at the level of category words: genres, themes, subjects.

One caveat. A topic is only told from a name by its capitals, so a real person's single name could pass as a subject.

The model is also told, in a line each, what it has already written for you (title, premise, the main people's names), so that a second story is not the first one again. Those are this plugin's own inventions.

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

"Branch the story from here" makes a new book: the chapters up to the one you are in, a copy of both graphs with everything later taken back out, the plan revised for the way you said it should differ, and the first chapter of the new road, which is where the new book opens. Its lineage (which story, which chapter, what you asked for) is in its file and its description. The original is untouched, and the two go on independently.

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
| A new story: world, cast, plot | 3 | 1,100 + 3,000 + 6,700 tokens | 3,000 + 3,100 + 2,500 tokens |
| Each chapter: the chapter, the editor's pass, what it established | 3 | 9,800 + 3,100 + 1,800 tokens | 1.4 tokens a word of chapter + 800 + 2,400 |
| A chapter after you steered: the plan revised first | +1 | 9,000 tokens | 3,000 tokens |
| A question to the author | 1 | 2,000 to 5,000 tokens (12,000 with spoilers) | 200 tokens |
| A branch: the plan revised, then a chapter | 4 | 30,000 tokens | 8,500 tokens |
| A sequel: its plan, then a chapter | 4 | 22,000 tokens | 6,500 tokens |
| A new story in the world of another: its plan, then a chapter | 4 | about as a sequel (not measured) | about as a sequel |
| A draft that used a taken name | +1 or +2 | 400 tokens each | 100 tokens each |
| An answer that could not be used | +1 | the same request again | |

These are measured, not guessed. Two stories were started and read into with Claude Code as the model, at 500 words a chapter and four chapters, in a scratch library: one with no skills, one with two (`kishotenketsu`, `wry`) and the editor's pass on the quick model. The figures are what their files recorded by task (characters, divided by four). For comparison the version before this one (no skills, no editor's pass, no continuity) was run at the same settings.

| Start and one chapter, 500 words a chapter | Requests | Sent | Received | Time |
|---|---|---|---|---|
| Before (version 1.0) | 8 | 26,400 tokens | 12,700 tokens | 6 min |
| Now, no skills | 9 | about 40,600 tokens | about 16,600 tokens | 8 min |
| Now, two skills, the editor on the quick model | 9 | 39,600 tokens | 16,300 tokens | 10 min |

So a story now costs about half as much again to start, and each chapter one request and about 5,000 tokens more: the editor's pass (3,100 sent), and a chapter request a third larger than before, since it carries where everyone stands, what is due, what to stay away from and the skills. The update now also writes continuity, which made its answer larger. In return every chapter is read against the checklist; in the trials the editor placed 55 of 56 edits it asked for, and caught a name contradicting an earlier chapter, invented terms the page never explained, a point of view knowing what it could not, an ending at odds with the plan, and phrases taken over from the chapter before (two or three a chapter before the pass, none after). A chapter took one and a half to two and a half minutes to write and read over.

The editor's pass goes to the quick model by default: in the second trial it found the same kinds of fault as the main model did in the first and its replacement sentences read as well. One trial each is thin evidence; set `model_revise` to `main` if yours does worse, or `revise` to `false` to save the request.

So a twelve-chapter book at the default 1,200 words a chapter is about 40 requests, some 215,000 tokens sent and 70,000 received. Most of what is sent is the same world and plan each time, which a provider that caches prompts charges little for; a model run through a command or a subscription may count it in full. Skills add their text to every request of their stages: a few hundred tokens each.

A chapter's request does not grow with the book. The model is sent the plan and the world (some 20,000 to 30,000 characters, cut at 36,000 however much the world has grown), one short summary per chapter (older ones shorter), and the last 2,500 characters of the previous chapter: not the book.

Three of these go to Omabook's quick model by default: the editor's pass (see above), and the two that read text into JSON and invent nothing: what a chapter established, and the renames. Everything a reader reads, and everything the story is built on, goes to the main model. The request that reads a chapter is given the twists by label and seed only, never their truths, so it has no secret to write into the reader's graph whichever model answers it. Both are settings, below.

What each story has actually used is in its file, under `cost` (requests, and characters sent and received), and in `omabook plugin run storyteller stories`.

Reading a story also feeds Omabook's own knowledge graph if you have that set to grow as you read, like any book; that is Omabook's setting and its cost, not this plugin's.

## Settings

```bash
omabook plugin run storyteller settings                                   # show them
omabook plugin run storyteller settings '[{"chapter_words": 800, "write_ahead": false}]'
```

| Setting | Default | |
|---|---|---|
| `chapter_words` | 1200 | About how long a chapter is. The biggest lever on cost. The form on the shelf starts at this, and a story keeps what was chosen for it. |
| `chapters` | 12 | How many chapters a new story is planned to take. Steering may change it. Also where the form starts. |
| `write_ahead` | true | Write the next chapter by itself as you near the end of what there is. |
| `write_at` | 0.35 | How far into the last chapter (0 to 1) you must be before the next is started. |
| `model_writing` | main | The model for what you read and what the story is built on: the world, the cast, the plot, revised plans, the chapters, the author's answers. `main` is the model chosen in Omabook's settings. |
| `revise` | true | Read each chapter over against the checklist and mend it: one request a chapter. Off saves it. |
| `model_revise` | quick | The model for that pass. On trial the quick model did as well as the main one (see [What it costs](#what-it-costs)); `main` if yours does worse. |
| `skills` | none | The skills a new story is written with when you choose none, by name (`["spare-concrete", "chapter-hooks"]`). |
| `skills_off` | none | Skills switched off; see [Skills](#skills). |
| `model_structure` | quick | The model for turning text into structure: reading a finished chapter into the two graphs, and renaming taken names. `quick` is Omabook's small, fast model; set it to `main` if yours makes a poor job of it. |
| `language` | English | The language stories are written in. |
| `pen_name` | Storyteller | The author on the cover. |
| `forbidden_names`, `allowed_names` | none | Your own additions to the originality check. |
| `stale_seconds` | 30 | How long unfinished work may show no sign of life before it counts as interrupted. |
| `shelf_entry` | true | Whether "Write a new story" is on the shelf. Removing it from the shelf sets this to false. |

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
lib/skills.js         skills: reading, checking and refusing them, choosing them, adding and installing them
lib/checks.js         what a program can count in a draft: stock phrases, repeats, echoes, overused motifs
lib/taste.js          what the reader likes, as abstractions with the names taken out
lib/world.js          the two graphs: laying a world in, reading it back as text, revealing, copying, cutting back
lib/jobs.js           work in progress on disk, so it survives a crash
lib/status.js         what the panel and the line at the bottom of the window say
lib/writer.js         the writing: a new story, a chapter, a branch, a sequel, a story in another's world, as stages
lib/reading.js        page turns (when to write, what to reveal), steering, asking the author
skills/               the built-in skills, each <name>/SKILL.md with its evals/
docs/craft.md         how stories work and what is known about long fiction from models, with sources
tests/run.py          the tests: the whole life of a story, driven from the command line
tests/evals.py        the skills' evals: checks with the stand-in model; --quality on the real AI
tests/refused/        skills that must be refused, one for each reason
tests/stub_ai.py      a stand-in for the model that answers canned text
tests/window/         the plugin in Omabook's real window, offscreen (needs Omabook's source)
data/                 made when the plugin runs: stories/, jobs/, skills/, settings.json (not in the repository)
```

Each file in `lib/` makes one global (`Util`, `Stories`, `World`, …) because a script plugin has no modules; `omabook.include` runs a file in the plugin's one engine, and `main.js` includes them in the order they build on each other.

## Trying it from the command line

Every top-level function in `main.js` can be run without the window, which is how to see what each part does. `plugin run` waits for the promise a function answers, ten minutes at most unless `--wait <minutes>` says otherwise, so a chapter can be written this way.

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
omabook plugin run storyteller showWorld '[41]'                    # in the window: the reader's graph in Omabook's graph view

omabook toc 41 ; omabook text 41 --section 0                       # the book, as any book
omabook graph show --scope world:smb…                              # the reader's graph, as any graph
```

A new story is six requests and can take longer than ten minutes with a slow model: give it room with `--wait 30`. If a run is cut off all the same, nothing is lost, and `omabook plugin run storyteller resume` carries on from the request that was cut off.

To try the plugin without installing it, point `--folder` at the folder that holds it and `--library` at a scratch library: `omabook plugin run storyteller startStory '["…"]' --folder ~/src --library /tmp/books`. The story is made and its format is known for that run. Reading the book afterwards (`omabook toc`, the window) needs the plugin installed, since that is where Omabook looks for formats; `tests/run.py` therefore installs it into a scratch config folder.

## Tests

```bash
python3 tests/run.py            # needs omabook on the PATH, or OMABOOK=/path/to/omabook
python3 tests/run.py --keep     # leave the scratch folder to look at
```

The tests need no window and no model. They make a scratch home, a scratch library with one ordinary book and a little graph, copy the plugin into a scratch plugin folder, set Omabook's AI to the command `tests/stub_ai.py`, and then drive `omabook plugin run` through the whole life of a story (36 steps): skills loaded, refused for imitation, for speaking over the rules, for injected markers and for taken names, added, switched off and removed, and installed from a GitHub repository, folder and file (served by the test itself); a story started with two skills, which reach the requests of their stages and no others; a world built in its own scope, a collision with a library name rejected and renamed, chapter one read over and mended by edits (one that can't be placed is left out), costs kept by task, continuity kept in the plan graph and handed on, page turns that do and do not write chapter two, steering (with "write it lusher" choosing a skill, which puts out the one it excludes), the panel adding and removing skills, asking the author with and without spoilers, a chapter interrupted and picked up (in the update and in the editor's pass, neither paid for twice), the end, a sequel and a branch written with their parent's skills, a branch with copied graphs and lineage, the refusals for a book by a person, answers that are no good, and a lost working copy restored.

The skills have evals of their own, in the layout of Anthropic's [skill-creator](https://github.com/anthropics/skills): each skill's `evals/` holds cases (a brief, what a good result looks like, statements to judge it by, and for some a count to compare). `python3 tests/evals.py` checks, with the stand-in model, that every skill loads, is valid Agent Skills front matter, has well-formed cases, and that every skill in `tests/refused/` is refused for its reason. `python3 tests/evals.py --quality` runs every case on the real AI twice, with the skill and without it, has each result graded against the statements and counted, and writes skill-creator's workspace layout (`--skill-creator <its folder>` runs its benchmark over it). That costs: 36 drafts and 36 gradings, about 40 minutes with Claude Code. See [What the evals found](#what-the-evals-found).

### What the evals found

The skills were evaluated with Claude Code as the model: 18 cases over the 16 skills, each written with and without its skill under the same craft context a chapter has, and graded on 59 statements (with the counts where a case has them).

| | With the skill | Without |
|---|---|---|
| First run | 55 of 59 (93%) | 38 of 59 (64%) |
| After rewording three skills | 59 of 59 | |

Where a skill made the clearest difference: `second-person` (4 of 4 against 0), `heist` and `kishotenketsu` (3 against 0), `present-tense` (3 against 1), `spare-concrete` (8 against 5), `lush-lyrical` (6 against 4). Where it made none: `chapter-hooks`, `clear-inventions`, `dialogue-subtext`, `slow-dread`, `try-fail-cycles` and `wry` passed with and without, because the plugin's own craft (endings on a turn, invented words shown in use, people who talk across each other) already asks for what they check; their statements do not tell the two apart, and sharper cases are the next thing to write for them. Three failed at first and were reworded: `cut-the-slop` left a "she wasn't afraid; it was something older" (it now names every spelling of that contrast), `slow-burn-romance` gave a resistance that was only rivalry (it now asks for a belief, a loyalty or a wound, shown in the scene), and `trust-the-reader` let a feeling be named in passing and then explained a scene at its end (it now warns against both). One run a case is a small sample, and the grader is a model; the statements are concrete on purpose, since models judge quality badly.

The window has a test of its own, `tests/window/`: a small program that links Omabook's code and loads its real `Main.qml` offscreen, with the plugin in a scratch plugin folder and the same stand-in model. It starts a story from its key, types in the panel's steer field (and checks the letters did not set off the reader's single-key shortcuts), pages on until the next chapter arrives and the reader has kept its place, opens the graph view, asks the author, branches (the branch opens at its first new chapter), opens a book by a person (no panel, no story commands), and requires that QML warned of nothing. It needs Omabook's source tree and a build of it; `tests/window/CMakeLists.txt` says how.

## Writing your own plugin, starting from this one

1. **Start small.** `omabook plugin new mine --template format` (or `command`, `hook`, `panel`, `metadata`, `catalog`) makes a plugin of twenty lines that does one thing. This plugin is those templates grown up: its format is `Stories.register` in `lib/storyfile.js`, its commands and hooks are in `main.js`, its panel is `Panel.qml` fed by `lib/status.js`.
2. **Read the reference once.** `omabook plugin api` prints the whole `omabook` object, the events and the permissions. It is generated from Omabook's code, so it is never out of date.
3. **Keep the loop tight.** Edit, `omabook plugin check mine`, `omabook plugin run mine someFunction '[arguments]'`. Make the things you want to try top-level functions; that is the only reason half the functions in `main.js` exist.
4. **Know the language.** JavaScript on Qt's engine: no `async`/`await` (chain `.then`), no modules (`omabook.include`), no `setTimeout` (`omabook.after`), no `fetch` (`omabook.http`), no object rest or spread. In regular expressions `\p{…}` and lookbehind parse and then never match, silently. `omabook plugin api` lists exactly what is missing and what Omabook adds back (`flat`, `at`, `replaceAll`, `Promise.prototype.finally` and more).
5. **Five seconds.** Every call into the script has to come back within five seconds of its own running time. Waiting for a promise doesn't count, so do slow work in `.then` steps, one piece each (see `stage` in `lib/writer.js`).
6. **Keep state on disk.** The script can be loaded again at any time (you saved a file, Omabook restarted, the command line loaded a second copy to read your format). `omabook.settings` and files under `data/` survive; variables do not. Running the top level of your script should change nothing.
7. **Ask for little.** A permission is shown to whoever installs the plugin. This one needs `files` and nothing else.
8. **Things worth copying from here:** checking every AI answer before using it (`lib/ai.js`); a stand-in model for tests (`tests/stub_ai.py`); a panel that asks the script for something with `backend.scripts.request` and hears what came of it through `answered` (`Panel.qml`); the panel finding its own plugin's values without knowing the folder's name (`Panel.qml`); `when: "generated"` plus a refusal in one place for books that are not yours (`own` in `main.js`); a run of the real window with no display (`tests/window/`).

## Limits

- The panel's text is English only; a plugin has no translation catalog. Stories themselves are written in whatever `language` says.
- A skill can't be picked from a file in the window: Omabook has no file dialog for plugins, and a plugin reads files only in its own folder. Paste it in the panel instead (Omabook's own question dialog has one line, which is why the panel has a text area of its own), add it from the command line, or drop it in `data/skills/`.
- Stories for one reader still resemble each other underneath. The motifs models fall back on are kept out (the trials had no tides, ledgers or quince), but three stories in a row were all about poor workers on a cliff, a rent or a hush, and speech against silence. The plugin tells a new story what the earlier ones were and what they leaned on; it does not yet check the new world's premise against them.
- Invented words are still dense in a first chapter. The editor flags terms the page never explains, and mends some, not all.
- The skill checks catch wording, not intent. A skill that describes a famous author's voice closely without naming them, or a plot point by point, gets through, and rests, like the rest, on the originality rule in every request.
- The plan of a story is in its `.story` file as plain JSON. Omabook never shows it, but an editor would.
- The originality check catches names, not ideas. See above.
- A chapter being written can't be stopped; a wish that arrives meanwhile shapes the one after.

## License

MIT. See [LICENSE](LICENSE).
