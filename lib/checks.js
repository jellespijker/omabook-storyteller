// What a program can count in a draft, before a model reads it: the stock
// phrases, phrases a chapter repeats, phrases it takes over from the end of
// the chapter before, the motifs a model keeps returning to, and length.
// These cost nothing and are exact, so they are handed to the revise pass
// as facts ("'the weight of' three times") rather than left for the model
// to notice. And the motifs of the reader's earlier stories are found
// here, so a new story can be told what not to drift back into.
var Checks = (function () {
    "use strict";

    // Words that say nothing about what a story is made of.
    const STOP = (
        "the a an and or but if then so of in on at to for from with by as into onto over under about after before than "
        + "is was were be been being am are has had have do did does not no nor it its it's this that these those there "
        + "here he she they them his her their hers him we us our you your i me my mine who whom whose which what when "
        + "where why how all any each every some such one two three only own same other more most much many few very "
        + "can could would should will shall may might must just still even back down up out off again once now then "
        + "said says say asked told know knew think thought looked look looking went go going came come get got made make "
        + "like way thing things something nothing anything everything time times day days night long little old new "
        + "first last next too also well yes because while through against between without within around across toward "
        + "towards along behind beside upon until till never always ever already enough rather quite almost away left "
        + "right hand hands eyes face head voice door room man woman men women people chapter house dark dead another cold "
        + "light water ground words word mouth body small great half side place morning evening open turned felt began held "
        + "kept took round under above below over full empty last next "
        + "something someone anyone nobody everyone each other own whole hard soft high low top bottom inside outside "
        + "year years").split(" ");
    const stop = {};
    STOP.forEach(function (word) { stop[word] = true; });

    function words(text) { return Util.norm(text).match(/[a-zà-ɏ']+/g) || []; }

    function count(text, phrase) {
        const found = Util.norm(text).match(Util.wholeWords(Util.norm(phrase), "g"));
        return found ? found.length : 0;
    }

    // The stock phrases in a text, with how often each appears.
    function stock(text) {
        return Prompts.STOCK.map(function (phrase) { return {phrase: phrase, count: count(text, phrase.replace(/[,]$/, ""))}; })
            .filter(function (hit) { return hit.count > 0; });
    }

    // Runs of `size` words that a text uses `least` times or more, leaving
    // out runs made only of little words.
    function grams(list, size) {
        const seen = {};
        for (let index = 0; index + size <= list.length; index += 1) {
            const run = list.slice(index, index + size);
            if (run.filter(function (word) { return !stop[word]; }).length < 2)
                continue;
            const key = run.join(" ");
            seen[key] = (seen[key] || 0) + 1;
        }
        return seen;
    }

    function repeats(text) {
        const seen = grams(words(text), 3);
        return Object.keys(seen).filter(function (key) { return seen[key] >= 3; })
            .sort(function (a, b) { return seen[b] - seen[a]; }).slice(0, 8).map(function (key) { return {phrase: key, count: seen[key]}; });
    }

    // Four-word runs the draft shares with the end of the chapter before:
    // a model picking up a voice tends to pick up its sentences too.
    function echoes(text, before) {
        if (!before)
            return [];
        const old = grams(words(before), 4), now = grams(words(text), 4);
        return Object.keys(now).filter(function (key) { return old[key]; }).slice(0, 8);
    }

    // The overused motifs a text leans on: a word of the list that comes
    // up three times or more.
    const MOTIF_WORDS = ["tide", "tides", "ledger", "ledgers", "tally", "tallies", "clerk", "clerks", "archive", "archivist", "cartographer",
                         "lighthouse", "lantern", "lanterns", "bell", "bells", "salt", "brine", "glass", "ink", "moth", "moths", "quince",
                         "loom", "weaver", "thread", "threads", "drowned", "ferry", "ferryman", "fog", "ash",
                         "clockmaker", "clockwork", "librarian", "keeper"];
    function motifs(text) {
        const all = words(text), counts = {};
        all.forEach(function (word) {
            if (MOTIF_WORDS.indexOf(word) >= 0)
                counts[word] = (counts[word] || 0) + 1;
        });
        return Object.keys(counts).filter(function (word) { return counts[word] >= 3; }).map(function (word) { return {word: word, count: counts[word]}; });
    }

    // What a draft is to be told about itself, as lines for the revise
    // prompt, and the same as data for the chapter's record.
    function findings(draft, before, words, world) {
        const text = draft.text, length = Util.wordCount(text);
        const found = {words: length, stock: stock(text), repeats: repeats(text), echoes: echoes(text, before),
                       motifs: motifs(text).filter(function (motif) { return Util.norm(world || "").indexOf(motif.word) < 0; })};
        const lines = ["- Length: " + length + " words, where about " + words + " were asked for."];
        if (found.stock.length)
            lines.push("- Stock phrases, every one to go: " + found.stock.map(function (hit) { return "\"" + hit.phrase + "\" (" + hit.count + ")"; }).join(", ") + ".");
        if (found.repeats.length)
            lines.push("- Phrases used three times or more: " + found.repeats.map(function (hit) { return "\"" + hit.phrase + "\" (" + hit.count + ")"; }).join(", ") + ".");
        if (found.echoes.length)
            lines.push("- Phrases taken over from the end of the chapter before: " + found.echoes.map(function (hit) { return "\"" + hit + "\""; }).join(", ") + ".");
        if (found.motifs.length)
            lines.push("- Overused motifs that are not part of this book's world: " + found.motifs.map(function (hit) { return hit.word + " (" + hit.count + ")"; }).join(", ") + ".");
        found.text = lines.join("\n");
        return found;
    }

    // The words a set of earlier stories leaned on most: content words
    // that run through several chapters of several of them, without the
    // stories' own names. A model that wrote of tides and ledgers last
    // time reaches for them again; told, it reaches elsewhere.
    function leanedOn(stories, most) {
        const inStories = {}, total = {};
        stories.forEach(function (story) {
            const own = {}, names = {};
            World.index(story.world.plan).nodes.forEach(function (node) { words(node.name).forEach(function (word) { names[word] = true; }); });
            story.chapters.forEach(function (chapter) {
                words(chapter.title + " " + chapter.text).forEach(function (word) {
                    if (word.length < 4 || stop[word] || names[word] || /'/.test(word))
                        return;
                    own[word] = (own[word] || 0) + 1;
                });
            });
            Object.keys(own).forEach(function (word) {
                if (own[word] >= 4) {
                    inStories[word] = (inStories[word] || 0) + 1;
                    total[word] = (total[word] || 0) + own[word];
                }
            });
        });
        return Object.keys(total).sort(function (a, b) { return inStories[b] - inStories[a] || total[b] - total[a]; }).slice(0, most || 14);
    }

    return {stock: stock, repeats: repeats, echoes: echoes, motifs: motifs, findings: findings, leanedOn: leanedOn, count: count};
})();
