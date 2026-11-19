// A story's world in a collection that is published or shared (#1).
//
// What goes, and why:
//
//   - Of a story, only its reader's graph, "world:<id>": what the chapters
//     have shown. Never the plan ("world:<id>:plan"), which holds every
//     secret and the plot still to come; the scope is the boundary here as
//     everywhere (see world.js).
//   - Only of a book Storyteller wrote. A book by a person has its graph in
//     the library's own graph, which Omabook shares (or not) by its own
//     rules; Storyteller never offers it, or anything made from it, as a
//     world. The originality rule stays: no world here holds anything of
//     a human author's book, so none can carry it to anyone else.
//   - With the collection's graph, since a world is part of the graph,
//     unless the reader keeps the story's world at home.
//   - The story's book itself, as a file, only when the reader says so for
//     that story: it is their own writing, and whoever gets it reads all
//     of it.
//
// What a world holds is marked as met in the story's book at the chapter
// that showed it (`sight`), so Omabook can cut it at the place of whoever
// reads it, as it cuts any graph it shares: nothing of a chapter they have
// not read. Someone it is shared with sees it as a layer, read-only; in a
// shared space where they are a writer, their Storyteller can start a new
// story in it (a copy of its own, as for "a new story in the world of one
// of yours"), and that story, with its world, goes into the space, so the
// others can read it and write on in it in turn. Nobody writes in anyone
// else's scope: each story keeps a world of its own.
//
// Omabook carries worlds from 0.1.7: `omabook.sharing.register` (what a
// collection takes of a plugin's), `omabook.graph.layers` (the worlds
// shared here) and `omabook.spaces.add` (a book into a shared space). With
// an Omabook that lacks them, worlds stay at home and nothing here fails.
var Sharing = (function () {
    "use strict";

    // A world of Storyteller's: one story's reader's graph.
    const WORLD = /^world:s[a-z0-9]+$/;

    function choiceOf(story) {
        const given = story.sharing || {};
        return {world: given.world !== false, file: given.file === true};
    }

    // What one book of a collection brings, or why it brings nothing.
    function offerOf(bookId, parts) {
        const book = omabook.library.get(Number(bookId));
        if (!book)
            return {left: {book: Number(bookId) || 0, title: "", why: "It is not in this library."}};
        const said = {book: book.id, title: book.title};
        if (!Stories.mine(book))
            return {left: Object.assign(said, {why: "Not written by Storyteller: a book by a person never goes as a world."})};
        const story = Stories.ofBook(book);
        if (!story)
            return {left: Object.assign(said, {why: "The story behind it can't be found."})};
        const choice = choiceOf(story);
        const world = parts.indexOf("graph") >= 0 && choice.world && WORLD.test(story.world.seen)
                      && omabook.graph.scopes().indexOf(story.world.seen) >= 0;
        if (!world && !choice.file)
            return {left: Object.assign(said, {why: !choice.world ? "You keep its world at home." : "Its world goes with the graph, which this collection doesn't share."})};
        return {world: Object.assign(said, {story: story.id, scope: world ? story.world.seen : "", file: choice.file})};
    }

    // What a collection of these books takes of Storyteller's, with these
    // parts ("graph", "questions", ...): {worlds: [{book, title, story,
    // scope, file}], left: [{book, title, why}]}.
    function plan(books, parts) {
        const made = {worlds: [], left: []};
        Util.list(books).forEach(function (bookId) {
            const one = offerOf(bookId, Util.list(parts));
            if (one.world)
                made.worlds.push(one.world);
            else
                made.left.push(one.left);
        });
        return made;
    }

    // Tells Omabook what a collection takes, where it can be told. It asks
    // with {space, kind, books, parts} and is answered the worlds and files.
    function register() {
        if (!omabook.sharing || typeof omabook.sharing.register !== "function")
            return false;
        omabook.sharing.register({
            worlds: function (context) { return plan((context || {}).books, (context || {}).parts).worlds; }
        });
        return true;
    }

    // Marks what the reader's graph holds as met in the story's book, at the
    // chapter that showed it (a thing from before the book, as a sequel's,
    // at its first). Done once for each chapter revealed. Answers whether
    // anything was marked.
    function sight(story, bookId) {
        const upTo = story.revealed || 0, from = Math.min(Number(story.sighted) || 0, upTo);
        if (!(bookId > 0) || upTo === from) {
            story.sighted = from;
            return false;
        }
        const scope = story.world.seen;
        omabook.graph.whole(scope, 5000).nodes.forEach(function (node) {
            const since = Number((node.data || {}).since) || 0;
            if (since > upTo || (from > 0 && since <= from))
                return;
            const thing = {scope: scope, kind: node.kind, name: node.name, book: bookId, section: Math.max(0, since - 1), fraction: 0};
            if (Util.text(node.summary))
                thing.summary = Util.text(node.summary);
            omabook.graph.upsert(thing);
        });
        story.sighted = upTo;
        return true;
    }

    // What goes of one story, after changing what is given: {world, file}.
    function choose(story, given) {
        const now = choiceOf(story);
        if (given && given.world !== undefined)
            now.world = given.world !== false;
        if (given && given.file !== undefined)
            now.file = given.file === true;
        story.sharing = now;
        Stories.save(story);
        return now;
    }

    function ask(story) {
        const now = choiceOf(story);
        return omabook.ui.form({
            title: "Sharing \"" + story.title + "\"", accept: "Done",
            intro: "When a collection that holds this story is published or shared, this is what goes of it. Its plan, with what is still to come, never goes.",
            fields: [
                {id: "world", type: "toggle", label: "Its world goes with the collection's graph", value: now.world,
                 help: "What you have been shown of it: each reader sees only as much as they have read themselves."},
                {id: "file", type: "toggle", label: "The story itself goes, as a file", value: now.file,
                 help: "It is your own writing. Whoever gets it can read all of it, and without it they see nothing of the world."}
            ]
        }).then(function (values) { return values ? choose(story, values) : null; });
    }

    // --- Worlds shared with the reader ---------------------------------------

    // Storyteller's worlds among the layers Omabook keeps of the spaces the
    // reader subscribes to or is in: {scope, space, kind, role, owner, title,
    // of, book}. `scope` is the layer's own name, which only Omabook writes.
    function layers() {
        if (!omabook.graph || typeof omabook.graph.layers !== "function")
            return [];
        return Util.list(omabook.graph.layers()).filter(function (layer) {
            return layer && layer.plugin === omabook.plugin.id && WORLD.test(Util.text(layer.of)) && Util.text(layer.scope);
        }).map(function (layer) {
            return {scope: layer.scope, space: Util.text(layer.space), kind: Util.text(layer.kind), role: Util.text(layer.role),
                    owner: Util.text(layer.owner), title: Util.text(layer.title) || "a shared story", of: layer.of, book: Number(layer.book) || 0};
        });
    }

    function layerOf(scope) {
        const found = layers().filter(function (layer) { return layer.scope === scope; })[0];
        if (!found)
            throw new Error("\"" + Util.text(scope) + "\" is not a world shared with you. One comes with a collection someone publishes or shares with you that holds a story of theirs.");
        return found;
    }

    // The story a new one in a shared world is made from, as Writer takes a
    // parent: the layer for both its graphs and nothing of its chapters.
    // Omabook has cut the layer at the reader's place already, so all of it
    // is taken: as revealed up to the last chapter anything in it is from.
    function standIn(layer, nodes) {
        const parent = Stories.blank(layer.of.slice("world:".length));
        parent.title = layer.title;
        parent.world = {seen: layer.scope, plan: layer.scope};
        parent.revealed = Math.max.apply(null, [0].concat(nodes.map(function (node) { return Number((node.data || {}).since) || 0; })));
        parent.layer = {space: layer.space, scope: layer.scope, owner: layer.owner};
        return parent;
    }

    // Starts a new story in a world shared with the reader: what they know
    // of it is copied into the new story's own two graphs, and the plot is
    // new. A promise of what was made; with `share` (the default) and the
    // reader a writer of the space, the new story goes into it.
    function writeIn(scope, wish, skills, length, share) {
        const layer = layerOf(scope), nodes = omabook.graph.whole(layer.scope, 5000).nodes;
        if (nodes.length === 0)
            throw new Error("You know nothing of the world of \"" + layer.title + "\" yet: it opens as you read the story"
                            + (layer.book ? "." : ", which isn't in your library. Ask " + (layer.owner || "whoever shared it") + " to share the story itself."));
        return Writer.inWorld(standIn(layer, nodes), 0, wish, skills, length).then(function (made) {
            return share === false ? made : giveBack(made, layer);
        });
    }

    // Puts a story written in a shared world into that space, as its writer:
    // Omabook signs it and checks the role. A reader keeps it at home.
    function giveBack(made, layer) {
        if (layer.kind !== "shared" || layer.role !== "writer") {
            omabook.say("\"" + made.title + "\" is yours, here; the world it is in was shared with you to read.");
            return Object.assign(made, {shared: false});
        }
        if (!omabook.spaces || typeof omabook.spaces.add !== "function") {
            omabook.say("\"" + made.title + "\" is yours, here; this Omabook can't put it in the space yet.");
            return Object.assign(made, {shared: false});
        }
        omabook.spaces.add(layer.space, made.book);
        omabook.say("\"" + made.title + "\" is in the space now, with its world, for its members to read and write on in.");
        return Object.assign(made, {shared: true});
    }

    // Asks which shared world, and what the new story should be.
    function askWorld() {
        const here = layers();
        if (here.length === 0)
            throw new Error("No world has been shared with you yet. One comes with a collection someone publishes or shares with you that holds a story of theirs.");
        return omabook.ui.form({
            title: "Write in a world shared with you", accept: "Start Writing",
            intro: "A new story in that world, as far as you know it: nothing of what you haven't read is used, and its own plot is new.",
            fields: [
                {id: "scope", type: "choice", label: "Which world?", value: here[0].scope, choices: here.map(function (layer) {
                    return {value: layer.scope, label: layer.title, help: "Shared by " + (layer.owner || "someone") + (layer.role === "writer" ? "; you write in this space." : "; you read this space.")};
                })},
                {id: "wish", type: "textarea", label: "What should it be?", placeholder: "Leave it empty to let the world decide."},
                {id: "share", type: "toggle", label: "Put it in the space when it is written", value: true,
                 help: "Only in a shared space you write in. Its world goes with it; the story itself goes only if you choose so later."}
            ]
        });
    }

    return {plan: plan, register: register, sight: sight, choose: choose, ask: ask, layers: layers, writeIn: writeIn, askWorld: askWorld};
})();
