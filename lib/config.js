// The plugin's settings: what a reader may want to change, each with the
// value used when they never did. They live in data/settings.json, which is
// what omabook.settings reads and writes, so they survive restarts and can
// be edited by hand.
var Config = (function () {
    "use strict";

    const defaults = {
        // About how many words a chapter is. The biggest lever on cost.
        chapter_words: 1200,
        // How many chapters a new story is planned to take. The plan may be
        // revised when the reader steers, so it is where the story aims.
        chapters: 12,
        // Whether the next chapter is written by itself as the reader nears
        // the end of what there is. Off: only when they ask for it.
        write_ahead: true,
        // How far into the last written chapter (0 to 1) the reader must be
        // before the next is started. See "When the next chapter is written"
        // in the README for why it is not 0 and not 1.
        write_at: 0.35,
        // Which of Omabook's models does what. "main" is the model chosen
        // in Omabook's settings, "quick" its faster and cheaper one; a
        // model's own name works too. Writing is the world, the plan, the
        // chapters and the author's answers. Structure is reading a
        // finished chapter into the graphs and renaming taken names:
        // work that turns text into JSON and invents nothing.
        model_writing: "main",
        model_structure: "quick",
        // After each chapter is drafted, it is read against a short
        // checklist (continuity, point of view and tense, scenes that turn,
        // the ending, repetition, stock phrases, the chosen skills) and the
        // fixes are made as edits: one request. Off saves that request.
        revise: true,
        // The model for that pass. It writes the replacement sentences, so
        // it is a writing model; see the README for what was measured.
        model_revise: "main",
        // The skills a new story starts with when none are chosen for it
        // (ids, as `omabook plugin run storyteller skills` lists them).
        // Empty: the house style, which is already the craft in prompts.js.
        skills: [],
        // Skills switched off: not offered, not chosen, and no longer
        // shaping a story that had chosen them. Any skill, built in or not.
        skills_off: [],
        // The language the story is written in.
        language: "English",
        // The name on the cover.
        pen_name: "Storyteller",
        // Names that may never appear in a story, beside those found in the
        // library and the built-in list; and names that are let through even
        // though the library has them (a character called "Rose").
        forbidden_names: [],
        allowed_names: [],
        // After how many seconds without a sign of life an unfinished piece
        // of writing is taken to have been interrupted, and is picked up.
        stale_seconds: 30
    };

    function get(key) {
        const value = omabook.settings.get(key, defaults[key]);
        // A setting edited into the wrong type falls back, not over.
        return typeof value === typeof defaults[key] && Array.isArray(value) === Array.isArray(defaults[key]) ? value : defaults[key];
    }

    function all() {
        const values = {};
        Object.keys(defaults).forEach(function (key) { values[key] = get(key); });
        return values;
    }

    // Changes the settings named in `changes`; anything else in it is a
    // mistake worth saying, not something to keep silently.
    function change(changes) {
        Object.keys(changes || {}).forEach(function (key) {
            if (!Object.prototype.hasOwnProperty.call(defaults, key))
                throw new Error("There is no setting \"" + key + "\"; there are: " + Object.keys(defaults).join(", ") + ".");
            let value = changes[key];
            if (typeof defaults[key] === "number")
                value = Number(value);
            if (typeof value !== typeof defaults[key] || Array.isArray(value) !== Array.isArray(defaults[key]) || value !== value)
                throw new Error("The setting \"" + key + "\" should be " + (Array.isArray(defaults[key]) ? "a list" : "a " + typeof defaults[key]) + ".");
            if (key === "chapter_words")
                value = Math.max(150, Math.min(6000, Math.round(value)));
            if (key === "chapters")
                value = Math.max(2, Math.min(60, Math.round(value)));
            if (key === "write_at")
                value = Math.max(0, Math.min(1, value));
            if (key === "stale_seconds")
                value = Math.max(1, value);
            if (key === "skills") {
                // Defaults that name a skill there is no such thing as, or
                // two of a kind that allows one, are said now, not at the
                // next story.
                const settled = Skills.settle(value);
                if (settled.problems.length > 0)
                    throw new Error("The default skills can't be used: " + settled.problems.join("; ") + ".");
                value = settled.skills.map(function (skill) { return skill.id; });
            }
            omabook.settings.set(key, value);
        });
        return all();
    }

    return {get: get, all: all, change: change, defaults: defaults};
})();
