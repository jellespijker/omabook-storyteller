// Asking the model, and never trusting what comes back.
//
// Every answer goes through a check before anything is done with it: prose
// must be prose of some length and not a refusal; JSON must parse and have
// the shape asked for. An answer that fails is asked for once more, with
// the reason, and after that the request fails with a message a reader can
// act on. Nothing here touches a story: the callers only ever see an
// answer that passed.
var Ai = (function () {
    "use strict";

    // What this run has spent, for the job to add to the story's tally.
    const spent = {calls: 0, sent: 0, received: 0};

    function tally() { return {calls: spent.calls, sent: spent.sent, received: spent.received}; }

    function refusal(words) {
        return words.length < 600 && /^\W*(i'?m sorry|i am sorry|sorry|i can(?:no|')t|i won'?t|i'?m (?:unable|not able)|i am (?:unable|not able)|as an ai|i apologi[sz]e)\b/i.test(words);
    }

    // One request, checked. `check` is given the answer's text and answers
    // what the caller wants of it, or throws to say why it is no good.
    function ask(task, prompt, check, language) {
        if (!omabook.ai.available())
            return Promise.reject(new Error("No AI is set up. Choose one in Omabook's settings (,) and try again."));
        function attempt(words, again) {
            spent.calls += 1;
            spent.sent += words.length;
            return omabook.ai.ask(words, {system: Prompts.system(language || Config.get("language"))}).then(function (answer) {
                answer = Util.text(answer);
                spent.received += answer.length;
                try {
                    if (answer === "")
                        throw new Error("the answer was empty");
                    if (refusal(answer))
                        throw new Error("the model declined (\"" + Util.clip(answer, 120) + "\")");
                    return check(answer);
                } catch (error) {
                    if (again)
                        throw new Error("The AI's answer for the " + task + " could not be used, twice: " + error.message + ".");
                    omabook.log("The " + task + " answer could not be used (" + error.message + "); asking once more.");
                    return attempt(prompt + "\n\nYour previous answer could not be used: " + error.message
                                   + ". Answer again, exactly in the form asked for.", true);
                }
            }, function (problem) {
                // The host could not reach the model at all. Asking again
                // at once would only fail again, so this is said as it is.
                throw new Error("The AI could not be asked for the " + task + ": " + Util.text(problem && problem.message || problem));
            });
        }
        return attempt(prompt, false);
    }

    // A JSON answer. `shape` is given the parsed object and answers it
    // tidied, or throws.
    function json(task, prompt, shape) {
        return ask(task, prompt, function (answer) { return shape(Util.parseJson(answer)); });
    }

    // A chapter: "# Title" and prose. A code fence around it, or a line of
    // chat before it, is taken off; too little text is no chapter.
    function chapter(prompt, words) {
        return ask("chapter", prompt, function (answer) {
            let text = answer.replace(/^```[a-z]*\n/i, "").replace(/\n```\s*$/, "").trim();
            const heading = /^#{1,3}[ \t]+(.+)$/m.exec(text);
            let title = "";
            if (heading && text.indexOf(heading[0]) < 300) {
                title = heading[1].replace(/[*_#]/g, "").replace(/^chapter\s+\w+\s*[:.–—-]\s*/i, "").trim();
                text = text.slice(text.indexOf(heading[0]) + heading[0].length).trim();
            }
            if (Util.wordCount(text) < Math.max(60, words * 0.4))
                throw new Error("the chapter was only " + Util.wordCount(text) + " words, where about " + words + " were asked for");
            return {title: title, text: text};
        });
    }

    // A plain answer in prose.
    function prose(task, prompt) {
        return ask(task, prompt, function (answer) { return answer; });
    }

    // Helpers for the shapes: a list of objects that each have a name.
    function named(value, least, what) {
        const items = Util.list(value).filter(function (item) {
            return item !== null && typeof item === "object" && Util.text(item.name) !== "";
        });
        if (items.length < least)
            throw new Error("it lists " + items.length + " " + what + ", and at least " + least + " are needed");
        items.forEach(function (item) { item.name = Util.text(item.name); });
        return items;
    }

    return {ask: ask, json: json, chapter: chapter, prose: prose, named: named, tally: tally};
})();
