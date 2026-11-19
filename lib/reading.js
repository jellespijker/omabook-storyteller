// What happens while a story is read: the next chapter is written before
// the reader gets there, what they have read is laid into their graph, and
// they can steer the story or ask its author something.
var Reading = (function () {
    "use strict";

    // How far into a chapter (0 to 1) the reader must be for what it shows
    // to count as known to them.
    const REVEAL_AT = 0.5;

    // Where the reader is in a book: from the reader if it is open there,
    // else from where the library says it was read to.
    function place(bookId) {
        const current = omabook.reader.current();
        if (current && current.id === bookId)
            return {section: current.section, fraction: current.fraction};
        const read = omabook.library.progress(bookId) || {};
        return {section: read.section || 0, fraction: read.fraction || 0};
    }

    // Called on every page turn in one of this plugin's books (and when one
    // is opened). It answers a promise only when it started writing, so the
    // host knows the script is at work.
    //
    // When the next chapter is written: when the reader is in the last
    // chapter there is, at least `write_at` of the way through it (0.35 by
    // default), and nothing is being written. Not at the chapter's start,
    // or every story abandoned after a page would have cost a chapter
    // nobody reads, and a wish to steer would always come one chapter too
    // late. Not at its end, or a quick reader would sit waiting: a chapter
    // takes a minute or two to write, about what the rest of a chapter
    // takes to read. Never more than one chapter ahead of the reader.
    function attend(event) {
        const story = Stories.ofBook(event);
        Status.reading(event);
        if (!story)
            return null;

        // Anything a crash left undone, first.
        Writer.recordChapters(story, event.id);
        const shown = event.fraction >= REVEAL_AT ? event.section + 1 : event.section;
        const reached = Math.max(story.reached || 0, Math.min(event.section + 1, story.chapters.length));
        // What was revealed is marked where it was met, so a shared world is cut at each reader's place.
        const revealed = World.reveal(story, Math.min(shown, story.chapters.length), event.id);
        if (Sharing.sight(story, event.id) || revealed || reached !== (story.reached || 0)) {
            story.reached = reached;
            Stories.save(story);
            Status.refresh();
        }

        const state = Jobs.state(story.id);
        if (state === "interrupted")
            return Writer.run(Jobs.read(story.id)).then(null, quiet);
        if (state !== "none" || story.ended || !Config.get("write_ahead"))
            return null;
        const inLast = event.section >= story.chapters.length - 1;
        if (inLast && event.fraction >= Config.get("write_at"))
            return Writer.next(story).then(null, quiet);
        return null;
    }

    // A problem while writing was said and is in the panel; it is not a
    // mistake in the script, so it must not be reported as one.
    function quiet(error) { omabook.log("Not written: " + error.message); return null; }

    // Throws away a chapter that was written ahead and not read, so it can
    // be written again another way.
    function discardAhead(story, bookId) {
        const last = story.chapters.pop();
        World.forget(story, last.number - 1, bookId);
        story.ended = false;
        Stories.publish(story);
        return last.number;
    }

    // The reader says where the story should go. It is kept in the story's
    // log, shapes the plan (which is revised before the next chapter is
    // written) and stays in force for the rest of the book.
    function steer(book, story, words) {
        words = Util.text(words);
        if (!words)
            throw new Error("Say what should happen: who to follow, what to change, the tone, the pace.");
        if (story.ended)
            throw new Error("\"" + story.title + "\" has ended, so there is nothing left to steer. You can ask for a sequel, or branch it from an earlier chapter.");
        const at = place(book.id), state = Jobs.state(story.id), written = story.chapters.length;
        story.steering.push({at: Util.now(), chapter: Math.min(at.section + 1, written), text: Util.clip(words, 1000)});
        Stories.save(story);
        Status.refresh();

        if (state === "running" || state === "elsewhere") {
            omabook.say("Noted. Chapter " + (written + 1) + " is being written already, so this shapes the one after it.");
            return Promise.resolve({noted: true, shapes: written + 2, rewritten: false});
        }
        if (state !== "none") {
            omabook.say("Noted. It will shape chapter " + (written + 1) + " when that is written.");
            return Promise.resolve({noted: true, shapes: written + 1, rewritten: false});
        }
        // One chapter was written ahead and the reader has not been in it:
        // it is written again, since they asked before reading it.
        if (written >= 2 && at.section === written - 2 && (story.reached || 0) < written) {
            const number = discardAhead(story, book.id);
            omabook.say("Noted. Chapter " + number + " was not read yet, so it is written again with this in mind.");
            return Writer.next(story).then(function (made) { return {noted: true, shapes: number, rewritten: true, made: made}; });
        }
        if (at.section >= written - 1 && Config.get("write_ahead")) {
            omabook.say("Noted. Writing chapter " + (written + 1) + " with this in mind.");
            return Writer.next(story).then(function (made) { return {noted: true, shapes: written + 1, rewritten: false, made: made}; });
        }
        omabook.say("Noted. It will shape chapter " + (written + 1) + ". To change the story from where you are now, branch it.");
        return Promise.resolve({noted: true, shapes: written + 1, rewritten: false});
    }

    // Whether a question asks to be told what is coming. It has to be said
    // in so many words: a reader who asks "does she live?" wants the book
    // to answer, not the author.
    function wantsSpoilers(question) {
        return /\b(spoil me|with spoilers|spoilers? (?:are |is )?(?:ok|okay|fine|allowed|welcome|please)|i want spoilers|give me spoilers)\b|^\s*spoilers?\s*:/i.test(question);
    }

    // A question to the author. Without spoilers the model is sent only
    // what the reader has read: earlier chapters as summaries, the current
    // one up to their place, and their own graph. The plan is not in the
    // request, so it can't be given away.
    function ask(book, story, question, spoilers) {
        question = Util.text(question);
        if (!question)
            throw new Error("Ask something about the story.");
        spoilers = spoilers === true || wantsSpoilers(question);
        const at = place(book.id), number = Math.min(at.section + 1, story.chapters.length), chapter = story.chapters[number - 1];
        const read = chapter.text.slice(0, Math.max(800, Math.round(chapter.text.length * Math.max(at.fraction, 0.05))));
        let plan = "";
        if (spoilers)
            plan = World.bible(story) + "\n\nCHAPTERS STILL TO COME\n"
                   + JSON.stringify(story.plan.beats.filter(function (beat) { return beat.chapter > story.chapters.length; }));
        const before = Ai.tally();
        const prompt = Prompts.answer(story, question, Writer.soFar(story, number - 1), "# " + chapter.title + "\n\n" + Util.tail(read, 7000),
                                      World.readerKnows(story), plan);
        return Ai.prose("answer", prompt).then(function (answer) {
            const now = Stories.load(story.id);
            now.asked = now.asked.concat([{at: Util.now(), chapter: number, question: question, answer: answer, spoilers: spoilers}]).slice(-40);
            now.cost = Ai.add(now.cost, Ai.since(before));
            Stories.save(now);
            Status.answered(story.id, question, answer);
            omabook.say(Util.clip(answer, 200));
            return {answer: answer, spoilers: spoilers, chapter: number};
        });
    }

    return {attend: attend, place: place, steer: steer, ask: ask, wantsSpoilers: wantsSpoilers};
})();
