// The story file: one JSON file per story, with the extension .story.
//
// It is the whole truth about a story, so that nothing has to be remembered
// between two runs of the script: a story half written when Omabook quit is
// picked up from this file (and from the job beside it, see jobs.js).
//
//   {
//     "format": "omabook-story", "version": 1,
//     "id": "smb1x2k3a",                    also names its files and graphs
//     "title": "...", "author": "Storyteller", "language": "English",
//     "created": "...", "updated": "...",
//     "premise": {"wish": what the reader asked for, "logline", "genre",
//                 "tone", "voice", "blurb"},
//     "world":   {"seen": "world:<id>", "plan": "world:<id>:plan"},
//     "lineage": null, or {"kind": "fork" | "sequel" | "world", "story":
//                 parent id, "title": parent title, "chapter": the last
//                 chapter the two share (for "world", the last the reader
//                 had read of the other: what the two may both draw on),
//                 "difference": what the reader asked for},
//     "length":  {"chapters", "words"} when they were chosen for this story
//                and not left to the settings,
//     "plan":    {"chapters": how many are planned,
//                 "beats": [{"chapter", "title", "pov", "goal", "events",
//                            "seeds", "turn"}]},      what is still to come
//     "chapters": [{"number", "title", "text" (Markdown), "written",
//                   "summary", "record": what the chapter established}],
//     "steering": [{"at", "chapter", "text", "applied"}],
//     "asked":    [{"at", "chapter", "question", "answer", "spoilers"}],
//     "revealed": how many chapters' facts are in the "seen" graph,
//     "reached":  the furthest chapter the reader has been in,
//     "cost":     {"calls", "sent", "received"}: requests made for this
//                 story, and characters sent and received,
//     "ended":    true once the last planned chapter is written
//   }
//
// The master copy is data/stories/<id>.story, in the plugin's own folder;
// the library holds a copy, made with library.create and renewed with
// library.replaceFile. Which book a story is, is kept with the book (the
// identifier "storyteller"), because a book's number means something in
// one library only.
var Stories = (function () {
    "use strict";

    const FORMAT = "omabook-story", VERSION = 1, FOLDER = "data/stories";

    function path(id) { return FOLDER + "/" + id + ".story"; }

    function blank(id) {
        return {
            format: FORMAT, version: VERSION, id: id, title: "", author: Config.get("pen_name"), language: Config.get("language"),
            created: Util.now(), updated: Util.now(),
            premise: {wish: "", logline: "", genre: "", tone: "", voice: "", blurb: ""},
            world: {seen: "world:" + id, plan: "world:" + id + ":plan"},
            lineage: null,
            plan: {chapters: 0, beats: []},
            chapters: [], steering: [], asked: [], revealed: 0, reached: 0, ended: false,
            // The skills it is written with (snapshots, see skills.js), and
            // when they were chosen or changed.
            skills: [], skillLog: []
        };
    }

    // Says what is wrong with a story, by throwing; answers it when nothing
    // is. Run before every write, so a story file is never left in a shape
    // that can't be read back.
    function valid(story) {
        function need(condition, what) {
            if (!condition)
                throw new Error("This is not a story Storyteller can read: " + what + ".");
        }
        need(story !== null && typeof story === "object", "it is not a JSON object");
        need(story.format === FORMAT, "its format is not \"" + FORMAT + "\"");
        need(story.version === VERSION, "it is version " + story.version + ", and this plugin reads version " + VERSION);
        need(typeof story.id === "string" && /^[a-z0-9]{4,40}$/.test(story.id), "it has no proper id");
        need(typeof story.title === "string", "it has no title");
        need(story.world && typeof story.world.seen === "string" && typeof story.world.plan === "string", "it names no world");
        need(story.plan && Array.isArray(story.plan.beats), "it has no plan");
        need(Array.isArray(story.chapters), "it has no list of chapters");
        story.chapters.forEach(function (chapter, index) {
            need(chapter && typeof chapter.title === "string" && typeof chapter.text === "string" && chapter.text.trim() !== "",
                 "chapter " + (index + 1) + " has no words");
        });
        need(Array.isArray(story.steering) && Array.isArray(story.asked), "it has no steering log");
        return story;
    }

    function parse(words) {
        let story;
        try {
            story = JSON.parse(words);
        } catch (error) {
            throw new Error("This is not a story Storyteller can read: it is not JSON (" + error.message + ").");
        }
        return valid(story);
    }

    function exists(id) { return omabook.files.exists(path(id)); }

    function load(id) {
        const words = omabook.files.read(path(id));
        return words === null ? null : parse(words);
    }

    // Writes the master copy. The host writes a file whole or not at all
    // (to a temporary file, then renamed), so a crash never leaves half.
    function save(story) {
        story.updated = Util.now();
        if (!omabook.files.write(path(valid(story).id), JSON.stringify(story, null, 1)))
            throw new Error("The story could not be written to " + path(story.id) + ".");
        return story;
    }

    function all() {
        return omabook.files.list(FOLDER).filter(function (name) { return /\.story$/.test(name); }).map(function (name) {
            try { return load(name.replace(/\.story$/, "")); } catch (error) { return null; }
        }).filter(Boolean);
    }

    // The book as Omabook's reader wants it: this is all a format is. One
    // section per chapter and nothing else, so "section 3" is "chapter 4"
    // everywhere in this plugin. The plan and the log are not chapters, so
    // the reader, search and the AI companion never see them.
    function book(story) {
        // Before chapter one there is still a book, so the reader can see
        // which one it is and how far the writing has got: one page that
        // says so, replaced by the first chapter when it is ready.
        if (story.chapters.length === 0) {
            const lines = ["# " + (story.title || "A new story"), ""];
            if (story.premise.logline)
                lines.push("*" + story.premise.logline + "*", "");
            if (story.premise.wish)
                lines.push("You asked for: " + story.premise.wish, "");
            lines.push("This book is being written for you." + (story.writing ? " Now: " + story.writing : ""), "",
                       "Chapter one appears on this page by itself when it is ready, which takes a few minutes. "
                       + "You can close the book meanwhile; the writing goes on.");
            return {
                title: story.title || "A new story",
                authors: [story.author || "Storyteller"],
                description: describe(story),
                tags: ["storyteller"],
                chapters: [{title: "Being written", markdown: lines.join("\n")}]
            };
        }
        const last = story.chapters.length - 1;
        return {
            title: story.title,
            authors: [story.author || "Storyteller"],
            description: describe(story),
            tags: ["storyteller"].concat(story.premise.genre ? [story.premise.genre.toLowerCase()] : []),
            chapters: story.chapters.map(function (chapter, index) {
                let words = "# " + chapter.title + "\n\n" + chapter.text.trim();
                if (index === last && story.ended)
                    words += "\n\n* * *\n\n*The end. You can ask for a sequel in this world, or go back and branch the story from any chapter.*";
                return {title: chapter.title, markdown: words};
            })
        };
    }

    function describe(story) {
        const parts = [story.premise.blurb || story.premise.logline || (story.premise.wish ? "Being written: " + story.premise.wish : "")];
        if (story.lineage && story.lineage.kind === "fork")
            parts.push("A branch of \"" + story.lineage.title + "\" from chapter " + story.lineage.chapter + ".");
        if (story.lineage && story.lineage.kind === "sequel")
            parts.push("A sequel to \"" + story.lineage.title + "\".");
        if (story.lineage && story.lineage.kind === "world")
            parts.push("A story in the world of \"" + story.lineage.title + "\".");
        parts.push("Written by the Storyteller plugin with AI, for one reader.");
        return parts.filter(Boolean).join(" ");
    }

    function mine(bookOrEvent) { return !!bookOrEvent && bookOrEvent.generated === omabook.plugin.id; }

    // The story a book (or a reader event, which carries the same fields)
    // is, or null: for a book that is not this plugin's, always null.
    function ofBook(bookOrEvent) {
        if (!mine(bookOrEvent))
            return null;
        const id = (bookOrEvent.identifiers || {}).storyteller;
        return id && exists(id) ? load(id) : null;
    }

    // The book of the open library that a story is, or null.
    const known = {};
    function bookOf(story) {
        function is(book) { return !!book && mine(book) && (book.identifiers || {}).storyteller === story.id; }
        if (known[story.id] && is(omabook.library.get(known[story.id])))
            return omabook.library.get(known[story.id]);
        const found = omabook.library.list().filter(is)[0];
        known[story.id] = found ? found.id : 0;
        return found ? omabook.library.get(found.id) : null;
    }

    // Puts the story in the library: a new book the first time, a new
    // version of its file after that. The master copy is written first, so
    // a failure here loses nothing and the next try publishes it.
    function publish(story) {
        save(story);
        const has = bookOf(story);
        if (has) {
            omabook.library.replaceFile(has.id, path(story.id));
            // The title is only known once the world is built, after the
            // book was already made.
            const told = book(story);
            if (story.title && (has.title !== told.title || has.description !== told.description))
                omabook.library.setMeta(has.id, {title: told.title, description: told.description, tags: told.tags});
            return omabook.library.get(has.id);
        }
        const made = omabook.library.create({
            title: story.title || "A new story", authors: [story.author], description: describe(story),
            tags: book(story).tags
        }, path(story.id));
        if (!made)
            throw new Error("The story could not be added to the library.");
        omabook.library.setIdentifier(made.id, "storyteller", story.id);
        known[story.id] = made.id;
        return omabook.library.get(made.id);
    }

    // The format. `open` must answer at once, which suits a story: it is
    // one JSON file. A story whose master copy is gone (the plugin's data
    // folder was lost, or the library came from another computer) gets it
    // back from the library's copy here, so it can be continued.
    function register() {
        omabook.format.register({
            name: "Storyteller story",
            extensions: ["story"],
            open: function (source) {
                const file = source.entries().filter(function (name) { return /\.story$/i.test(name); })[0] || source.entries()[0];
                const words = file ? source.text(file) : null;
                if (words === null)
                    throw new Error("There is no story in " + source.name + ".");
                const story = parse(words);
                if (!exists(story.id))
                    omabook.files.write(path(story.id), words);
                return book(story);
            }
        });
    }

    return {
        path: path, blank: blank, valid: valid, parse: parse, exists: exists, load: load, save: save, all: all,
        book: book, mine: mine, ofBook: ofBook, bookOf: bookOf, publish: publish, register: register
    };
})();
