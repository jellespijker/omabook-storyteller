// The writing itself: a new story, the next chapter, a branch, a sequel.
//
// Each is a job (jobs.js) made of stages. A stage does one thing (usually
// one request to the model), and its result is saved in the job before the
// next begins, so work that is cut off is picked up at the stage it was in.
// A stage whose result is already in the job is skipped.
//
// What a new story costs: three requests for the world (world, cast,
// plot), then three per chapter (the chapter, the editor's pass over it,
// and what it established; two with the setting "revise" off). A chapter
// written after the reader steered costs one more (the plan revised). A
// draft that uses a taken name costs one or two small ones.
var Writer = (function () {
    "use strict";

    // --- Shapes: what each JSON answer must hold to be used ---------------

    function shapeWorld(answer) {
        if (!Util.text(answer.title))
            throw new Error("it has no title");
        answer.places = Ai.named(answer.places, 2, "places");
        answer.groups = Ai.named(answer.groups, 1, "groups");
        answer.rules = Ai.named(answer.rules, 1, "rules");
        answer.history = Ai.named(answer.history, 0, "events");
        return answer;
    }

    function shapeCast(answer) {
        answer.characters = Ai.named(answer.characters, 3, "characters");
        return answer;
    }

    // Beats in order, numbered without gaps from `from`, each with the
    // fields a chapter is written from.
    function beats(value, from, least) {
        const list = Util.list(value).filter(function (beat) { return beat !== null && typeof beat === "object"; })
            .sort(function (a, b) { return (Number(a.chapter) || 0) - (Number(b.chapter) || 0); });
        if (list.length < least)
            throw new Error("it plans " + list.length + " chapters, and at least " + least + " are needed");
        return list.map(function (beat, index) {
            const made = {chapter: from + index, title: Util.text(beat.title), pov: Util.text(beat.pov), goal: Util.text(beat.goal),
                          events: Util.text(beat.events), seeds: Util.text(beat.seeds), turn: Util.text(beat.turn)};
            // The scenes, each with a goal, what is in the way, and how it
            // comes out; and the question the chapter leaves open.
            const scenes = Util.list(beat.scenes).filter(function (scene) { return scene && typeof scene === "object"; }).slice(0, 6).map(function (scene) {
                return {goal: Util.text(scene.goal), conflict: Util.text(scene.conflict), outcome: Util.text(scene.outcome)};
            }).filter(function (scene) { return scene.goal || scene.conflict || scene.outcome; });
            if (scenes.length)
                made.scenes = scenes;
            if (Util.text(beat.hook))
                made.hook = Util.text(beat.hook);
            return made;
        });
    }

    function shapePlot(answer) {
        answer.threads = Ai.named(answer.threads, 1, "threads");
        answer.promises = Ai.named(answer.promises, 0, "promises");
        answer.twists = Ai.named(answer.twists, 1, "twists");
        answer.endings = Ai.named(answer.endings, 1, "endings");
        answer.beats = beats(answer.beats, 1, 2);
        answer.structure = Util.text(answer.structure);
        answer.arcs = Util.list(answer.arcs).filter(function (arc) { return arc && typeof arc === "object" && Util.text(arc.name); }).slice(0, 8).map(function (arc) {
            return {name: Util.text(arc.name), chapters: Util.list(arc.chapters).map(Number).filter(Boolean).slice(0, 2),
                    purpose: Util.text(arc.purpose), ends_with: Util.text(arc.ends_with)};
        });
        return answer;
    }

    // The editor's answer: the checks, and the edits that mend what they
    // found.
    function shapeRevise(answer) {
        const checks = answer.checks !== null && typeof answer.checks === "object" ? answer.checks : {};
        const edits = Util.list(answer.edits).filter(function (edit) {
            return edit && typeof edit.find === "string" && typeof edit.replace === "string" && edit.find.trim() !== "" && edit.find !== edit.replace;
        }).slice(0, 12);
        const tidy = {};
        Object.keys(checks).forEach(function (key) { tidy[key] = Util.clip(checks[key], 400); });
        return {checks: tidy, edits: edits.map(function (edit) { return {find: edit.find, replace: edit.replace, why: Util.text(edit.why)}; })};
    }

    // The edits applied to a draft: each where its passage occurs exactly
    // once, as written or with its spaces evened out. An edit that can't
    // be placed is left out, not guessed at.
    function applyEdits(draft, edits) {
        let text = draft.text;
        const applied = [], skipped = [];
        edits.forEach(function (edit) {
            let find = edit.find.replace(/^#\s+.*\n+/, "");
            let at = text.indexOf(find);
            if (at < 0 || text.indexOf(find, at + 1) >= 0) {
                // The same passage with its runs of spaces made single, as a
                // model copying text tends to make them.
                const loose = new RegExp(Util.escapeRegExp(find.trim()).replace(/\s+/g, "\\s+"), "g");
                const found = text.match(loose);
                if (!found || found.length !== 1)
                    return skipped.push(edit.why || "an edit");
                find = found[0];
                at = text.indexOf(find);
            }
            text = text.slice(0, at) + edit.replace + text.slice(at + find.length);
            applied.push(edit.why || "an edit");
        });
        return {draft: {title: draft.title, text: text.replace(/\n{3,}/g, "\n\n").trim()}, applied: applied, skipped: skipped};
    }

    function shapeSequel(answer) {
        if (!Util.text(answer.title))
            throw new Error("it has no title");
        answer.characters = Ai.named(answer.characters, 0, "characters");
        return shapePlot(answer);
    }

    function shapeUpdate(answer) {
        if (!Util.text(answer.summary))
            throw new Error("it has no summary");
        return {
            summary: Util.text(answer.summary),
            knows: Ai.named(answer.knows, 0, "things").map(function (thing) {
                return {kind: Util.text(thing.kind).toLowerCase() || "concept", name: thing.name, summary: Util.text(thing.summary),
                        aliases: Util.list(thing.aliases).map(Util.text).filter(Boolean)};
            }),
            relations: Util.list(answer.relations).filter(function (relation) {
                return relation && Util.text(relation.from) && Util.text(relation.to) && Util.text(relation.relation);
            }).map(function (relation) { return {from: Util.text(relation.from), to: Util.text(relation.to), relation: Util.text(relation.relation)}; }),
            seeds_planted: Util.list(answer.seeds_planted).map(Util.text).filter(Boolean),
            twists_paid: Util.list(answer.twists_paid).map(Util.text).filter(Boolean),
            promises_kept: Util.list(answer.promises_kept).map(Util.text).filter(Boolean),
            // Continuity, for the author's graph only (World.record).
            people: Util.list(answer.people).filter(function (person) { return person && Util.text(person.name); }).map(function (person) {
                return {name: Util.text(person.name), where: Util.text(person.where), learned: Util.text(person.learned),
                        wants_now: Util.text(person.wants_now), changed: Util.text(person.changed)};
            }),
            threads: Util.list(answer.threads).filter(function (thread) { return thread && Util.text(thread.name) && Util.text(thread.state); })
                .map(function (thread) { return {name: Util.text(thread.name), state: Util.text(thread.state)}; }),
            when: Util.text(answer.when),
            questions: Util.list(answer.questions).map(Util.text).filter(Boolean).slice(0, 6)
        };
    }

    // --- Stages -------------------------------------------------------------

    // While a story has no chapter yet, its one page says what is being done.
    // A failure here costs nothing but the page being a step behind.
    function progressed(job) {
        try {
            if (!Stories.exists(job.story))
                return;
            const story = Stories.load(job.story);
            if (story.chapters.length > 0)
                return;
            story.writing = Status.stageLine(job);
            Stories.publish(story);
        } catch (error) {
            omabook.log("The page of a story being written couldn't be brought up to date: " + error);
        }
    }

    // Runs `make` unless the job already holds its result, and keeps what
    // it answers in the job. What the stage spent on the model is added to
    // the job's tally, which ends up in the story file.
    function stage(job, key, make) {
        if (job[key] !== undefined && job[key] !== null)
            return Promise.resolve(job[key]);
        job.doing = key;
        Status.refresh();
        progressed(job);
        const before = Ai.tally();
        return Promise.resolve().then(make).then(function (value) {
            job.cost = Ai.add(job.cost, Ai.since(before));
            job[key] = value === undefined ? true : value;
            Jobs.save(job);
            return job[key];
        });
    }

    // A JSON answer that is also checked against the forbidden names, and
    // renamed when it uses one.
    function original(task, prompt, shape, what) {
        return Ai.json(task, prompt, shape).then(function (answer) {
            return Originality.cleaned(answer, what).then(function (cleaned) { return cleaned.draft; });
        });
    }

    // The memory of the book that goes with every request: one short
    // summary per chapter. Old chapters are cut shorter than recent ones,
    // so this stays a few thousand characters however long the book gets.
    function soFar(story, upTo) {
        const chapters = story.chapters.filter(function (chapter) { return upTo === undefined || chapter.number <= upTo; });
        const lines = chapters.map(function (chapter, index) {
            const recent = chapters.length - index <= 6;
            return "Chapter " + chapter.number + ", \"" + chapter.title + "\": " + Util.clip(chapter.summary, recent ? 700 : 240);
        });
        if (story.lineage && story.lineage.recap)
            lines.unshift("The earlier book, \"" + story.lineage.title + "\": " + story.lineage.recap);
        return lines.join("\n");
    }

    function beatFor(story, number) {
        return story.plan.beats.filter(function (beat) { return beat.chapter === number; })[0] || null;
    }

    function pending(story) {
        return story.steering.filter(function (entry) { return !entry.planned; });
    }

    // The plan revised, when the reader steered since it was made or the
    // story is a branch finding its own way.
    function replan(job, story) {
        const number = job.chapter, wishes = pending(story);
        if (!job.branch && wishes.length === 0)
            return true;
        const remaining = story.plan.beats.filter(function (beat) { return beat.chapter >= number; });
        const prompt = Prompts.replan(World.bible(story), soFar(story), remaining, job.branch ? [] : story.steering.slice(-8), number, job.branch || "",
                                      Config.get("chapter_words"), story.lineage ? story.lineage.title : story.title,
                                      Util.list(story.skills), Skills.menu());
        return original("replan", prompt, function (answer) {
            answer.beats = beats(answer.beats, number, 1);
            answer.skills = Util.list(answer.skills).map(Util.text).filter(Boolean);
            answer.twists = Ai.named(answer.twists, 0, "twists");
            answer.endings = Ai.named(answer.endings, 0, "endings");
            answer.characters = Ai.named(answer.characters, 0, "characters");
            return answer;
        }, "revised plan").then(function (revised) {
            // The request took a while, and the reader may have turned
            // pages or steered again meanwhile: the story is read anew, and
            // only the wishes that were in the request count as planned for.
            const now = Stories.load(job.story), asked = wishes.map(function (entry) { return entry.at; });
            now.plan.beats = now.plan.beats.filter(function (beat) { return beat.chapter < number; }).concat(revised.beats);
            now.plan.chapters = now.plan.beats.at(-1).chapter;
            if (job.branch && Util.text(revised.title) && Util.norm(revised.title) !== Util.norm(now.lineage.title))
                now.title = Util.text(revised.title);
            now.steering.forEach(function (entry) {
                if (!entry.planned && asked.indexOf(entry.at) >= 0)
                    entry.planned = number;
            });
            // A wish about how the book is written may choose skills. Only
            // skills there are, and only as they can be combined; one the
            // model made up is let go.
            let changed = "";
            if (revised.skills.length > 0) {
                const ids = revised.skills.map(function (id) { return id.toLowerCase(); });
                const chosen = ids.indexOf("none") >= 0 ? {skills: []} : Skills.settle(ids.filter(function (id) { return Skills.find(id); }));
                const before = Util.list(now.skills).map(function (skill) { return skill.id; }).join(","), after = chosen.skills.map(function (skill) { return skill.id; });
                if ((ids.indexOf("none") >= 0 || chosen.skills.length > 0) && before !== after.join(",")) {
                    now.skills = chosen.skills.map(Skills.snapshot);
                    now.skillLog = Util.list(now.skillLog).concat([{at: Util.now(), chapter: number, skills: after, by: "steering"}]);
                    changed = after.length ? "Now written with: " + Skills.names(now.skills) + "." : "Now written without skills.";
                }
            }
            World.replant(now, revised, number);
            Stories.save(now);
            return {note: [Util.text(revised.note), changed].filter(Boolean).join(" ")};
        });
    }

    function draft(job, story) {
        const number = job.chapter, beat = beatFor(story, number);
        if (!beat)
            throw new Error("\"" + story.title + "\" has no chapter " + number + " planned: the story has reached its end.");
        const previous = story.chapters.at(-1);
        const final = !story.plan.beats.some(function (other) { return other.chapter > number; });
        const prompt = Prompts.chapter(story, number, World.bible(story), soFar(story), previous ? Util.tail(previous.text, 2500) : "",
                                       beat, beatFor(story, number + 1), story.steering.slice(-8), Config.get("chapter_words"), final,
                                       World.continuity(story), World.due(story, number, final), Skills.forStage(story, "draft"));
        return Ai.chapter(prompt, Config.get("chapter_words")).then(function (written) {
            written.title = written.title || beat.title || "Chapter " + number;
            return written;
        });
    }

    // The editor's pass: the draft read against the checklist, with what a
    // program counted in it, and mended with edits. One request; nothing at
    // all with the setting "revise" off.
    function revise(job, story) {
        if (!Config.get("revise"))
            return Promise.resolve({off: true});
        const number = job.chapter, beat = beatFor(story, number) || {}, previous = story.chapters.at(-1);
        const before = previous ? Util.tail(previous.text, 2500) : "", words = Config.get("chapter_words");
        const found = Checks.findings(job.draft, before, words, World.bible(story, ["world", "cast"]));
        const prompt = Prompts.revise(story, number, job.draft, beat, World.continuity(story), before, found.text, words,
                                      Skills.forStage(story, "revise"), World.castBrief(story));
        return Ai.json("revise", prompt, shapeRevise).then(function (answer) {
            const mended = applyEdits(job.draft, answer.edits);
            // An edit that would leave too little chapter is not a mend.
            if (Util.wordCount(mended.draft.text) >= Util.wordCount(job.draft.text) * 0.6)
                job.draft = mended.draft;
            else
                mended.skipped = mended.applied.concat(mended.skipped), mended.applied = [];
            const after = Checks.findings(job.draft, before, words, World.bible(story, ["world", "cast"]));
            return {checks: answer.checks, applied: mended.applied, skipped: mended.skipped,
                    counted: {before: {words: found.words, stock: found.stock.length, repeats: found.repeats.length, echoes: found.echoes.length},
                              after: {words: after.words, stock: after.stock.length, repeats: after.repeats.length, echoes: after.echoes.length}}};
        });
    }

    function update(job, story) {
        const prompt = Prompts.update(story, job.chapter, job.draft.title, job.draft.text, World.openEnds(story), World.names(story),
                                      World.readerKnows(story));
        return Ai.json("update", prompt, shapeUpdate);
    }

    // The chapter joins the story and the story goes to the library. The
    // order matters for a crash: the file is written whole first, the
    // library's copy second, the graph last, and the chapter remembers
    // whether the graph has it, so whatever was cut off is finished later.
    function commit(job) {
        const story = Stories.load(job.story), number = job.chapter;
        if (story.chapters.length < number) {
            story.chapters.push({
                number: number, title: job.draft.title, text: job.draft.text, written: Util.now(), summary: job.update.summary,
                record: job.update, renames: job.renames || {}, recorded: false,
                // What shaped it, for whoever reads the file later.
                skills: Util.list(story.skills).map(function (skill) { return skill.id; }),
                revision: job.revise && !job.revise.off ? job.revise : null
            });
            story.steering.forEach(function (entry) {
                if (!entry.applied)
                    entry.applied = number;
            });
        }
        // Written: the page that said it was being written goes.
        delete story.writing;
        story.plan.chapters = Math.max(story.plan.chapters, number);
        story.ended = !story.plan.beats.some(function (beat) { return beat.chapter > number; });
        story.cost = Ai.add(story.cost, job.cost);
        job.cost = Ai.add(null, null);
        const book = Stories.publish(story);
        Jobs.save(job);
        return {story: story, book: book};
    }

    // Brings the author's graph up to date with chapters it has not taken
    // in yet. Also run when a story is opened, in case it was cut off here.
    function recordChapters(story, bookId) {
        const waiting = story.chapters.filter(function (chapter) { return !chapter.recorded; });
        waiting.forEach(function (chapter) { World.record(story, chapter, bookId); });
        if (waiting.length > 0)
            Stories.save(story);
        return waiting.length;
    }

    // The stages of one chapter, the same for every kind of job.
    function chapterStages(job) {
        function story() { return Stories.load(job.story); }
        return stage(job, "replan", function () { return replan(job, story()); })
            .then(function () { return stage(job, "draft", function () { return draft(job, story()); }); })
            .then(function () { return stage(job, "revise", function () { return revise(job, story()); }); })
            .then(function () {
                return stage(job, "clean", function () {
                    return Originality.cleaned(job.draft, "chapter").then(function (cleaned) {
                        job.draft = cleaned.draft;
                        job.renames = cleaned.renames;
                        return true;
                    });
                });
            })
            .then(function () { return stage(job, "update", function () { return update(job, story()); }); })
            .then(function () { return commit(job); })
            .then(function (made) {
                recordChapters(made.story, made.book.id);
                return {book: made.book.id, story: made.story.id, title: made.story.title, chapter: job.chapter,
                        chapters: made.story.chapters.length, ended: made.story.ended, note: (job.replan || {}).note || "",
                        renames: job.renames || {}};
            });
    }

    // The reader's other stories, in a few lines, so that a new one is not
    // the last one again: a model left to itself returns to the same kind
    // of place and the same sound of name. These are the plugin's own
    // inventions, so they may be named; they are still not to be reused.
    function earlier() {
        return Stories.all().filter(function (story) { return story.chapters.length > 0 && !story.lineage; })
            .sort(function (a, b) { return a.created < b.created ? 1 : -1; }).slice(0, 6);
    }

    function earlierStories() {
        return earlier().map(function (story) {
                const people = World.index(story.world.plan).ofKind("character").slice(0, 6).map(function (node) { return node.name; });
                return "- \"" + story.title + "\": " + Util.clip(story.premise.logline, 220) + (people.length ? " (people: " + people.join(", ") + ")" : "");
            }).join("\n");
    }

    // --- The four kinds of job ----------------------------------------------

    const kinds = {
        chapter: chapterStages,

        // A new story: the world, then its people, then the plot, each laid
        // into the plan graph before the next is asked for, so each request
        // reads the graph as it stands. Then chapter one.
        start: function (job) {
            const chapters = Config.get("chapters");
            function story() { return Stories.load(job.story); }
            // The book is in the library from the first moment, and open, so
            // it is clear which book is being written and how far it has got.
            if (!Stories.exists(job.story)) {
                const made = Stories.blank(job.story);
                made.premise.wish = job.wish;
                made.skills = Util.list(job.skills);
                if (made.skills.length)
                    made.skillLog = [{at: Util.now(), chapter: 0, skills: made.skills.map(function (skill) { return skill.id; }), by: "start"}];
                made.writing = Status.stageLine({doing: "taste"});
                const book = Stories.publish(made);
                job.book = book.id;
                Jobs.save(job);
                omabook.reader.open(book.id, {section: 0, fraction: 0});
            }
            return stage(job, "taste", function () { return Taste.profile(); })
                // What the earlier stories leaned on, counted, not asked for.
                .then(function () { return stage(job, "avoid", function () { return Checks.leanedOn(earlier(), 14); }); })
                .then(function () {
                    return stage(job, "world", function () {
                        return original("world", Prompts.world(job.wish, job.taste, chapters, earlierStories(), Skills.forStage(story(), "world"), job.avoid),
                                        shapeWorld, "world");
                    });
                })
                .then(function () {
                    return stage(job, "founded", function () {
                        // The story begun at the start, kept with its book.
                        const made = Stories.exists(job.story) ? Stories.load(job.story) : Stories.blank(job.story), world = job.world;
                        made.title = Util.text(world.title);
                        made.premise = {wish: job.wish, logline: Util.text(world.logline), genre: Util.text(world.genre), tone: Util.text(world.tone),
                                        voice: Util.text(world.voice), blurb: Util.text(world.blurb),
                                        // What earlier stories leaned on and this one's world
                                        // doesn't: told to every chapter, so it stays away.
                                        avoid: Util.list(job.avoid).filter(function (word) { return Util.norm(JSON.stringify(world)).indexOf(word) < 0; })};
                        made.skills = made.skills || Util.list(job.skills);
                        World.drop(made);
                        World.plantWorld(made, world);
                        Stories.save(made);
                    });
                })
                .then(function () {
                    return stage(job, "cast", function () {
                        return original("cast", Prompts.cast(World.bible(story(), ["world"]), Skills.forStage(story(), "cast")), shapeCast, "cast");
                    });
                })
                .then(function () { return stage(job, "castPlanted", function () { World.plantCast(story(), job.cast, 0); }); })
                .then(function () {
                    return stage(job, "plot", function () {
                        return original("plot", Prompts.plot(World.bible(story(), ["world", "cast"]), chapters, Config.get("chapter_words"),
                                                             Skills.forStage(story(), "plot")), shapePlot, "plot");
                    });
                })
                .then(function () {
                    return stage(job, "plotPlanted", function () {
                        const made = story();
                        World.plantPlot(made, job.plot);
                        made.plan = {chapters: job.plot.beats.length, beats: job.plot.beats, structure: job.plot.structure, arcs: job.plot.arcs};
                        Stories.save(made);
                    });
                })
                .then(function () { return chapterStages(job); });
        },

        // A branch: the chapters up to a point, a copy of both graphs with
        // everything later taken back out, and a plan of its own.
        fork: function (job) {
            return stage(job, "founded", function () {
                const parent = Stories.load(job.parent), made = Stories.blank(job.story), upTo = job.upTo;
                const siblings = Stories.all().filter(function (other) { return other.lineage && other.lineage.kind === "fork" && other.lineage.story === parent.id; });
                made.title = parent.title + " (branch" + (siblings.length > 0 ? " " + (siblings.length + 1) : "") + ")";
                made.author = parent.author;
                made.language = parent.language;
                made.premise = JSON.parse(JSON.stringify(parent.premise));
                // A branch is written the way its parent was.
                made.skills = JSON.parse(JSON.stringify(Util.list(parent.skills)));
                made.skillLog = JSON.parse(JSON.stringify(Util.list(parent.skillLog).filter(function (entry) { return entry.chapter <= upTo; })));
                made.chapters = JSON.parse(JSON.stringify(parent.chapters.slice(0, upTo)));
                made.plan = JSON.parse(JSON.stringify(parent.plan));
                made.steering = JSON.parse(JSON.stringify(parent.steering.filter(function (entry) { return entry.applied && entry.applied <= upTo; })));
                made.lineage = {kind: "fork", story: parent.id, title: parent.title, chapter: upTo, difference: job.branch,
                                recap: (parent.lineage || {}).recap || ""};
                made.revealed = Math.min(parent.revealed, upTo);
                made.reached = upTo;
                World.copy(parent, made);
                World.forget(made, upTo, job.parentBook);
                Stories.save(made);
            }).then(function () { return chapterStages(job); });
        },

        // A sequel: the same world, carried over whole, and a new plot.
        sequel: function (job) {
            const chapters = Config.get("chapters");
            function story() { return Stories.load(job.story); }
            return stage(job, "founded", function () {
                const parent = Stories.load(job.parent), made = Stories.blank(job.story);
                made.title = "After " + parent.title;
                made.author = parent.author;
                made.language = parent.language;
                made.premise = JSON.parse(JSON.stringify(parent.premise));
                made.premise.wish = job.wish;
                // So is a sequel, unless it was given skills of its own.
                made.skills = Util.list(job.skills).length ? job.skills : JSON.parse(JSON.stringify(Util.list(parent.skills)));
                made.skillLog = [{at: Util.now(), chapter: 0, skills: made.skills.map(function (skill) { return skill.id; }), by: Util.list(job.skills).length ? "start" : "parent"}];
                made.lineage = {kind: "sequel", story: parent.id, title: parent.title, chapter: parent.chapters.length, difference: job.wish,
                                recap: Util.clip(soFar(parent), 3500)};
                World.copy(parent, made);
                World.settle(made);
                Stories.save(made);
            }).then(function () {
                return stage(job, "sequel", function () {
                    const made = story();
                    return original("sequel", Prompts.sequel(World.bible(made), made.lineage.recap, job.wish, chapters, Config.get("chapter_words"),
                                                             Skills.forStage(made, "plot")), shapeSequel, "sequel's plan");
                });
            }).then(function () {
                return stage(job, "plotPlanted", function () {
                    const made = story(), plan = job.sequel;
                    made.title = Util.text(plan.title);
                    made.premise.logline = Util.text(plan.logline) || made.premise.logline;
                    made.premise.blurb = Util.text(plan.blurb) || made.premise.blurb;
                    World.plantCast(made, plan, 0);
                    World.plantPlot(made, plan);
                    made.plan = {chapters: plan.beats.length, beats: plan.beats, structure: plan.structure, arcs: plan.arcs};
                    Stories.save(made);
                });
            }).then(function () { return chapterStages(job); });
        }
    };

    // Runs a job to its end, or picks one up. A promise of what was made:
    // {book, story, title, chapter, chapters, ended, note, renames}.
    function run(job) {
        if (Jobs.running(job.story))
            return Promise.reject(new Error("That is being written already."));
        if (!kinds[job.kind])
            return Promise.reject(new Error("There is no kind of writing called \"" + job.kind + "\"."));
        // Said before anything is begun, so no half-started story is left
        // behind by a model that was never there.
        if (!omabook.ai.available())
            return Promise.reject(new Error("No AI is set up. Choose one in Omabook's settings (,) and try again."));
        Jobs.begin(job);
        omabook.say(Status.stageLine({doing: job.kind === "chapter" ? "draft" : job.kind === "start" ? "world" : job.kind === "sequel" ? "sequel" : "replan", chapter: job.chapter}));
        return Promise.resolve().then(function () { return kinds[job.kind](job); }).then(function (made) {
            Jobs.clear(job.story);
            Status.noted(made.story, made.note);
            omabook.say(made.ended ? "Chapter " + made.chapter + " of \"" + made.title + "\" is ready. It is the last."
                                   : "Chapter " + made.chapter + " of \"" + made.title + "\" is ready.");
            return made;
        }, function (error) {
            Jobs.fail(job, error);
            Status.refresh();
            omabook.say(job.failed);
            throw error;
        });
    }

    function newJob(kind, storyId, more) {
        return Object.assign({kind: kind, story: storyId, chapter: 1, started: Util.now()}, more);
    }

    return {
        run: run, soFar: soFar, recordChapters: recordChapters, pending: pending,
        // `skills` are snapshots (Skills.snapshot), chosen before the job
        // begins, so a story picked up after a crash has the same ones.
        start: function (wish, skills) { return run(newJob("start", Util.id(), {wish: Util.text(wish), skills: Util.list(skills)})); },
        next: function (story) { return run(newJob("chapter", story.id, {chapter: story.chapters.length + 1})); },
        fork: function (parent, parentBook, upTo, difference) {
            return run(newJob("fork", Util.id(), {parent: parent.id, parentBook: parentBook, upTo: upTo, chapter: upTo + 1,
                                                  branch: Util.text(difference) || "Take it somewhere else."}));
        },
        sequel: function (parent, wish, skills) { return run(newJob("sequel", Util.id(), {parent: parent.id, wish: Util.text(wish), skills: Util.list(skills)})); },
        applyEdits: applyEdits
    };
})();
