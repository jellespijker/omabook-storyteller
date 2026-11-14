// Small helpers every other file uses.
//
// A script plugin has no modules: `omabook.include("lib/util.js")` runs a
// file in the one engine the plugin has. So each file here makes exactly
// one global with `var`, holding its functions, and main.js includes them
// in the order they build on each other.
var Util = (function () {
    "use strict";

    // A story's id: short, sortable by when it was made, and safe in a file
    // name and in a graph scope ("world:<id>").
    function id() {
        return "s" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    }

    function now() { return new Date().toISOString(); }

    function list(value) { return Array.isArray(value) ? value : []; }

    function text(value) {
        if (value === null || value === undefined)
            return "";
        if (Array.isArray(value))
            return value.map(text).filter(Boolean).join("; ");
        return String(value).trim();
    }

    // At most `room` characters, cut at a word, with an ellipsis.
    function clip(words, room) {
        words = text(words);
        if (words.length <= room)
            return words;
        const cut = words.slice(0, room);
        const space = cut.lastIndexOf(" ");
        return (space > room * 0.6 ? cut.slice(0, space) : cut) + "…";
    }

    // The last `room` characters of a chapter, starting at a paragraph, so
    // the model picks the voice up where the page left it.
    function tail(words, room) {
        words = text(words);
        if (words.length <= room)
            return words;
        const cut = words.slice(words.length - room);
        const paragraph = cut.indexOf("\n\n");
        return paragraph >= 0 && paragraph < room * 0.5 ? cut.slice(paragraph + 2) : cut;
    }

    function wordCount(words) {
        const found = text(words).match(/\S+/g);
        return found ? found.length : 0;
    }

    // A name as it is compared: lower case, accents dropped, quotes and
    // dashes evened out. "Élan d'Or" and "elan d’or" are the same name.
    function norm(name) {
        let plain = text(name).toLowerCase();
        if (plain.normalize)
            plain = plain.normalize("NFKD").replace(/[̀-ͯ]/g, "");
        return plain.replace(/[‘’ʼ]/g, "'").replace(/[‐-―]/g, "-").replace(/\s+/g, " ").trim();
    }

    // The JSON object in a model's answer. Models wrap JSON in a code fence
    // or a sentence often enough that taking the outermost braces is the
    // dependable way to read it. Throws when there is none.
    function parseJson(answer) {
        const words = text(answer);
        const first = words.indexOf("{"), last = words.lastIndexOf("}");
        if (first < 0 || last <= first)
            throw new Error("The answer holds no JSON object.");
        const value = JSON.parse(words.slice(first, last + 1));
        if (value === null || typeof value !== "object" || Array.isArray(value))
            throw new Error("The answer is not a JSON object.");
        return value;
    }

    // Every string inside a JSON value, for checks that run over all of it.
    function strings(value, into) {
        into = into || [];
        if (typeof value === "string")
            into.push(value);
        else if (Array.isArray(value))
            value.forEach(function (item) { strings(item, into); });
        else if (value !== null && typeof value === "object")
            Object.keys(value).forEach(function (key) { strings(value[key], into); });
        return into;
    }

    // The same JSON value with every string passed through `change`.
    function mapStrings(value, change) {
        if (typeof value === "string")
            return change(value);
        if (Array.isArray(value))
            return value.map(function (item) { return mapStrings(item, change); });
        if (value !== null && typeof value === "object") {
            const copy = {};
            Object.keys(value).forEach(function (key) { copy[key] = mapStrings(value[key], change); });
            return copy;
        }
        return value;
    }

    function escapeRegExp(words) { return words.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

    // Letters and digits as names use them. JavaScript's \b only knows
    // ASCII, and this engine has no \p{L}, so the ranges are spelled out.
    const WORD = "A-Za-z0-9\\u00C0-\\u024F\\u0370-\\u03FF\\u0400-\\u04FF";

    // A pattern finding `phrase` as whole words. Returns [before, match].
    function wholeWords(phrase, flags) {
        return new RegExp("(^|[^" + WORD + "])(" + escapeRegExp(phrase).replace(/ /g, "\\s+") + ")(?![" + WORD + "])", flags || "g");
    }

    return {
        id: id, now: now, list: list, text: text, clip: clip, tail: tail, wordCount: wordCount, norm: norm,
        parseJson: parseJson, strings: strings, mapStrings: mapStrings, escapeRegExp: escapeRegExp, wholeWords: wholeWords
    };
})();
