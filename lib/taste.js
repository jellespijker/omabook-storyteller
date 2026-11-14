// What the reader likes, as abstractions: taste, not content.
//
// The general knowledge graph knows what the reader read, how they rated
// it, the themes and ideas those books turn on and what the reader asked
// about. A new story should suit that reader, and must not be made of
// those books. So what leaves this file is a short text of kinds of thing
// (genres, themes, subjects, kinds of question) with every name the
// library knows taken out of it. No title, author, character, place or
// plot is ever handed to the model, and no invention either: a book's
// magic system or technology is left out even as a description, since
// "a language that cannot say a lie" is its author's idea however it is
// worded.
var Taste = (function () {
    "use strict";

    const MOST_BOOKS = 80;

    function count(into, key, weight) {
        key = Util.text(key).toLowerCase();
        if (key)
            into[key] = (into[key] || 0) + weight;
    }

    function top(counts, most) {
        return Object.keys(counts).filter(function (key) { return counts[key] > 0; })
            .sort(function (a, b) { return counts[b] - counts[a] || (a < b ? -1 : 1); }).slice(0, most);
    }

    // A real-world topic is fine ("tidal mechanics"); a work or a person
    // somebody alluded to ("The Odyssey", "Homer") is a name. Without a
    // catalogue of the world, capitals past the first word are the tell.
    function looksLikeAName(words) {
        return /.[A-Z\u00C0-\u00DE]/.test(Util.text(words));
    }

    function profile() {
        const books = omabook.library.list().filter(function (book) { return !Stories.mine(book); });
        const liked = {}, disliked = {}, likedThemes = {}, dislikedThemes = {}, topics = {};
        const questions = [];
        let rated = 0, finished = 0;

        const weighed = [];
        books.forEach(function (book) {
            const read = book.status === "read" || book.finished || book.percent_read >= 90;
            // Stars say most; a book finished unrated still says "this
            // held me".
            let weight = 0;
            if (book.rating >= 4) weight = book.rating - 2;
            else if (book.rating > 0 && book.rating <= 2) weight = book.rating - 3;
            else if (book.rating === 3) weight = 0.5;
            else if (read) weight = 1;
            if (book.rating > 0) rated += 1;
            if (read) finished += 1;
            if (weight === 0)
                return;
            Util.list(book.tags).forEach(function (tag) { count(weight > 0 ? liked : disliked, tag, Math.abs(weight)); });
            weighed.push({book: book, weight: weight});
        });

        // The graph is asked about the books that say most, and not about
        // all of a large library: this runs inside one five-second call.
        weighed.sort(function (a, b) { return Math.abs(b.weight) - Math.abs(a.weight) || (a.book.added < b.book.added ? 1 : -1); });
        weighed.slice(0, MOST_BOOKS).forEach(function (entry) {
            const weight = entry.weight;
            omabook.graph.ofBook(entry.book.id).nodes.forEach(function (node) {
                if (node.kind === "theme")
                    count(weight > 0 ? likedThemes : dislikedThemes, node.name, Math.abs(weight));
                else if (node.kind === "topic" && weight > 0 && !looksLikeAName(node.name))
                    count(topics, node.name, weight);
                else if (node.kind === "question")
                    questions.push(Util.clip((node.data || {}).asked || node.name, 140));
            });
        });

        const lines = [];
        function line(label, items) {
            // Anything that still carries a name of the library goes, whole.
            const clean = items.filter(function (item) { return Originality.scrubbed(item).hits.length === 0; })
                .map(function (item) { return item.replace(/[.;\s]+$/, ""); });
            if (clean.length > 0)
                lines.push(label + ": " + clean.join("; ") + ".");
        }
        line("Kinds of book they rate highly or finish", top(liked, 8));
        line("Kinds of book they rated low or gave up on", top(disliked, 5));
        line("Themes that run through the books they liked", top(likedThemes, 10));
        line("Themes of the books they did not like", top(dislikedThemes, 5));
        line("Real-world subjects they enjoy meeting in a book", top(topics, 8));
        line("Kinds of thing they stop to ask about while reading", questions.slice(-5));

        if (lines.length === 0)
            return "Nothing is known of this reader's taste yet. Choose freely.";
        lines.push("(" + books.length + " books in the library, " + finished + " read, " + rated + " rated.)");
        // One more pass over the whole, in case a name hid in a sentence.
        return Util.clip(Originality.scrubbed(lines.join("\n")).text, 1800);
    }

    return {profile: profile};
})();
