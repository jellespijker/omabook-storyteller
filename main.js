// Storyteller: writes an original book for the reader, chapter by chapter,
// as they read it.
//
// This file is the plugin's front door and is meant to be read first. It
// does four things, in this order, and each is one of the things a script
// plugin can do in Omabook:
//
//   1. includes the other files                        omabook.include
//   2. registers a book format, a panel and commands   omabook.format / ui / commands
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
omabook.include("lib/world.js");        // World: the two graphs of a story
omabook.include("lib/jobs.js");         // Jobs: work in progress, kept on disk
omabook.include("lib/status.js");       // Status: the panel and the line at the bottom
omabook.include("lib/writer.js");       // Writer: a new story, a chapter, a branch, a sequel
omabook.include("lib/reading.js");      // Reading: page turns, steering, questions

// 2. What the plugin adds to Omabook.

// The format makes a .story file a book like any other: the reader, the
// contents, search, the command line and the AI companion all read it.
Stories.register();

// The panel beside the page. Its text is plain English: a plugin has no
// translation catalog, so nothing here follows Omabook's language.
omabook.ui.panel({place: "reader.side", title: "Storyteller", width: 300, source: "Panel.qml"});

// A command's `run` is given {book, place}. What it answers (a promise is
// fine) is waited for; what goes wrong is told to the reader in a line,
// since a wish that can't be granted is not a fault in the script.
function command(id, title, place, key, run) {
    omabook.commands.register({
        id: id, title: title, place: place, key: key,
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

command("story-write", "Write me a story", "library", "Ctrl+Shift+W", function () {
    // A story that was being started when Omabook closed, or that stopped
    // on a problem, is picked up before a new one is begun.
    const unfinished = unfinishedStories()[0];
    if (unfinished) {
        omabook.say("Picking up the story that was being started…");
        return resume(unfinished.story);
    }
    return askReader("What are you in the mood for?", "A mood, a kind of story, a what-if. Leave empty to be surprised.")
        .then(function (wish) { return wish === null ? null : startStory(wish); });
});

command("story-next", "Storyteller: write the next chapter now", "reader", "Ctrl+Shift+N", function (context) {
    return nextChapter(context.book);
});

command("story-steer", "Storyteller: steer the story", "reader", "Ctrl+Shift+S", function (context) {
    own(context.book, "steered");
    return askReader("Where should the story go?", "Who to follow, what should happen, the tone, the pace…")
        .then(function (wish) { return wish ? steer(context.book, wish) : null; });
});

command("story-ask", "Storyteller: ask the author", "reader", "Ctrl+Shift+A", function (context) {
    own(context.book, "asked about this way");
    return askReader("Ask the author", "No spoilers, unless you ask for them in so many words.")
        .then(function (question) { return question ? askAuthor(context.book, question) : null; });
});

// Branching is for this plugin's stories only. The command has to be
// registered for the whole reader (a command can't be offered for some
// books and not others), so it refuses, in words, any other book; and
// `branch` below refuses again for whoever calls it another way.
command("story-branch", "Storyteller: branch the story from here", "reader", "Ctrl+Shift+B", function (context) {
    own(context.book, "branched");
    return askReader("How should it go differently from here?", "What changes from this chapter on.")
        .then(function (difference) { return difference === null ? null : branch(context.book, difference); });
});

command("story-sequel", "Storyteller: write a sequel in this world", "global", "Ctrl+Shift+E", function (context) {
    own(context.book, "followed by a sequel");
    return askReader("What should the sequel be about?", "Leave empty to let the world decide.")
        .then(function (wish) { return wish === null ? null : sequel(context.book, wish); });
});

// 3. What the reader does. The three reader events carry the same thing:
//    {id, generated, identifiers, section, sections, fraction, percent}.
omabook.on("book.opened", function (event) { return Reading.attend(event); });
omabook.on("page.turned", function (event) { return Reading.attend(event); });
omabook.on("book.closed", function () { Status.reading(null); });
omabook.on("app.started", function () {
    Status.refresh();
    if (unfinishedStories().length > 0)
        omabook.say("A story was being started when Omabook closed. \"Write me a story\" picks it up.");
});

// 4. Top-level functions. Each can be run from the command line:
//      omabook plugin run storyteller startStory '["a quiet mystery at sea"]'
//    and the panel calls some of them with backend.scripts.call.

// The story and the book for a book's number, or an Error that says why
// not. Everything that changes a book goes through here, so nothing in
// this plugin can touch a book it did not write. (The host refuses too:
// library.replaceFile and library.remove throw for any other book.)
function own(bookId, doing) {
    const book = omabook.library.get(bookId);
    if (!book)
        throw new Error(bookId ? "There is no book " + bookId + " in the library." : "Open one of Storyteller's stories first.");
    if (!Stories.mine(book))
        throw new Error("\"" + book.title + "\" was not written by Storyteller, so it can't be " + (doing || "changed")
                        + ". A book stays as its author wrote it; only Storyteller's own stories can be steered, continued or branched.");
    let story = Stories.ofBook(book);
    if (!story) {
        // The master copy is gone (a new computer, a cleared data folder).
        // Reading the book makes the format put it back; see storyfile.js.
        omabook.library.toc(book.id);
        story = Stories.ofBook(book);
    }
    if (!story)
        throw new Error("The story behind \"" + book.title + "\" can't be found.");
    return {book: book, story: story};
}

// Jobs other than a chapter of an existing book: a story, branch or sequel
// that has no book yet, and so nowhere to be noticed but here.
function unfinishedStories() {
    return Jobs.all().filter(function (job) {
        const state = Jobs.state(job.story);
        return job.kind !== "chapter" && (state === "interrupted" || state === "failed");
    });
}

function opened(made) {
    omabook.reader.open(made.book);
    Status.refresh();
    return made;
}

// Starts a story: builds its world, plans it, writes chapter one, adds the
// book and opens it. `wish` is what the reader is in the mood for; empty
// is "surprise me". A promise of {book, story, title, chapter, ...}.
function startStory(wish) {
    return Writer.start(wish).then(opened);
}

// Writes the next chapter now, whether or not the reader is near the end
// of what there is; this is "unless the reader asks".
function nextChapter(bookId) {
    const mine = own(bookId, "continued"), state = Jobs.state(mine.story.id);
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
    const mine = own(bookId, "steered");
    return Reading.steer(mine.book, mine.story, wish);
}

// Asks the author a question about the story so far. `spoilers` true (or
// asking for them in the question) lets the answer draw on the plan.
function askAuthor(bookId, question, spoilers) {
    const mine = own(bookId, "asked about this way");
    return Reading.ask(mine.book, mine.story, question, spoilers);
}

// Branches a story: a new book with the chapters up to the one the reader
// is in (or `chapter`, counted from 1), which goes its own way from there.
function branch(bookId, difference, chapter) {
    const mine = own(bookId, "branched");
    const upTo = Math.max(1, Math.min(mine.story.chapters.length, Number(chapter) || Reading.place(mine.book.id).section + 1));
    return Writer.fork(mine.story, mine.book.id, upTo, difference).then(opened);
}

// Starts a new story in the world of one that has ended.
function sequel(bookId, wish) {
    const mine = own(bookId, "followed by a sequel");
    if (!mine.story.ended)
        throw new Error("\"" + mine.story.title + "\" has not ended yet; a sequel follows an ending. You can branch it instead.");
    return Writer.sequel(mine.story, wish).then(opened);
}

// Picks up a story, branch or sequel that was cut off or that failed: the
// one named, or the first there is.
function resume(storyId) {
    const job = storyId ? Jobs.read(storyId) : unfinishedStories()[0] || Jobs.all()[0];
    if (!job)
        throw new Error("Nothing was left unfinished.");
    return Writer.run(job).then(function (made) { return job.kind === "chapter" ? made : opened(made); });
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
                ended: story.ended, lineage: story.lineage ? {kind: story.lineage.kind, story: story.lineage.story, chapter: story.lineage.chapter} : null,
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
    const mine = own(bookId, "looked into");
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

// For the panel, which can't wait for a promise: starts something and
// answers at once. What comes of it shows in the panel and at the bottom
// of the window.
function panel(action, bookId, text) {
    const actions = {steer: steer, ask: askAuthor, next: nextChapter, branch: branch, sequel: sequel};
    try {
        if (action === "askSpoilers")
            Promise.resolve(askAuthor(bookId, text, true)).then(null, tell);
        else if (actions[action])
            Promise.resolve(actions[action](bookId, text)).then(null, tell);
        else
            throw new Error("The panel asked for something unknown: " + action);
    } catch (error) {
        tell(error);
    }
    Status.refresh();
    return true;
}
