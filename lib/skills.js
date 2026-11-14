// Skills: small Markdown files that shape how a story is written.
//
// A skill is a folder holding a SKILL.md, in the layout of Agent Skills
// (the format Claude's skills use), so a skill written for one is easy to
// bring to the other:
//
//     skills/spare-concrete/
//       SKILL.md
//       evals/            tests of the skill; see tests/evals.py
//
//     ---
//     name: spare-concrete
//     description: Short, exact sentences; feeling shows in what is seen and done.
//     license: MIT
//     metadata:
//       title: Spare and concrete
//       kind: style
//       stages: draft, revise
//       cues: sparer, plainer, less flowery
//       excludes: lush-lyrical
//     ---
//     - Most sentences carry one action or one image. ...
//
// `name` is the id and `description` the line a picker shows, as in Agent
// Skills. What only this plugin needs is under `metadata`: `kind` is one of
// KINDS below, `stages` the steps of the writing it is shown to (STAGES),
// `title` its name for people, `cues` words a reader might use when
// steering towards it, `excludes` skills it can't be combined with. An
// Agent Skill with none of that comes in as a craft skill for drafting and
// revising. Only SKILL.md's body is used; scripts and references in the
// folder are not (a story has nothing to run them with).
//
// Where they come from: skills/ in the plugin (built in, updated with the
// plugin), and data/skills/ (the reader's own: pasted in the panel, added
// from the command line or a file, or installed from GitHub; kept across
// updates; one with the name of a built-in one takes its place). Any skill
// can be switched off (the setting `skills_off`).
//
// A skill is the reader's preference, never an instruction that outranks
// the plugin. So a skill is checked before it is used, and refused when it
// would have the story imitate a named author or another work, or when it
// tries to speak to the model over the rules (see `problems`). What passes
// is still handed to the model as material in a block of its own, below
// the originality rule and the task, with a line saying it can change
// neither (Prompts.skills). And the forbidden-names check runs on the
// skill text too, and on everything the story becomes, whatever a skill
// said.
var Skills = (function () {
    "use strict";

    const BUILT_IN = "skills", OWN = "data/skills";

    // The kinds, in the order a list shows them, and how many of each a
    // story may have at once: one structure for a book, one person and
    // tense, and room to mix the rest.
    const KINDS = {
        style: {limit: 2, what: "voice and prose"},
        voice: {limit: 1, what: "person and tense"},
        structure: {limit: 1, what: "the shape of the plot"},
        genre: {limit: 2, what: "a genre's conventions and what its readers expect"},
        craft: {limit: 4, what: "one part of the craft: dialogue, pacing, hooks, clarity"}
    };
    const ORDER = ["style", "voice", "structure", "genre", "craft"];
    const STAGES = ["world", "cast", "plot", "draft", "revise"];
    // At most this many skills a story, and this many characters of them
    // in all: every one is sent with every request of its stages.
    const MOST = 6, BODY_MOST = 4000, ALL_MOST = 12000, FILE_MOST = 20000;

    // --- Reading a skill file -----------------------------------------------

    function slug(words) {
        return Util.norm(words).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-").slice(0, 64);
    }

    function listOf(value) {
        if (Array.isArray(value))
            return value.map(Util.text).filter(Boolean);
        return Util.text(value).replace(/^\[|\]$/g, "").split(",").map(function (item) {
            return item.trim().replace(/^["']|["']$/g, "");
        }).filter(Boolean);
    }

    function unquote(value) { return value.trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1"); }

    // The front matter is a small subset of YAML: `key: value` lines, one
    // level of nesting (`metadata:` with indented keys under it), a value
    // that is a [list], a comma list or "- item" lines, and a folded or
    // literal block (`description: >` with indented lines).
    function parse(words) {
        const text = Util.text(words).replace(/\r\n?/g, "\n").replace(/^﻿/, "");
        const found = /^---\n([\s\S]*?)\n---[ \t]*(?:\n([\s\S]*))?$/.exec(text);
        if (!found)
            return {meta: null, body: text};
        const meta = {};
        let parent = null, last = null, block = -1;
        found[1].split("\n").forEach(function (line) {
            if (/^\s*(#.*)?$/.test(line))
                return;
            const indent = /^(\s*)/.exec(line)[1].length;
            // The lines of a block (`description: >`) are those indented
            // deeper than its key.
            if (block >= 0) {
                if (indent > block) {
                    last.into[last.key] = (last.into[last.key] ? last.into[last.key] + " " : "") + line.trim();
                    return;
                }
                block = -1;
            }
            const item = /^\s*-\s+(.*)$/.exec(line);
            const pair = /^\s*([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
            if (item && last) {
                const value = last.into[last.key];
                last.into[last.key] = (Array.isArray(value) ? value : listOf(value)).concat([unquote(item[1])]);
            } else if (pair) {
                const key = pair[1].toLowerCase(), value = pair[2].trim();
                if (indent === 0) {
                    parent = null;
                    if (value === "" && key === "metadata") {
                        meta.metadata = {};
                        parent = "metadata";
                        last = null;
                        return;
                    }
                }
                const target = indent > 0 && parent ? meta[parent] : meta;
                target[key] = /^[>|][-+]?$/.test(value) ? "" : unquote(value);
                if (/^[>|][-+]?$/.test(value))
                    block = indent;
                last = {into: target, key: key};
            }
        });
        return {meta: meta, body: Util.text(found[2])};
    }

    // A field of ours: under `metadata`, or (as older files have it) at the
    // top.
    function field(meta, key) {
        const nested = meta && meta.metadata && typeof meta.metadata === "object" ? meta.metadata[key] : undefined;
        return nested !== undefined ? nested : meta ? meta[key] : undefined;
    }

    // --- What a skill may not say ---------------------------------------------

    // Wording that would have the story imitate somebody or something.
    // Craft is free; a named model to copy is not.
    const IMITATION = [
        /\b(?:in|after) the (?:style|voice|manner|vein|mould|mold|spirit|tradition) of\b/i,
        /\b(?:[Ww]rit(?:e|es|ten|ing)|[Ss]ound(?:s|ing)?|[Rr]eads?|[Ff]eels?|[Pp]rose|[Vv]oice|[Ss]tyle)\s+(?:just\s+|exactly\s+)?like\s+(?:a\s+)?[A-Z][\w'’.-]+/,
        /\b(?:à|a) la\s+[A-Z]/,
        /\b(?:pastiches?|homages?|parod(?:y|ies)|fan ?fic(?:tion)?s?)\s+(?:of|to|on|in|set in)\s/i,
        /\b[Ii]mitat(?:e|es|ion of|ing)\s+[A-Z]/,
        /\b[A-Z][a-z]+(?:esque|ian)\s+(?:prose|style|voice|sentences|tone)\b/,
        /\bchannel(?:l?ing|s)?\s+[A-Z]/,
        /\b(?:as|the way)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:would|did|does|wrote|writes)\b/
    ];

    // Wording that speaks to the model over the plugin's rules: a skill is
    // a preference about craft and has no business with any of this.
    const OVERRIDE = [
        /\b(?:ignore|disregard|forget|override|overrule|bypass|suspend)\b[^.\n]{0,40}\b(?:rules?|instructions?|prompts?|guidelines?|constraints?|restrictions?|originality|system)\b/i,
        /\boriginality rule\b/i,
        /\bsystem prompt\b|\bdeveloper mode\b|\bjailbreak\b|\bprompt injection\b/i,
        /\byou are (?:now|no longer)\b|\bfrom now on,? you\b|\bnew instructions?\b/i,
        /\b(?:rules?|instructions?|restrictions?) (?:do(?:es)? not|don'?t|no longer) apply\b/i,
        /\b(?:reuse|borrow|copy|use)\b[^.\n]{0,30}\b(?:characters?|names?|places?|plots?|scenes?|worlds?)\b[^.\n]{0,20}\bfrom (?:an? |the )?(?:existing|famous|published|real|other|another|well-known)\b/i,
        /\bset in the (?:world|universe) of\b/i,
        /\b(?:answer|reply|respond) (?:only )?with\b|\binstead of (?:the|a) (?:chapter|json)\b/i
    ];

    // Authors people ask to be imitated, for this check only (a story may
    // have a character called Joyce; a skill has no use for the name).
    const AUTHORS = [
        "Austen", "Bronte", "Brontë", "Dickens", "Tolstoy", "Dostoevsky", "Chekhov", "Hemingway", "Faulkner", "Fitzgerald", "Steinbeck",
        "Woolf", "Joyce", "Kafka", "Nabokov", "Borges", "Calvino", "Garcia Marquez", "García Márquez", "Murakami", "Ishiguro", "Rushdie",
        "Atwood", "Morrison", "McCarthy", "Carver", "Vonnegut", "Pynchon", "DeLillo", "Updike", "Didion", "Le Guin", "Tolkien",
        "Rowling", "Pratchett", "Gaiman", "Sanderson", "Rothfuss", "Jemisin", "Lovecraft", "Poe", "Shelley", "Stoker", "Christie",
        "Chandler", "Hammett", "Highsmith", "Conan Doyle", "Asimov", "Heinlein", "Bradbury", "Philip K. Dick", "Leckie",
        "Stephen King", "Grisham", "Patterson", "Dan Brown", "Sally Rooney", "Ferrante", "Mantel", "Tartt", "Mieville", "Miéville",
        "Shakespeare", "Homer", "Dante", "Cervantes", "Twain", "Salinger", "Orwell", "Huxley", "Wodehouse", "Roald Dahl", "Dr. Seuss",
        "C. S. Lewis", "Lewis Carroll", "Pullman", "Robin Hobb", "Abercrombie", "George R. R. Martin", "Robert Jordan", "Erikson",
        "Gene Wolfe", "Zelazny", "Octavia Butler", "Kowal", "Iain Banks", "Frank Herbert", "Hilary Mantel", "Cormac McCarthy"
    ];

    // What is wrong with a skill, as sentences; none when it may be used.
    function problems(skill) {
        const found = [];
        if (!skill.meta)
            return ["it has no front matter: SKILL.md must start with a line \"---\", then at least name and description, then \"---\""];
        if (!/^[a-z0-9](?:[a-z0-9]|-(?!-)){0,62}[a-z0-9]$/.test(skill.id || ""))
            found.push("its name \"" + (skill.id || "") + "\" should be 2 to 64 lower-case letters, digits and single dashes");
        if (skill.title.length < 2 || skill.title.length > 60)
            found.push("its title should be 2 to 60 characters");
        if (!KINDS[skill.kind])
            found.push("its kind \"" + skill.kind + "\" is not one of " + ORDER.join(", "));
        if (skill.stages.length === 0)
            found.push("it names no stages: say which of " + STAGES.join(", ") + " it shapes");
        skill.stages.forEach(function (stage) {
            if (STAGES.indexOf(stage) < 0)
                found.push("its stage \"" + stage + "\" is not one of " + STAGES.join(", "));
        });
        if (skill.description.length < 10 || skill.description.length > 1024)
            found.push("its description should be 10 to 1024 characters");
        if (skill.body.length < 40)
            found.push("its body is too short to say anything (" + skill.body.length + " characters)");
        if (skill.body.length > BODY_MOST)
            found.push("its body is " + skill.body.length + " characters; at most " + BODY_MOST + " are sent with every request it shapes, so keep it short");

        // The words themselves: everything a model would be shown.
        const all = [skill.title, skill.description, skill.cues.join(", "), skill.body].join("\n");
        if (/<<<|>>>/.test(all) || /^\s*Task\s*:/im.test(all))
            found.push("it uses the markers the plugin wraps material in (<<< >>> or \"Task:\"), which a skill may not");
        IMITATION.forEach(function (pattern) {
            const hit = pattern.exec(all);
            if (hit)
                found.push("it asks for imitation (\"" + Util.clip(hit[0], 60) + "\"): a skill names qualities to write with, never an author or a work to copy");
        });
        OVERRIDE.forEach(function (pattern) {
            const hit = pattern.exec(all);
            if (hit)
                found.push("it tries to change the plugin's rules or instructions (\"" + Util.clip(hit[0], 60) + "\"); a skill can only shape the craft");
        });
        AUTHORS.forEach(function (name) {
            if (Util.wholeWords(name, "g").test(all))
                found.push("it names the author \"" + name + "\"; a skill says what the writing does, not whose it resembles");
        });
        const taken = Originality.hitsIn({text: all});
        if (taken.length > 0)
            found.push("it uses names that belong to existing books or authors (" + taken.join(", ") + ")");
        return found.filter(function (line, index) { return found.indexOf(line) === index; });
    }

    // A skill from the words of its SKILL.md. `id` is the folder's name;
    // for a skill being added it is the front matter's `name`.
    function read(words, id, source) {
        const parsed = parse(words), meta = parsed.meta || {};
        const name = Util.text(meta.name);
        // An Agent Skill's name is already an id; an older file of ours had
        // a title there.
        const isId = /^[a-z0-9-]+$/.test(name);
        const skill = {
            id: id || (isId ? name : slug(name)), meta: parsed.meta, body: parsed.body, source: source || "own",
            title: Util.text(field(meta, "title")) || (isId ? name.replace(/-/g, " ").replace(/^./, function (c) { return c.toUpperCase(); }) : name),
            kind: (Util.text(field(meta, "kind")) || "craft").toLowerCase(),
            stages: listOf(field(meta, "stages")).map(function (stage) { return stage.toLowerCase(); }),
            description: Util.text(meta.description), cues: listOf(field(meta, "cues")).map(Util.norm),
            excludes: listOf(field(meta, "excludes")), license: Util.text(meta.license)
        };
        if (skill.stages.length === 0 && !field(meta, "stages"))
            skill.stages = ["draft", "revise"];
        skill.name = skill.title;
        skill.problems = problems(skill);
        return skill;
    }

    // --- The skills there are -------------------------------------------------

    // A folder's skills: <name>/SKILL.md, or a loose <name>.md dropped in.
    function folder(where, source) {
        return omabook.files.list(where).map(function (entry) {
            const loose = /\.md$/i.test(entry), path = loose ? where + "/" + entry : where + "/" + entry + "/SKILL.md";
            const words = omabook.files.read(path);
            if (words === null)
                return null;
            const skill = read(words, entry.replace(/\.md$/i, "").toLowerCase(), source);
            skill.path = path;
            const origin = loose ? null : omabook.files.read(where + "/" + entry + "/source.json");
            if (origin) {
                try { skill.from = JSON.parse(origin).from || ""; } catch (error) { skill.from = ""; }
            }
            return skill;
        }).filter(Boolean);
    }

    function off() { return Config.get("skills_off").map(function (id) { return Util.text(id).toLowerCase(); }); }

    // Every skill, the reader's own over the built-in ones of the same
    // name, in the order of their kinds and then their titles: the ones
    // that can be used. With `everything`, also those switched off and
    // those that can't be used, with their problems.
    // Read again when more than a few seconds old, or after a change here:
    // the panel's view asks for the list on every refresh.
    let cache = null, cachedAt = 0;
    function all(everything) {
        if (!cache || Date.now() - cachedAt > 5000) {
            cache = load();
            cachedAt = Date.now();
        }
        const switchedOff = off();
        return cache.map(function (skill) {
            skill.off = switchedOff.indexOf(skill.id) >= 0;
            return skill;
        }).filter(function (skill) { return everything || (skill.problems.length === 0 && !skill.off); });
    }

    function load() {
        const byId = {};
        folder(BUILT_IN, "built-in").concat(folder(OWN, "own")).forEach(function (skill) {
            if (byId[skill.id] && skill.source === "own")
                skill.replaces = true;
            byId[skill.id] = skill;
        });
        return Object.keys(byId).map(function (id) { return byId[id]; })
            .sort(function (a, b) {
                return (ORDER.indexOf(a.kind) + 99) % 99 - (ORDER.indexOf(b.kind) + 99) % 99 || (a.title < b.title ? -1 : 1);
            });
    }

    function forget() { cache = null; }

    function find(id, everything) {
        return all(everything).filter(function (skill) { return skill.id === Util.text(id).toLowerCase(); })[0] || null;
    }

    // What a story keeps of a skill: enough to be written with again, by a
    // branch or a sequel, even when the skill has since been removed.
    function snapshot(skill) {
        return {id: skill.id, name: skill.title, kind: skill.kind, stages: skill.stages, description: skill.description,
                source: skill.source, body: skill.body};
    }

    function summary(skill) {
        return {id: skill.id, name: skill.title, kind: skill.kind, stages: skill.stages, description: skill.description,
                source: skill.source + (skill.replaces ? " (in place of the built-in one)" : ""), from: skill.from || "",
                license: skill.license || "", off: !!skill.off, problems: skill.problems || []};
    }

    // --- Choosing -----------------------------------------------------------------

    // A set of skills checked as a whole: each known and usable, no more of a
    // kind than it allows, nothing that excludes another, and not more text
    // than ALL_MOST. Later in the list wins, so a new choice of a kind
    // replaces the old one. Answers {skills, problems} at once.
    function settle(ids) {
        const known = {}, chosen = [], problems = [];
        all(true).forEach(function (skill) { known[skill.id] = skill; });
        Util.list(ids).map(function (id) { return Util.text(typeof id === "object" && id ? id.id : id).toLowerCase(); }).filter(Boolean).forEach(function (id) {
            const skill = known[id];
            if (!skill)
                return problems.push("there is no skill \"" + id + "\"");
            if (skill.off)
                return problems.push("\"" + id + "\" is switched off");
            if (skill.problems.length > 0)
                return problems.push("\"" + id + "\" can't be used: " + skill.problems[0]);
            if (chosen.some(function (other) { return other.id === id; }))
                return;
            // Excluded either way round: the new one goes in, the old goes.
            for (let index = chosen.length - 1; index >= 0; index -= 1) {
                const other = chosen[index];
                if (other.excludes.indexOf(id) >= 0 || skill.excludes.indexOf(other.id) >= 0)
                    chosen.splice(index, 1);
            }
            const same = chosen.filter(function (other) { return other.kind === skill.kind; });
            if (same.length >= KINDS[skill.kind].limit)
                chosen.splice(chosen.indexOf(same[0]), 1);
            chosen.push(skill);
        });
        while (chosen.length > MOST || chosen.reduce(function (sum, skill) { return sum + skill.body.length; }, 0) > ALL_MOST)
            chosen.shift();
        return {skills: chosen, problems: problems};
    }

    // The skills a reader's words name: "lush, kishotenketsu and dialogue".
    // Each piece is matched to a name, a title, a cue, or the first word of
    // a title ("lush" is "Lush and lyrical"). Answers {ids, unknown}.
    function choose(words) {
        const pieces = Util.text(words).split(/\s*(?:,|;|\+|&|\band\b|\bwith\b|\n)\s*/i).map(Util.norm).filter(Boolean);
        const skills = all(), ids = [], unknown = [];
        pieces.forEach(function (piece) {
            const plain = piece.replace(/[^a-z0-9 -]/g, "").trim(), dashed = plain.replace(/\s+/g, "-");
            if (!plain)
                return;
            const match = skills.filter(function (skill) { return skill.id === dashed || Util.norm(skill.title) === plain; })[0]
                || skills.filter(function (skill) { return skill.cues.indexOf(plain) >= 0; })[0]
                || skills.filter(function (skill) {
                    return skill.id.indexOf(dashed) === 0 || Util.norm(skill.title).split(/[^a-z0-9]+/)[0] === plain
                           || skill.id.split("-").indexOf(dashed) >= 0;
                })[0];
            if (match) {
                if (ids.indexOf(match.id) < 0)
                    ids.push(match.id);
            } else {
                unknown.push(piece);
            }
        });
        return {ids: ids, unknown: unknown};
    }

    // The skills a new story starts with: those asked for, or the defaults
    // in the settings when none were.
    function forStart(asked) {
        const ids = Array.isArray(asked) ? asked : Util.text(asked) ? choose(asked).ids : [];
        return settle(ids.length > 0 ? ids : Config.get("skills"));
    }

    // --- Adding, removing and switching off the reader's own ----------------

    // Keeps a skill in data/skills/<name>/SKILL.md, after the same checks
    // as every other. `from` is where it came from, when it was fetched.
    function add(words, from) {
        words = Util.text(words);
        if (words.length > FILE_MOST)
            throw new Error("That skill is " + words.length + " characters long; a skill is at most " + FILE_MOST + ".");
        const skill = read(words, "", "own");
        if (skill.problems.length > 0)
            throw new Error("The skill \"" + (skill.id || "without a name") + "\" can't be used: " + skill.problems.join("; ") + ".");
        const at = OWN + "/" + skill.id;
        if (!omabook.files.write(at + "/SKILL.md", words + "\n"))
            throw new Error("The skill could not be written to " + at + "/SKILL.md.");
        if (from)
            omabook.files.write(at + "/source.json", JSON.stringify({from: from, fetched: Util.now(), license: skill.license}, null, 1));
        else if (omabook.files.exists(at + "/source.json"))
            omabook.files.remove(at + "/source.json");
        // A loose file of the same name would be read in its place.
        if (omabook.files.exists(OWN + "/" + skill.id + ".md"))
            omabook.files.remove(OWN + "/" + skill.id + ".md");
        forget();
        skill.from = from || "";
        return summary(skill);
    }

    function remove(id) {
        id = Util.text(id).toLowerCase();
        const loose = OWN + "/" + id + ".md", inFolder = OWN + "/" + id + "/SKILL.md";
        if (!omabook.files.exists(loose) && !omabook.files.exists(inFolder)) {
            const builtIn = all(true).filter(function (skill) { return skill.id === id; })[0];
            throw new Error(builtIn ? "\"" + id + "\" is built in, so it can't be removed; switch it off instead."
                                    : "There is no skill of your own called \"" + id + "\".");
        }
        [loose, inFolder, OWN + "/" + id + "/source.json"].forEach(function (path) {
            if (omabook.files.exists(path))
                omabook.files.remove(path);
        });
        forget();
        return true;
    }

    function switchOn(id, on) {
        id = Util.text(id).toLowerCase();
        if (!all(true).some(function (skill) { return skill.id === id; }))
            throw new Error("There is no skill called \"" + id + "\".");
        const now = off().filter(function (other) { return other !== id; });
        Config.change({skills_off: on ? now : now.concat([id])});
        return summary(find(id, true));
    }

    // --- From GitHub ------------------------------------------------------------

    // An address as Omabook's own "plugin add" takes one, and a raw file:
    //   owner/repo                         https://github.com/owner/repo(.git)
    //   git@github.com:owner/repo.git
    //   .../tree/<ref>[/folder]            .../blob/<ref>/folder/SKILL.md
    //   https://raw.githubusercontent.com/owner/repo/<ref>/folder/SKILL.md
    // A ref with a slash in it can't be told from a folder; as there, it
    // isn't supported. Answers {owner, repo, ref, path, file} or throws.
    function address(text) {
        let words = Util.text(text).replace(/[?#].*$/, "").replace(/\/+$/, "");
        let found = /^git@github\.com:([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(words);
        if (found)
            return {owner: found[1], repo: found[2], ref: "", path: "", file: ""};
        found = /^https?:\/\/raw\.githubusercontent\.com\/([\w.-]+)\/([\w.-]+)\/([^/]+)\/(.+)$/.exec(words);
        if (found)
            return {owner: found[1], repo: found[2], ref: found[3], path: found[4].replace(/\/[^/]*$/, ""), file: found[4]};
        words = words.replace(/^https?:\/\/(?:www\.)?github\.com\//, "");
        found = /^([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/(tree|blob)\/([^/]+)(?:\/(.*))?)?$/.exec(words);
        if (!found || /^https?:/.test(words))
            throw new Error("\"" + Util.text(text) + "\" is not a GitHub address. Give owner/repo, or a link to a repository, a folder or a SKILL.md on github.com.");
        const rest = found[5] || "";
        const file = found[3] === "blob" || /\.md$/i.test(rest) ? rest : "";
        return {owner: found[1], repo: found[2], ref: found[4] || "", path: file ? rest.replace(/\/?[^/]*$/, "") : rest, file: file};
    }

    function raw(where, file) {
        return "https://raw.githubusercontent.com/" + where.owner + "/" + where.repo + "/" + (where.ref || "HEAD") + "/" + file;
    }

    function fetched(url) {
        return omabook.http.get(url, {headers: {"User-Agent": "omabook-storyteller"}}).then(function (answer) {
            if (answer.status === 404)
                return null;
            if (!answer.ok)
                throw new Error("GitHub answered " + answer.status + " for " + url + ".");
            return answer;
        });
    }

    // Installs the skill at a GitHub address, or every skill in a folder
    // of them (a folder of <name>/SKILL.md, or one with a skills/ folder).
    // A promise of {installed: [summaries], refused: [{from, problem}]}.
    // Each goes through `add`, so through every check a pasted one does.
    const FOLDER_MOST = 30;
    function install(text) {
        if (!omabook.http)
            return Promise.reject(new Error("Fetching skills needs the \"http\" permission, which this copy of the plugin doesn't have."));
        let where;
        try { where = address(text); } catch (error) { return Promise.reject(error); }
        const done = {installed: [], refused: []};
        function take(url, words) {
            try {
                done.installed.push(add(words, url));
            } catch (error) {
                done.refused.push({from: url, problem: error.message});
            }
        }
        function one(file) {
            const url = raw(where, file);
            return fetched(url).then(function (answer) {
                if (answer)
                    take(url, answer.text);
                return !!answer;
            });
        }
        function list(path) {
            const url = "https://api.github.com/repos/" + where.owner + "/" + where.repo + "/contents/" + path + (where.ref ? "?ref=" + encodeURIComponent(where.ref) : "");
            return fetched(url).then(function (answer) { return answer ? Util.list(answer.json()) : []; });
        }
        function folders(path, deeper) {
            return list(path).then(function (entries) {
                const dirs = entries.filter(function (entry) { return entry && entry.type === "dir"; });
                const skills = dirs.filter(function (entry) { return entry.name !== "skills"; }).slice(0, FOLDER_MOST);
                const nested = dirs.filter(function (entry) { return entry.name === "skills"; })[0];
                let chain = Promise.resolve();
                skills.forEach(function (entry) { chain = chain.then(function () { return one(entry.path + "/SKILL.md"); }); });
                return chain.then(function () {
                    if (nested && deeper)
                        return folders(nested.path, false);
                    return null;
                });
            });
        }
        const start = where.file ? one(where.file).then(function (found) {
            if (!found)
                throw new Error("There is no file at " + raw(where, where.file) + ".");
        }) : one((where.path ? where.path + "/" : "") + "SKILL.md").then(function (found) {
            return found ? null : folders(where.path, true);
        });
        return start.then(function () {
            if (done.installed.length === 0 && done.refused.length === 0)
                throw new Error("No SKILL.md was found at " + Util.text(text) + ".");
            return done;
        });
    }

    // --- For the prompts ------------------------------------------------------------

    // The skills of a story that shape one stage; a skill switched off
    // since stops shaping it.
    function forStage(story, stage) {
        const switchedOff = off();
        return Util.list(story.skills).filter(function (skill) {
            return Util.list(skill.stages).indexOf(stage) >= 0 && switchedOff.indexOf(skill.id) < 0;
        });
    }

    // The menu offered to the model when the reader steers: which skills
    // there are, so a wish like "write it lusher" can choose one.
    function menu() {
        return all().map(function (skill) { return "- " + skill.id + " (" + skill.kind + "): " + Util.clip(skill.description, 160); }).join("\n");
    }

    function names(list) {
        return Util.list(list).map(function (skill) { return skill.name; }).join(", ");
    }

    return {
        KINDS: KINDS, STAGES: STAGES, MOST: MOST, parse: parse, read: read, problems: problems, all: all, find: find,
        snapshot: snapshot, summary: summary, settle: settle, choose: choose, forStart: forStart, add: add, remove: remove,
        switchOn: switchOn, address: address, install: install, forStage: forStage, menu: menu, names: names, forget: forget
    };
})();
