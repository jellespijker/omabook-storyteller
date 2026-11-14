// The originality rule, the mechanical half.
//
// A story may not reuse the characters, places and named things of existing
// books and authors. The prompts say so (prompts.js); this file checks it,
// as far as a program can: it collects the names the reader's library
// knows, and refuses a world or a chapter that uses one.
//
// What it catches: names. A character, place, group, item, series, book
// title or author from the general knowledge graph (and their other
// names), the titles, authors and series of the library's books, a short
// built-in list of names too famous to leave to chance, and whatever the
// reader added to the setting "forbidden_names".
//
// What it cannot catch: a borrowed plot, a scene, a magic system under a
// new name, a voice. Nor a name from a book the reader never added. Those
// rest on the rule in the prompt, and that is said in the README too.
var Originality = (function () {
    "use strict";

    // Kinds of node in the general graph whose names are somebody's
    // invention (or somebody's name). Themes, topics and tags are shared
    // ideas and stay free. Concepts and events count only when they are a
    // phrase ("the Long Night"), since "memory" or "the war" is nobody's.
    const NAMED = ["character", "place", "group", "item", "series", "book", "author"];
    const PHRASES_ONLY = ["concept", "event"];

    // Too famous to leave to the library having them. Kept short on
    // purpose: it is a backstop, not a catalogue.
    const BUILT_IN = [
        "Gandalf", "Frodo", "Bilbo", "Aragorn", "Sauron", "Mordor", "Middle-earth", "Hobbit", "Hogwarts", "Dumbledore",
        "Voldemort", "Hermione", "Muggle", "Narnia", "Aslan", "Westeros", "Targaryen", "Lannister", "Winterfell", "Arrakis",
        "Atreides", "Harkonnen", "Bene Gesserit", "Skywalker", "Darth Vader", "Jedi", "Tatooine", "Starfleet", "Vulcan",
        "Klingon", "Sherlock Holmes", "Moriarty", "Dracula", "Frankenstein", "Katniss", "Panem", "Discworld", "Ankh-Morpork",
        "Earthsea", "Cthulhu", "Arkham", "Gotham", "Wakanda", "Hyrule", "Pikachu", "Tardis", "Dalek", "Gollum", "Shire",
        "Rivendell", "Azkaban", "Quidditch", "Mistborn", "Allomancy", "Roshar", "Geralt", "Rivia", "Tyrion", "Daenerys"
    ];

    // Words that are names in some book and ordinary words in every book.
    // A single-word name from the library that is one of these is let go:
    // refusing every chapter with a "River" in it would help nobody.
    const COMMON = (
        "the a an and of in on at to for from with by north south east west city town village river lake sea ocean mountain hill forest wood woods "
        + "island harbour harbor port road street bridge tower castle keep hall house home inn market square temple church school academy guild "
        + "king queen prince princess lord lady duke baron captain doctor master mistress father mother brother sister uncle aunt son daughter "
        + "old young little big great black white red green blue grey gray brown gold golden silver iron stone rose lily ivy daisy violet hope faith "
        + "grace joy will may june april august summer winter autumn spring dawn dusk night day sun moon star storm rain snow wind fire water earth "
        + "sky light dark shadow death life love war peace time world empire kingdom republic council order company watch guard army fleet crown "
        + "throne sword ring book letter key door gate wall garden field farm mill hunter fisher smith baker cook miller carter mason shepherd "
        + "banks wells woods fields stone hill brook marsh ford park lane grant mark rob bill jack frank grace dean bishop pope knight page king "
        + "martin james john mary anna anne jane tom sam ben max leo eva emma alice clara ruth paul peter david daniel michael thomas robert "
        + "city one two three first last new long short high low deep far near end beginning story tale song man woman boy girl child people"
    ).split(" ");
    const common = {};
    COMMON.forEach(function (word) { common[word] = true; });

    // A name as it is looked for: without a leading article, without what
    // the graph adds in brackets to tell two books' Toms apart.
    function entry(name, source) {
        const shown = Util.text(name).replace(/\s*\([^)]*\)\s*$/, "").replace(/^(the|a|an)\s+/i, "").trim();
        const norm = Util.norm(shown);
        if (norm.length < 4)
            return null;
        const words = norm.split(" ");
        const single = words.length === 1;
        // A name made only of ordinary words ("The Old Road") is nobody's.
        if (words.every(function (word) { return common[word] || word.length < 3; }))
            return null;
        return {name: shown, norm: norm, single: single, source: source};
    }

    // The nodes of the general graph that came from this plugin's own
    // books. Omabook's graph grows from whatever is read, a story of ours
    // included, and a story may of course go on using its own names.
    function ownNodes() {
        const own = {books: {}, nodes: {}};
        omabook.library.list().filter(Stories.mine).forEach(function (book) {
            own.books[book.id] = true;
            omabook.graph.ofBook(book.id).nodes.forEach(function (node) { own.nodes[node.id] = true; });
        });
        return own;
    }

    // Every forbidden name, by its compared form. Collected once per run
    // of the script and again when a minute has passed, since it reads the
    // whole graph.
    let cache = null, cachedAt = 0;
    function forbidden() {
        if (cache && Date.now() - cachedAt < 60000)
            return cache;
        const names = {};
        function add(name, source) {
            const made = entry(name, source);
            if (made && !names[made.norm])
                names[made.norm] = made;
        }
        const own = ownNodes(), pen = Util.norm(Config.get("pen_name"));
        omabook.graph.whole("", 20000).nodes.forEach(function (node) {
            const phrasesOnly = PHRASES_ONLY.indexOf(node.kind) >= 0;
            // A story's own title is its own too: the graph has a node for
            // every book of the library, whoever wrote it.
            if ((NAMED.indexOf(node.kind) < 0 && !phrasesOnly) || own.nodes[node.id] || own.books[node.book] || Util.norm(node.name) === pen)
                return;
            [node.name].concat(Util.list((node.data || {}).aliases)).forEach(function (name) {
                const made = entry(name, node.kind);
                if (made && !(phrasesOnly && made.single) && !names[made.norm])
                    names[made.norm] = made;
            });
            // "Ursula K. Le Guin" also forbids "Le Guin": an author is
            // spoken of by surname. Short or ordinary surnames are let go.
            if (node.kind === "author") {
                const parts = Util.text(node.name).split(/\s+/);
                if (parts.length > 1)
                    add(parts[parts.length - 1], "author");
            }
        });
        // The library itself, for when the graph is off or behind.
        omabook.library.list().forEach(function (book) {
            if (Stories.mine(book))
                return;
            add(book.title, "book");
            add(book.series, "series");
            Util.list(book.authors).forEach(function (author) {
                add(author, "author");
                const parts = Util.text(author).split(/\s+/);
                if (parts.length > 1)
                    add(parts[parts.length - 1], "author");
            });
        });
        BUILT_IN.forEach(function (name) { add(name, "built in"); });
        Config.get("forbidden_names").forEach(function (name) {
            // What the reader forbids is forbidden, common word or not.
            const norm = Util.norm(name);
            if (norm)
                names[norm] = {name: Util.text(name), norm: norm, single: norm.indexOf(" ") < 0, source: "reader"};
        });
        Config.get("allowed_names").forEach(function (name) { delete names[Util.norm(name)]; });
        cache = names;
        cachedAt = Date.now();
        return names;
    }

    function forget() { cache = null; }

    // Whether the text before a word ends a sentence, so that the word's
    // capital letter says nothing about it being a name.
    function startsSentence(before) {
        const lead = before.replace(/[\s"'‘’“”*_#>(\[—–-]+$/, "");
        return lead === "" || /[.!?:…]$/.test(lead);
    }

    // The forbidden names used in running text.
    //
    // A phrase ("Vesper Quill") counts wherever it stands, in any case. A
    // single word ("Harrowgate") counts when it is written with a capital
    // in the middle of a sentence, which is how a name is written and an
    // ordinary word is not: "Rose opened the door" could be either, "he
    // gave Rose the key" is a name.
    function inText(text) {
        const names = forbidden(), hits = {}, plain = Util.text(text);
        const folded = Util.norm(plain);
        Object.keys(names).forEach(function (norm) {
            const name = names[norm];
            if (folded.indexOf(norm) < 0)
                return;
            if (!name.single) {
                if (Util.wholeWords(norm, "g").test(folded))
                    hits[norm] = name.name;
                return;
            }
            // Folding keeps the length of ordinary text, but not always of
            // accented text, so single words are looked for in the text as
            // written, by every spelling of them that folds to the name.
            const pattern = Util.wholeWords(norm, "gi");
            let found;
            const source = plain.normalize ? plain.normalize("NFKD").replace(/[̀-ͯ]/g, "") : plain;
            while ((found = pattern.exec(source)) !== null) {
                const at = found.index + found[1].length, word = found[2];
                if (word[0] !== word[0].toLowerCase() && !startsSentence(source.slice(Math.max(0, at - 80), at))) {
                    hits[norm] = name.name;
                    break;
                }
                pattern.lastIndex = at + word.length;
            }
        });
        return Object.keys(hits).map(function (norm) { return hits[norm]; });
    }

    // The forbidden names among names the model invented. Stricter than
    // running text, because here every word is meant as a name: "Harrowgate
    // Bridge" uses "Harrowgate" whatever its case or place.
    function inNames(invented) {
        const names = forbidden(), hits = {};
        invented.forEach(function (name) {
            const norm = Util.norm(name).replace(/^(the|a|an) /, "");
            Object.keys(names).forEach(function (taken) {
                if (norm === taken || (norm.indexOf(taken) >= 0 && Util.wholeWords(taken, "g").test(norm)))
                    hits[taken] = names[taken].name;
            });
        });
        return Object.keys(hits).map(function (norm) { return hits[norm]; });
    }

    // Every "name", "title" and alias in a JSON answer.
    function namesOf(value, into) {
        into = into || [];
        if (Array.isArray(value))
            value.forEach(function (item) { namesOf(item, into); });
        else if (value !== null && typeof value === "object")
            Object.keys(value).forEach(function (key) {
                if ((key === "name" || key === "title") && typeof value[key] === "string")
                    into.push(value[key]);
                else if (key === "aliases")
                    Util.list(value[key]).forEach(function (alias) { into.push(Util.text(alias)); });
                else
                    namesOf(value[key], into);
            });
        return into;
    }

    // The hits in a draft: a chapter ({title, text}) or a JSON answer.
    function hitsIn(draft) {
        const found = {};
        inNames(namesOf(draft)).concat(inText(Util.strings(draft).join("\n"))).forEach(function (hit) { found[Util.norm(hit)] = hit; });
        return Object.keys(found).map(function (norm) { return found[norm]; });
    }

    // A draft with names replaced. Whole words only, so renaming "Arlen"
    // leaves "Arlene" alone; a phrase in any case, a single word as a name.
    function renamed(draft, renames) {
        return Util.mapStrings(draft, function (words) {
            Object.keys(renames).forEach(function (old) {
                const bare = old.replace(/^(the|a|an)\s+/i, ""), single = bare.indexOf(" ") < 0;
                words = words.replace(Util.wholeWords(bare, "gi"), function (match, before, word) {
                    // "rose" in "she rose" is not the Rose being renamed.
                    return single && word[0] === word[0].toLowerCase() ? match : before + renames[old];
                });
            });
            return words;
        });
    }

    // A few words around each hit, for the model to see what it named.
    function context(draft, hits) {
        const words = Util.strings(draft).join("\n");
        return hits.map(function (hit) {
            const at = Util.norm(words).indexOf(Util.norm(hit));
            return "- " + hit + ": \"…" + words.slice(Math.max(0, at - 90), at + hit.length + 90).replace(/\s+/g, " ") + "…\"";
        }).join("\n");
    }

    const ROUNDS = 2;

    // Checks a draft and, when it uses forbidden names, has the model
    // rename them and checks again: at most twice, since a model that keeps
    // reaching for taken names will not stop on the third try. A promise of
    // {draft, renames}; it fails, with the names, when the draft still
    // collides, and the caller then publishes nothing.
    function cleaned(draft, what) {
        const all = {};
        function round(draft, left) {
            const hits = hitsIn(draft);
            if (hits.length === 0)
                return Promise.resolve({draft: draft, renames: all});
            if (left === 0) {
                const error = new Error("The " + what + " was not kept: it uses names that belong to existing books or authors ("
                                        + hits.join(", ") + "), and still did after " + ROUNDS + " tries at renaming them.");
                error.collisions = hits;
                return Promise.reject(error);
            }
            omabook.log("The " + what + " uses taken names: " + hits.join(", ") + ". Asking for new ones.");
            return Ai.json("rename", Prompts.rename(hits, context(draft, hits)), function (answer) {
                const renames = answer.renames;
                if (renames === null || typeof renames !== "object")
                    throw new Error("it has no \"renames\" object");
                const usable = {};
                hits.forEach(function (hit) {
                    const key = Object.keys(renames).filter(function (name) { return Util.norm(name).replace(/^(the|a|an) /, "") === Util.norm(hit); })[0];
                    const fresh = Util.text(key && renames[key]);
                    if (!fresh || Util.norm(fresh) === Util.norm(hit))
                        throw new Error("it gives no new name for \"" + hit + "\"");
                    usable[hit] = fresh;
                });
                return usable;
            }).then(function (renames) {
                Object.keys(renames).forEach(function (old) { all[old] = renames[old]; });
                return round(renamed(draft, renames), left - 1);
            });
        }
        return round(draft, ROUNDS);
    }

    // Text with every forbidden name taken out, for the taste profile:
    // what the reader likes may be told to the model, what it is called in
    // the books they read may not.
    function scrubbed(text) {
        const hits = inNames([text]).concat(inText(text));
        let words = Util.text(text);
        hits.forEach(function (hit) {
            words = words.replace(Util.wholeWords(hit, "gi"), function (match, before) { return before + "…"; });
        });
        return {text: words, hits: hits};
    }

    return {
        forbidden: forbidden, forget: forget, inText: inText, inNames: inNames, hitsIn: hitsIn, renamed: renamed,
        cleaned: cleaned, scrubbed: scrubbed, BUILT_IN: BUILT_IN
    };
})();
