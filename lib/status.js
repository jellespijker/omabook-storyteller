// What the reader is told: a line at the bottom of the window, and the
// panel beside the page.
//
// The panel is QML and can't call into the library itself; it draws what
// the script hands it with omabook.ui.set. Everything it shows is one
// value, "view", built here from the story file, the job and the reader's
// graph, so the panel has no logic of its own to go wrong.
var Status = (function () {
    "use strict";

    // The book the reader has open, as the last reader event said.
    let open = null;
    // Things said once, shown until something newer replaces them.
    let answer = null, note = null;

    const STAGES = {
        taste: "Looking at what you like…", world: "Building a world…", cast: "Inventing its people…",
        plot: "Planning the plot…", sequel: "Planning the sequel…", replan: "Rethinking the plan…",
        draft: "Writing chapter %1…", revise: "Reading chapter %1 over…", avoid: "Looking at what you like…", clean: "Checking chapter %1 is all its own…", update: "Noting what chapter %1 established…"
    };

    function stageLine(job) {
        if (job.kind === "world" && job.doing === "sequel")
            return "Planning the new story…";
        return (STAGES[job.doing] || "Writing…").replace("%1", job.chapter || 1);
    }

    function lineFor(story, job, state) {
        if (state === "running" || state === "elsewhere")
            return stageLine(job);
        if (state === "interrupted")
            return "Chapter " + (job.chapter || 1) + " was interrupted. It is picked up when you read on.";
        if (state === "failed")
            return job.failed;
        if (story.ended)
            return "The story has ended, after " + story.chapters.length + " chapters.";
        return story.chapters.length + " of about " + Math.max(story.plan.chapters, story.chapters.length) + " chapters written. "
               + (Config.get("write_ahead") ? "The next is written as you read." : "Ask for the next when you want it.");
    }

    function view() {
        const made = {
            // How the panel finds this plugin among all plugins' values,
            // whatever name its folder was given when it was installed.
            storyteller: true, plugin: omabook.plugin.id,
            book: open ? open.id : 0, mine: false, state: "other", line: "", title: "", chapters: 0, planned: 0, ended: false,
            lineage: "", known: [], answer: null, note: "", steering: [], skills: [], skillChoices: [], writeAhead: Config.get("write_ahead"),
            unfinished: Jobs.all().filter(function (job) { return job.kind !== "chapter"; }).length
        };
        const story = open ? Stories.ofBook(open) : null;
        if (!story)
            return made;
        const job = Jobs.read(story.id), state = Jobs.state(story.id);
        made.mine = true;
        // An answer or a note belongs to the story it was given for.
        const last = story.asked.at(-1);
        made.answer = answer && answer.story === story.id ? answer : last ? {story: story.id, question: last.question, text: last.answer} : null;
        made.note = note && note.story === story.id ? note.text : "";
        made.title = story.title;
        made.chapters = story.chapters.length;
        made.planned = Math.max(story.plan.chapters, story.chapters.length);
        made.ended = story.ended;
        made.state = state === "none" ? (story.ended ? "ended" : "idle") : state === "elsewhere" ? "running" : state;
        made.line = lineFor(story, job, state);
        made.lineage = !story.lineage ? ""
            : story.lineage.kind === "fork" ? "A branch of \"" + story.lineage.title + "\" from chapter " + story.lineage.chapter + "."
            : story.lineage.kind === "world" ? "A story in the world of \"" + story.lineage.title + "\"."
            : "A sequel to \"" + story.lineage.title + "\".";
        made.known = World.known(story).slice(0, 40).map(function (thing) {
            return {kind: thing.kind, name: thing.name, summary: Util.clip(thing.summary, 180)};
        });
        made.steering = story.steering.slice(-3).map(function (entry) { return Util.clip(entry.text, 120); });
        // The story's skills, and the others that could be added.
        made.skills = Util.list(story.skills).map(function (skill) { return {id: skill.id, name: skill.name, kind: skill.kind, description: skill.description}; });
        const chosen = made.skills.map(function (skill) { return skill.id; });
        made.skillChoices = Skills.all().filter(function (skill) { return chosen.indexOf(skill.id) < 0; }).map(function (skill) {
            return {id: skill.id, name: skill.name + " (" + skill.kind + ")", description: skill.description};
        });
        made.seen = story.world.seen;
        return made;
    }

    function refresh() {
        try {
            omabook.ui.set("view", view());
        } catch (error) {
            // A panel that can't be filled must not stop a chapter.
            omabook.log("The panel could not be brought up to date: " + error.message);
        }
    }

    return {
        refresh: refresh, view: view, stageLine: stageLine,
        reading: function (event) { open = event && event.id ? event : null; refresh(); },
        answered: function (story, question, text) { answer = {story: story, question: question, text: text}; refresh(); },
        noted: function (story, text) { note = {story: story, text: Util.text(text)}; refresh(); },
        book: function () { return open; }
    };
})();
