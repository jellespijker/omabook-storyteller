// Removing a story: its book (to the trash), its two graphs, its working
// copy and whatever of it is still being written; asked first, saying what
// goes. A world shared with other stories is kept for them unless the
// reader says otherwise.
var Removal = (function () {
    "use strict";

    // Stories removed by this plugin, whose book.removed is its own doing.
    const removing = {};

    // The story a book's number, or a story's id, is.
    function storyFor(target) {
        if (typeof target === "string" && Stories.exists(target))
            return Stories.load(target);
        return Stories.own(Number(target), "removed").story;
    }

    // The other stories that share a world with this one: what it was made
    // from, and what was made from it, all the way along. Each has a world of
    // its own copy, so removing one never breaks another; the reader decides
    // whether the world goes with all of them.
    function family(story) {
        const all = Stories.all(), byId = {};
        all.forEach(function (one) { byId[one.id] = one; });
        const found = {}, queue = [story.id];
        found[story.id] = true;
        while (queue.length > 0) {
            const id = queue.shift(), one = byId[id];
            const near = all.filter(function (other) { return other.lineage && other.lineage.story === id; }).map(function (other) { return other.id; });
            if (one && one.lineage && byId[one.lineage.story])
                near.push(one.lineage.story);
            near.forEach(function (other) {
                if (!found[other]) {
                    found[other] = true;
                    queue.push(other);
                }
            });
        }
        return all.filter(function (one) { return found[one.id] && one.id !== story.id; }).map(function (one) {
            const book = Stories.bookOf(one);
            const kind = one.lineage && one.lineage.story === story.id ? one.lineage.kind
                       : story.lineage && story.lineage.story === one.id ? "parent" : "related";
            return {story: one.id, title: one.title, book: book ? book.id : 0, relation: kind};
        });
    }

    // What removing a story takes away, without taking it.
    function plan(target) {
        const story = storyFor(target), book = Stories.bookOf(story);
        return {story: story.id, title: story.title, book: book ? book.id : 0, scopes: [story.world.seen, story.world.plan],
                files: [Stories.path(story.id)].concat(Jobs.read(story.id) ? ["data/jobs/" + story.id + ".json"] : []),
                family: family(story)};
    }

    // Nothing is removed while any of it is being written.
    function refuseWhileWriting(going, title) {
        Jobs.all().forEach(function (job) {
            const state = Jobs.state(job.story);
            if (state !== "running" && state !== "elsewhere")
                return;
            if (going.indexOf(job.story) >= 0)
                throw new Error("\"" + (Stories.exists(job.story) ? Stories.load(job.story).title : title) + "\" is being written right now; remove it once that is done.");
            if (job.parent && going.indexOf(job.parent) >= 0)
                throw new Error("A story is being made from \"" + title + "\" right now; remove it once that is done.");
        });
    }

    // Removes a story: its book (to the trash), its two graphs, its working
    // copy and anything of it unfinished. With {world: "all"}, every story that
    // shares its world goes as well; otherwise ("keep", the default) only this
    // one, and the others keep their own copy of the world. What was removed.
    function remove(target, options) {
        const planned = plan(target), all = options && options.world === "all";
        const going = [planned.story].concat(all ? planned.family.map(function (one) { return one.story; }) : []);
        refuseWhileWriting(going, planned.title);
        const removed = going.map(function (id) {
            const story = Stories.load(id), book = Stories.bookOf(story);
            removing[id] = true;
            if (book)
                omabook.library.remove(book.id);
            World.drop(story);
            Jobs.clear(id);
            omabook.files.remove(Stories.path(id));
            return {story: id, title: story.title, book: book ? book.id : 0};
        });
        const kept = all ? [] : planned.family;
        Status.refresh();
        omabook.say(removed.length === 1 ? "\"" + planned.title + "\" is removed, with its world." + (kept.length ? " The stories that share it keep theirs." : "")
                                         : removed.length + " stories are removed, with the world they shared.");
        return {removed: removed, kept: kept};
    }

    function names(stories) {
        return stories.map(function (one) { return "\"" + one.title + "\""; }).join(", ");
    }

    // Asks before removing, saying what goes.
    function confirm(bookId) {
        const planned = plan(bookId), fields = [];
        if (planned.family.length > 0)
            fields.push({id: "world", type: "choice", label: "Its world is shared with " + names(planned.family), value: "keep", choices: [
                {value: "keep", label: "Remove only this story", help: "The others keep their own copy of the world and go on as they are."},
                {value: "all", label: "Remove the world with every story in it", help: "Also goes, with its book: " + names(planned.family) + "."}]});
        return omabook.ui.form({
            title: "Remove \"" + planned.title + "\"?", accept: "Remove", fields: fields,
            intro: "The book goes to the trash, and its world goes for good: the two graphs Storyteller keeps of it (what you know, and the author's plan), its working copy, and anything of it still unfinished. No other book is touched."
        }).then(function (values) { return values ? remove(bookId, {world: values.world || "keep"}) : null; });
    }

    // After Omabook's own Remove took a story's book. The reader is asked
    // once whether its world and working copy should go too; the answer that
    // loses nothing is the one taken when they leave the question.
    function afterRemoval(book) {
        const id = (book.identifiers || {}).storyteller;
        if (!Stories.mine(book) || !id)
            return null;
        if (removing[id] || !Stories.exists(id)) {
            delete removing[id];
            return null;
        }
        const story = Stories.load(id), related = family(story);
        const choices = [{value: "keep", label: "Keep them", help: "Put the book back from the trash, and the story goes on where it was."},
                         {value: "story", label: "Remove its world and working copy too",
                          help: related.length ? "The stories that share the world (" + names(related) + ") keep their own copy." : "They go for good."}];
        if (related.length > 0)
            choices.push({value: "all", label: "Remove the world with every story in it", help: "Also goes, with its book: " + names(related) + "."});
        return omabook.ui.form({
            title: "\"" + story.title + "\" went to the trash", accept: "Done",
            intro: "Storyteller still keeps its world and its working copy, so the story can go on if you put the book back.",
            fields: [{id: "world", type: "choice", label: "Its world", value: "keep", choices: choices}]
        }).then(function (values) {
            if (!values || values.world === "keep" || !Stories.exists(id))
                return null;
            return remove(id, {world: values.world === "all" ? "all" : "keep"});
        });
    }

    return {plan: plan, remove: remove, confirm: confirm, afterRemoval: afterRemoval, family: family};
})();
