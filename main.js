// Storyteller: writes an original book for the reader, chapter by chapter,
// as they read it.
//
// This file is the plugin's front door and is meant to be read first. It
// does four things, in this order, and each is one of the things a script
// plugin can do in Omabook:
//
//   1. includes the other files                        omabook.include
//   2. registers a book format, an entry on the shelf,  omabook.format / ui / commands
//      a panel and commands
//   3. listens to what the reader does                 omabook.on
//   4. defines top-level functions                     callable from the command
//                                                      line and from the panel
//
// The rules of the house (see `omabook plugin api`): the language is
// JavaScript without async/await, modules or timers, so slow things are
// promises chained with .then; every call into the script must come back
// within five seconds of its own running time (waiting for the model does
// not count), so nothing here loops over anything big; and the script
// sees the world only through the `omabook` object.
//
// Running the top level must change nothing: Omabook loads a script more
// than once (to check it, and to read a book of its format from the
// command line), so anything with an effect happens in a command, an
// event or a function.

// 1. The parts, lowest first: each file makes one global and may use the
//    ones above it.
omabook.include("lib/util.js");         // Util: small helpers
omabook.include("lib/config.js");       // Config: the settings and their defaults
omabook.include("lib/storyfile.js");    // Stories: the .story file and its book format
omabook.include("lib/prompts.js");      // Prompts: every word sent to the model
omabook.include("lib/ai.js");           // Ai: asking the model, checking the answer
omabook.include("lib/originality.js");  // Originality: the forbidden names
omabook.include("lib/taste.js");        // Taste: what the reader likes, as abstractions
omabook.include("lib/skills.js");       // Skills: Markdown files that shape how a story is written
omabook.include("lib/world.js");        // World: the two graphs of a story
omabook.include("lib/checks.js");       // Checks: what a program can count in a draft
omabook.include("lib/jobs.js");         // Jobs: work in progress, kept on disk
omabook.include("lib/status.js");       // Status: the panel and the line at the bottom
omabook.include("lib/writer.js");       // Writer: a new story, a chapter, a branch, a sequel
omabook.include("lib/sharing.js");      // Sharing: a story's world in a published or shared collection
omabook.include("lib/reading.js");      // Reading: page turns, steering, questions
omabook.include("lib/removal.js");      // Removal: a story, its world, and the stories that share it

// 2. What the plugin adds to Omabook.

// The format makes a .story file a book like any other: the reader, the
// contents, search, the command line and the AI companion all read it.
Stories.register();

// What a collection that is published or shared takes of a story: its
// world, and its file when the reader chose that (see sharing.js). Only an
// Omabook that carries plugins' worlds asks.
Sharing.register();

// The panel beside the page. Its text is plain English: a plugin has no
// translation catalog, so nothing here follows Omabook's language.
// `when: "generated"` shows it only beside books this plugin made: next to
// anybody else's book it takes no room at all.
omabook.ui.panel({place: "reader.side", title: "Storyteller", width: 300, source: "Panel.qml", when: "generated"});

// A command's `run` is given {book, place}. `when` is "always", or
// "generated" for a command that only makes sense on this plugin's books. What it answers (a promise is
// fine) is waited for; what goes wrong is told to the reader in a line,
// since a wish that can't be granted is not a fault in the script.
function command(id, title, place, key, when, run) {
    omabook.commands.register({
        id: id, title: title, place: place, key: key, when: when,
        run: function (context) {
            try {
                return Promise.resolve(run(context)).then(null, tell);
            } catch (error) {
                return tell(error);
            }
        }
    });
}

function tell(error) {
    omabook.say(Util.text(error && error.message || error));
    Status.refresh();
    return null;
}

// Asks the reader for words; a promise of them, or of null when they
// pressed Escape (or there is no window, as on the command line).
function askReader(title, placeholder) {
    return omabook.ui.ask({title: title, placeholder: placeholder || ""});
}

// The entry on the shelf that starts a story: it is opened like a book
// (Space, Enter, a double click, a tap) and opens the form below instead
// of a reader. It is no book of the library, so it is in no count, graph,
// sync or export, and it goes when the plugin is switched off. Taken off
// the shelf, it stays off (the setting "shelf_entry") until the command
// below puts it back.
function shelfEntry() {
    if (!Config.get("shelf_entry"))
        return;
    omabook.ui.launcher({
        id: "new", title: "Write a new story", author: "Storyteller",
        description: "What it should be, how it is written, how long, and whether it has a world of its own or lives in the world of one of your stories.",
        open: function () {
            try {
                return Promise.resolve(writeFromTheShelf()).then(null, tell);
            } catch (error) {
                return tell(error);
            }
        },
        removed: function () {
            Config.change({shelf_entry: false});
            omabook.say("\"Write a new story\" is off the shelf. \"Storyteller: put Write a new story on the shelf\" brings it back.");
        }
    });
}
shelfEntry();

command("story-write", "Write me a story", "library", "Ctrl+Shift+W", "always", writeFromTheShelf);

command("story-shelf", "Storyteller: put Write a new story on the shelf", "library", "", "always", function () {
    Config.change({shelf_entry: true});
    shelfEntry();
    omabook.say("\"Write a new story\" is on the shelf again.");
    return true;
});

// Removing a story, with its world, its working copy and whatever of it is
// still being written; asked first, saying what goes. From the shelf (the
// selected book) and from the reader.
command("story-remove", "Storyteller: remove this story", "reader", "", "generated", function (context) { return Removal.confirm(context.book); });
command("story-remove-selected", "Storyteller: remove this story", "library", "", "generated", function (context) { return Removal.confirm(context.book); });

command("story-next", "Storyteller: write the next chapter now", "reader", "Ctrl+Shift+N", "generated", function (context) {
    return nextChapter(context.book);
});

command("story-steer", "Storyteller: steer the story", "reader", "Ctrl+Shift+S", "generated", function (context) {
    Stories.own(context.book, "steered");
    return askReader("Where should the story go?", "Who to follow, what should happen, the tone, the pace…")
        .then(function (wish) { return wish ? steer(context.book, wish) : null; });
});

command("story-ask", "Storyteller: ask the author", "reader", "Ctrl+Shift+A", "generated", function (context) {
    Stories.own(context.book, "asked about this way");
    return askReader("Ask the author", "No spoilers, unless you ask for them in so many words.")
        .then(function (question) { return question ? askAuthor(context.book, question) : null; });
});

// Branching is for this plugin's stories only, and it is guarded twice.
// `when: "generated"` means Omabook offers the command (and its key) only
// while the book in hand is one this plugin made. And `branch` below
// refuses any other book for whoever calls it another way: the command
// line, another plugin, a future mistake here.
command("story-branch", "Storyteller: branch the story from here", "reader", "Ctrl+Shift+B", "generated", function (context) {
    Stories.own(context.book, "branched");
    return askReader("How should it go differently from here?", "What changes from this chapter on.")
        .then(function (difference) { return difference === null ? null : branch(context.book, difference); });
});

command("story-skills", "Storyteller: choose the story's skills", "reader", "Ctrl+Shift+K", "generated", function (context) {
    const mine = Stories.own(context.book, "changed");
    return omabook.ui.ask({title: "Which skills should it be written with?", placeholder: "Names, with commas; empty for none. The panel lists them.",
                           text: Util.list(mine.story.skills).map(function (skill) { return skill.id; }).join(", ")})
        .then(function (words) { return words === null ? null : setSkills(context.book, words || []); });
});

command("story-sequel", "Storyteller: write a sequel in this world", "global", "Ctrl+Shift+E", "generated", function (context) {
    Stories.own(context.book, "followed by a sequel");
    return askReader("What should the sequel be about?", "Leave empty to let the world decide.")
        .then(function (wish) { return wish === null ? null : sequel(context.book, wish); });
});

// What goes when the story is in a collection that is published or shared,
// and a new story in a world someone shared with the reader.
command("story-sharing", "Storyteller: what goes when this story is shared", "reader", "", "generated", function (context) {
    return Sharing.ask(Stories.own(context.book, "shared").story);
});

command("story-shared-world", "Storyteller: write in a world shared with you", "library", "", "always", function () {
    return Sharing.askWorld().then(function (values) {
        return values ? writeInSharedWorld(values.scope, values.wish, [], null, values.share !== false) : null;
    });
});

// 3. What the reader does. The three reader events carry the same thing:
//    {id, generated, identifiers, section, sections, fraction, percent}.
//    A handler that starts a chapter hands its promise to omabook.wait, so
//    that `omabook plugin run storyteller event:page.turned ...` stays
//    until the chapter is written; in the window it changes nothing.
omabook.on("book.opened", function (event) { return omabook.wait(Reading.attend(event)); });
omabook.on("page.turned", function (event) { return omabook.wait(Reading.attend(event)); });
omabook.on("book.closed", function () { Status.reading(null); });
// A story's book removed with Omabook's own Remove: its world and working
// copy are still kept, so putting the book back from the trash goes on with
// the story. The reader is asked once whether they should go too; the
// answer that loses nothing is the one taken when they leave the question.
omabook.on("book.removed", function (event) { return omabook.wait(Removal.afterRemoval(event.book || {})); });
omabook.on("app.started", function () {
    Status.refresh();
    if (unfinishedStories().length > 0)
        omabook.say("A story was being started when Omabook closed. \"Write me a story\" picks it up.");
});

// 4. Top-level functions. Each can be run from the command line:
//      omabook plugin run storyteller startStory '["a quiet mystery at sea"]'
//    and the panel calls some of them with backend.scripts.call.

// Jobs other than a chapter of an existing book: a story, branch or sequel
// that has no book yet, and so nowhere to be noticed but here.
function unfinishedStories() {
    return Jobs.all().filter(function (job) {
        const state = Jobs.state(job.story);
        return job.kind !== "chapter" && (state === "interrupted" || state === "failed");
    });
}

// Opens what was just made, at the place the reader should be: the first
// page of a new story or a sequel, and for a branch the first chapter that
// is new, since they have read the ones before it in the book they
// branched from. The place is also kept as the book's progress, so the
// shelf shows it and the next opening finds it.
function opened(made, section) {
    const place = {section: section || 0, fraction: 0};
    omabook.library.setProgress(made.book, place);
    omabook.reader.open(made.book, place);
    Status.refresh();
    return made;
}

// Starts a story: builds its world, plans it, writes chapter one, adds the
// book and opens it. `wish` is what the reader is in the mood for; empty
// is "surprise me". A promise of {book, story, title, chapter, ...}.
//
// `skills` is which skills to write it with: a list of names, or words
// ("lush, kishotenketsu"); left out or empty, the defaults in the settings.
// `length` is {chapters, words}, for this story; the settings when left out.
function startStory(wish, skills, length) {
    const chosen = pickSkills(skills, true);
    return Writer.start(wish, chosen.map(Skills.snapshot), lengthOf(length)).then(function (made) { return opened(made); });
}

// --- Starting from the shelf ------------------------------------------------

// What opening "Write a new story" does: a story that was being started
// when Omabook closed, or stopped on a problem, is picked up first;
// otherwise the form, and then the story it describes.
function writeFromTheShelf() {
    const unfinished = unfinishedStories()[0];
    if (unfinished) {
        omabook.say("Picking up the story that was being started…");
        return resume(unfinished.story);
    }
    return omabook.ui.form(storyForm()).then(function (values) { return values ? startFromForm(values) : null; });
}

// The form put to Omabook as the shelf entry puts it, for the tests: Omabook
// checks a form before drawing it, and throws when it can't be drawn.
function formCheck() {
    return omabook.ui.form(storyForm()).then(function () { return null; });
}

// The stories a new one can be linked to: those with a chapter, newest first.
function toldStories() {
    return Stories.all().filter(function (story) { return story.chapters.length > 0; })
        .sort(function (a, b) { return a.created < b.created ? 1 : -1; });
}

// The form, as omabook.ui.form takes it. Where the story lives is offered
// only when there are stories to link it to; a sequel only to one that has
// ended. A field that doesn't apply to the choice is hidden (`when`).
function storyForm() {
    const told = toldStories(), linked = ["world", "sequel", "branch"];
    const fields = [
        {id: "wish", type: "textarea", label: "What should it be?",
         placeholder: "A mood, a kind of story, a what-if. Leave it empty to be surprised."}
    ];
    if (told.length > 0) {
        const where = [{value: "new", label: "A world of its own", help: "A new world, new people, a new plot."},
                       {value: "world", label: "A new story in the world of one of yours",
                        help: "The world as you know it from that book, new people and a new plot. Nothing it established is contradicted, and nothing it hasn't shown you is given away."}];
        if (told.some(function (story) { return story.ended; }))
            where.push({value: "sequel", label: "A sequel to one that has ended", help: "The same world, later: what that book left behind, and a new plot."});
        where.push({value: "branch", label: "A branch of one, from a chapter", help: "The chapters up to there, and from there it goes another way."});
        fields.push({id: "where", type: "choice", label: "Where does it live?", value: "new", choices: where});
        fields.push({id: "story", type: "choice", label: "Which story?", when: {where: linked},
                     choices: told.map(function (story) {
                         return {value: story.id, label: story.title,
                                 help: story.chapters.length + (story.chapters.length === 1 ? " chapter" : " chapters") + (story.ended ? ", ended" : ", still being written")};
                     })});
        fields.push({id: "chapter", type: "number", label: "Branch from chapter", min: 1, value: 1, when: {where: "branch"},
                     max: Math.max.apply(null, told.map(function (story) { return story.chapters.length; })),
                     help: "It keeps the chapters up to this one, and goes its own way after."});
    }
    const notBranch = told.length > 0 ? {where: ["new", "world", "sequel"]} : undefined;
    function only(field) {
        if (notBranch)
            field.when = notBranch;
        return field;
    }
    fields.push(only({id: "skills", type: "multi", label: "Write it with", value: Config.get("skills"),
                      choices: Skills.all().map(function (skill) { return {value: skill.id, label: skill.title, help: skill.description}; }),
                      help: "Skills shape the style, the structure, the genre and the craft. None: the house style. A sequel or a story in another's world is written as that one was unless you choose."}));
    fields.push(only({id: "pov", type: "choice", label: "Point of view", value: "story",
                      choices: [{value: "story", label: "Let the story decide"}, {value: "first", label: "First person"},
                                {value: "third", label: "Close third person"}],
                      help: "A skill that sets the point of view goes first."}));
    fields.push({id: "tone", type: "text", label: "Tone", placeholder: "Warm, eerie, wry, tender… Empty: the story finds its own."});
    fields.push(only({id: "chapters", type: "number", label: "Chapters", min: 2, max: 60, value: Config.get("chapters"),
                      help: "Where the plan aims; steering can change it."}));
    fields.push(only({id: "words", type: "number", label: "Words a chapter", min: 150, max: 6000, step: 50,
                      value: Math.round(Config.get("chapter_words") / 50) * 50, help: "The biggest lever on what a story costs."}));
    return {title: "Write a new story", accept: "Start Writing", fields: fields,
            intro: "Storyteller writes it for you, with the AI set up in Omabook: an original story, with no people, places or plots from other books. Chapter one is ready in a few minutes; the rest are written as you read."};
}

function lengthOf(given) {
    if (!given || (!given.chapters && !given.words))
        return null;
    return {chapters: given.chapters ? Math.max(2, Math.min(60, Math.round(Number(given.chapters)))) : 0,
            words: given.words ? Math.max(150, Math.min(6000, Math.round(Number(given.words)))) : 0};
}

// Starts the story the form describes. Also for the command line:
//   omabook plugin run storyteller startFromForm '[{"wish": "...", "where": "world", "story": "<id>"}]'
// `where` is "new" (the default), "world", "sequel" or "branch"; `story`
// the story it is linked to; `chapter` where a branch leaves it.
function startFromForm(values) {
    values = values || {};
    const where = values.where || "new";
    const extras = [Util.text(values.tone) ? "Tone: " + Util.text(values.tone) + "." : "",
                    values.pov === "first" ? "Tell it in the first person." : values.pov === "third" ? "Tell it in close third person." : ""];
    const wish = [Util.text(values.wish)].concat(extras).filter(Boolean).join(" ");
    const length = lengthOf(values);
    // Skills that were given are those, none included; not given, the defaults.
    const given = values.skills !== undefined;
    if (where === "new") {
        const chosen = given ? pickSkills(Util.list(values.skills), false) : pickSkills([], true);
        return Writer.start(wish, chosen.map(Skills.snapshot), length).then(function (made) { return opened(made); });
    }
    if (["world", "sequel", "branch"].indexOf(where) < 0)
        throw new Error("A story lives in a world of its own (new), in the world of another (world), after one (sequel) or branches from one (branch); not \"" + where + "\".");
    const parent = values.story && Stories.exists(values.story) ? Stories.load(values.story) : null;
    if (!parent)
        throw new Error("Choose which of your stories it goes with.");
    const parentBook = Stories.bookOf(parent);
    const chosen = given && Util.list(values.skills).length ? pickSkills(Util.list(values.skills), false).map(Skills.snapshot) : [];
    if (where === "sequel") {
        if (!parent.ended)
            throw new Error("\"" + parent.title + "\" has not ended yet; a sequel follows an ending. A new story in its world, or a branch, can start now.");
        return Writer.sequel(parent, wish, chosen, length).then(function (made) { return opened(made); });
    }
    if (where === "world")
        return Writer.inWorld(parent, parentBook ? parentBook.id : 0, wish, chosen, length).then(function (made) { return opened(made); });
    if (!parentBook)
        throw new Error("\"" + parent.title + "\" is not in this library, so it can't be branched.");
    return branch(parentBook.id, wish, Math.max(1, Math.min(parent.chapters.length, Number(values.chapter) || 1)));
}

// --- Removing a story (removal.js) ----------------------------------------

// What removing a story takes away, without taking it; and removing it.
// With {world: "all"}, every story that shares its world goes as well.
function removalPlan(target) { return Removal.plan(target); }
function removeStory(target, options) { return Removal.remove(target, options); }

// --- Sharing (sharing.js) --------------------------------------------------

// What a collection of these books takes of Storyteller's, with these parts:
//   omabook plugin run storyteller sharedWorlds '[[12, 14], ["graph"]]'
// Only the reader's graph of a story it wrote; its file only when chosen.
function sharedWorlds(books, parts) { return Sharing.plan(books, parts); }

// What goes of one story, after changing what is given: {world, file}.
function storySharing(bookId, choice) { return Sharing.choose(Stories.own(bookId, "shared").story, choice || {}); }

// The worlds shared with the reader, and a new story in one of them, which
// goes into the space when it is a shared one they write in (and `share` is
// not false). `scope` is a layer's, as worldsSharedHere lists them.
function worldsSharedHere() { return Sharing.layers(); }

function writeInSharedWorld(scope, wish, skills, length, share) {
    const chosen = pickSkills(skills || [], true).map(Skills.snapshot);
    return Sharing.writeIn(scope, wish, chosen, lengthOf(length), share).then(function (made) { return opened(made); });
}

// Skills named in words or as a list, settled, or an Error that says which
// names were not understood. `orDefaults`: nothing named is the defaults.
function pickSkills(asked, orDefaults) {
    let ids = asked;
    if (!Array.isArray(asked)) {
        const chosen = Skills.choose(asked || "");
        if (chosen.unknown.length > 0)
            throw new Error("There is no skill for \"" + chosen.unknown.join("\", \"") + "\". These are the skills: "
                            + Skills.all().map(function (skill) { return skill.id; }).join(", ") + ".");
        ids = chosen.ids;
    }
    if (ids.length === 0 && orDefaults)
        ids = Config.get("skills");
    const settled = Skills.settle(ids);
    if (settled.problems.length > 0)
        throw new Error("Those skills can't be used: " + settled.problems.join("; ") + ".");
    return settled.skills;
}

// Writes the next chapter now, whether or not the reader is near the end
// of what there is; this is "unless the reader asks".
function nextChapter(bookId) {
    const mine = Stories.own(bookId, "continued"), state = Jobs.state(mine.story.id);
    if (state === "running" || state === "elsewhere")
        throw new Error("Chapter " + (mine.story.chapters.length + 1) + " is being written already.");
    if (state === "interrupted" || state === "failed")
        return Writer.run(Jobs.read(mine.story.id));
    if (mine.story.ended)
        throw new Error("\"" + mine.story.title + "\" has ended. You can ask for a sequel, or branch it from an earlier chapter.");
    return Writer.next(mine.story);
}

// Records what the reader wants of the story; see Reading.steer.
function steer(bookId, wish) {
    const mine = Stories.own(bookId, "steered");
    return Reading.steer(mine.book, mine.story, wish);
}

// Asks the author a question about the story so far. `spoilers` true (or
// asking for them in the question) lets the answer draw on the plan.
function askAuthor(bookId, question, spoilers) {
    const mine = Stories.own(bookId, "asked about this way");
    return Reading.ask(mine.book, mine.story, question, spoilers);
}

// Branches a story: a new book with the chapters up to the one the reader
// is in (or `chapter`, counted from 1), which goes its own way from there.
function branch(bookId, difference, chapter) {
    const mine = Stories.own(bookId, "branched");
    const upTo = Math.max(1, Math.min(mine.story.chapters.length, Number(chapter) || Reading.place(mine.book.id).section + 1));
    return Writer.fork(mine.story, mine.book.id, upTo, difference).then(function (made) { return opened(made, upTo); });
}

// Starts a new story in the world of one that has ended.
// It is written with the skills of the first, unless `skills` names others.
function sequel(bookId, wish, skills) {
    const mine = Stories.own(bookId, "followed by a sequel");
    if (!mine.story.ended)
        throw new Error("\"" + mine.story.title + "\" has not ended yet; a sequel follows an ending. You can branch it instead.");
    const chosen = skills ? pickSkills(skills, false).map(Skills.snapshot) : [];
    return Writer.sequel(mine.story, wish, chosen).then(function (made) { return opened(made); });
}

// --- Skills ---------------------------------------------------------------
// The skills there are (with `true`, also those switched off or broken,
// with why), one in full, adding the reader's own, and a story's skills.

function skills(everything) { return Skills.all(!!everything).map(Skills.summary); }

function skill(id) {
    const found = Skills.find(id, true);
    if (!found)
        throw new Error("There is no skill called \"" + Util.text(id) + "\".");
    return Object.assign(Skills.summary(found), {body: found.body, cues: found.cues, excludes: found.excludes, path: found.path || ""});
}

// A skill's SKILL.md, as text (see README: "Writing a skill"). It is
// checked like every other and kept in data/skills/<name>/SKILL.md.
function addSkill(text) { return Skills.add(text); }

// A skill from GitHub: owner/repo, or a link to a repository, a folder or
// a SKILL.md (a folder of several installs them all). Needs "http".
function installSkill(address) { return Skills.install(address); }

function removeSkill(id) { return Skills.remove(id); }

// Switches a skill off (it is offered to no story and shapes none), or on.
function switchSkill(id, on) { return Skills.switchOn(id, on !== false); }

// For the skills' evals (tests/evals.py --quality): a brief written with a
// skill, or with none (`id` empty), and a result graded against statements.
// Each is one request to the AI set up in Omabook.
function evalDraft(id, brief) {
    const chosen = id ? [Skills.find(id, true)].filter(Boolean) : [];
    if (id && chosen.length === 0)
        throw new Error("There is no skill called \"" + id + "\".");
    const before = Ai.tally();
    return Ai.prose("eval", Prompts.evalTask(Util.text(brief), chosen.map(Skills.snapshot))).then(function (text) {
        return {text: text, cost: Ai.since(before)};
    });
}

function evalGrade(text, statements) {
    return Ai.json("grade", Prompts.grade(text, Util.list(statements)), function (answer) {
        const grades = Util.list(answer.grades);
        if (grades.length !== Util.list(statements).length)
            throw new Error("it grades " + grades.length + " statements, and there are " + Util.list(statements).length);
        return grades.map(function (grade, index) {
            return {text: Util.list(statements)[index], passed: grade.passed === true, evidence: Util.clip(grade.evidence, 400)};
        });
    });
}

// A story's skills, and when they were chosen or changed.
function storySkills(bookId) {
    const mine = Stories.own(bookId, "looked into");
    return {skills: Util.list(mine.story.skills).map(function (one) { return {id: one.id, name: one.name, kind: one.kind}; }),
            log: Util.list(mine.story.skillLog)};
}

// Sets the skills a story is written with from its next chapter on: a list
// of names, or words. An empty list is none.
function setSkills(bookId, ids, by) {
    const mine = Stories.own(bookId, "changed"), chosen = pickSkills(ids, false), story = mine.story;
    story.skills = chosen.map(Skills.snapshot);
    story.skillLog = Util.list(story.skillLog).concat([{at: Util.now(), chapter: story.chapters.length + 1,
                                                        skills: chosen.map(function (one) { return one.id; }), by: by || "reader"}]);
    Stories.save(story);
    Status.refresh();
    omabook.say(chosen.length ? "From chapter " + (story.chapters.length + 1) + " on it is written with: " + Skills.names(story.skills) + "."
                              : "From chapter " + (story.chapters.length + 1) + " on it is written without skills.");
    return storySkills(bookId);
}

// Picks up a story, branch or sequel that was cut off or that failed: the
// one named, or the first there is.
function resume(storyId) {
    const job = storyId ? Jobs.read(storyId) : unfinishedStories()[0] || Jobs.all()[0];
    if (!job)
        throw new Error("Nothing was left unfinished.");
    return Writer.run(job).then(function (made) {
        return job.kind === "chapter" ? made : opened(made, job.kind === "fork" ? job.upTo : 0);
    });
}

// Gives up on something unfinished: the job, and a story that never
// became a book, with its graphs.
function abandon(storyId) {
    const job = Jobs.read(storyId);
    if (!job)
        throw new Error("There is nothing unfinished called " + storyId + ".");
    Jobs.clear(storyId);
    const story = Stories.exists(storyId) ? Stories.load(storyId) : null;
    if (story && job.kind !== "chapter" && !Stories.bookOf(story)) {
        World.drop(story);
        omabook.files.remove(Stories.path(storyId));
    }
    return true;
}

// The stories there are, with their place in the library and their state.
function stories() {
    return Stories.all().map(function (story) {
        const book = Stories.bookOf(story);
        return {story: story.id, book: book ? book.id : 0, title: story.title, chapters: story.chapters.length, planned: story.plan.chapters,
                ended: story.ended, skills: Util.list(story.skills).map(function (one) { return one.id; }), lineage: story.lineage ? {kind: story.lineage.kind, story: story.lineage.story, chapter: story.lineage.chapter} : null,
                state: Jobs.state(story.id), cost: story.cost || null};
    });
}

// What is unfinished, and why.
function unfinished() {
    return Jobs.all().map(function (job) {
        return {story: job.story, kind: job.kind, chapter: job.chapter, state: Jobs.state(job.story), doing: job.doing || "", problem: job.failed || ""};
    });
}

// One of a story's two graphs as lists: "seen" (what the reader knows; the
// default) or "plan" (the author's, with every spoiler).
function world(bookId, which) {
    const mine = Stories.own(bookId, "looked into");
    return World.listing(which === "plan" ? mine.story.world.plan : mine.story.world.seen);
}

// The settings, after changing those given: settings({"chapter_words": 600}).
function settings(changes) {
    const now = Config.change(changes);
    Originality.forget();
    Status.refresh();
    return now;
}

// The originality rule's hooks: names of the reader's own to forbid or to
// let through, and a look at what a text would be refused for.
function forbid(name) {
    return settings({forbidden_names: Config.get("forbidden_names").filter(function (other) { return Util.norm(other) !== Util.norm(name); }).concat([Util.text(name)])}).forbidden_names;
}

function allow(name) {
    return settings({allowed_names: Config.get("allowed_names").filter(function (other) { return Util.norm(other) !== Util.norm(name); }).concat([Util.text(name)])}).allowed_names;
}

function forbiddenNames() {
    const names = Originality.forbidden();
    return Object.keys(names).map(function (norm) { return {name: names[norm].name, from: names[norm].source}; });
}

function checkOriginality(text) { return Originality.hitsIn({text: Util.text(text)}); }

// What would be told to the model about the reader's taste.
function taste() { return Taste.profile(); }

// Opens Omabook's own graph view on what the reader knows of a story's
// world: the "seen" graph, never the plan.
function showWorld(bookId) {
    const mine = Stories.own(bookId, "looked into");
    omabook.ui.showGraph({scope: mine.story.world.seen});
    return mine.story.world.seen;
}

// What the panel asks for, by name. The panel calls this with
// backend.scripts.request, which answers through a signal when the promise
// settles, so a button gets what really came of it: the result, or the
// reason it could not be done, which the panel shows.
function panel(action, bookId, text) {
    const actions = {
        steer: steer, ask: askAuthor, next: nextChapter, world: showWorld,
        askSpoilers: function (book, question) { return askAuthor(book, question, true); },
        // The skills: `text` is a skill's name, or for "pasteSkill" its whole
        // SKILL.md, for "installSkill" a GitHub address.
        addSkill: function (book, id) {
            const now = Util.list(Stories.own(book, "changed").story.skills).map(function (one) { return one.id; });
            return setSkills(book, now.concat([id]), "panel");
        },
        removeSkill: function (book, id) {
            const now = Util.list(Stories.own(book, "changed").story.skills).map(function (one) { return one.id; });
            return setSkills(book, now.filter(function (other) { return other !== id; }), "panel");
        },
        pasteSkill: function (book, text) { return Skills.add(text); },
        installSkill: function (book, address) { return Skills.install(address); },
        switchOff: function (book, id) { return Skills.switchOn(id, false); }
    };
    if (!actions[action])
        throw new Error("The panel asked for something unknown: " + action);
    return Promise.resolve(actions[action](bookId, text)).then(function (result) {
        Status.refresh();
        return result;
    }, function (error) {
        Status.refresh();
        throw error;
    });
}
