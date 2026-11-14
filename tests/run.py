#!/usr/bin/env python3
"""The plugin's tests: the whole life of a story, with no window and no model.

    python3 tests/run.py            # needs `omabook` on the PATH, or OMABOOK=/path/to/omabook
    python3 tests/run.py --keep     # leave the scratch folder behind, to look at

Everything happens in a scratch folder: HOME and the XDG folders point into
it, so no real settings, plugins or library are read or written. The plugin
is copied into the scratch plugin folder, a library is made with one
ordinary book in it and a little knowledge graph, and Omabook's AI is set to
the command tests/stub_ai.py, which answers each kind of request with canned
text and can be told to misbehave.

Each step drives the plugin the way a person at a terminal would:

    omabook plugin run storyteller <function | event:name> '<json>' --library <scratch>

and then looks at what is on disk: the story file, the library, the graphs,
and the log of what was sent to the "model".
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OMABOOK = os.environ.get("OMABOOK") or shutil.which("omabook")
NAME = "storyteller"

# A second, tiny plugin, only for the tests: it plays the other plugin that
# tries to rewrite a book that isn't its own.
SEED_PLUGIN = """
function overwrite(id) {
    omabook.files.write("data/fake.md", "# Mine now");
    try { omabook.library.replaceFile(id, "data/fake.md"); return "replaced"; } catch (error) { return "refused: " + error.message; }
}
"""


class Bench:
    def __init__(self):
        self.scratch = tempfile.mkdtemp(prefix="storyteller-test-")
        self.home = os.path.join(self.scratch, "home")
        self.config = os.path.join(self.home, ".config")
        self.plugins = os.path.join(self.config, "omabook", "plugins")
        self.plugin = os.path.join(self.plugins, NAME)
        self.library = os.path.join(self.scratch, "library")
        self.stub = os.path.join(self.scratch, "stub")
        for folder in (self.plugins, self.library, self.stub, os.path.join(self.plugins, "seed")):
            os.makedirs(folder)
        self.env = dict(os.environ, HOME=self.home, XDG_CONFIG_HOME=self.config, XDG_CACHE_HOME=os.path.join(self.home, ".cache"),
                        XDG_DATA_HOME=os.path.join(self.home, ".data"), STUB_DIR=self.stub, QT_QPA_PLATFORM="offscreen")
        self.env.pop("ANTHROPIC_API_KEY", None)
        with open(os.path.join(self.config, "omabook", "config.json"), "w") as file:
            json.dump({"library": self.library, "ai_provider": "command",
                       "ai_command": "%s %s" % (sys.executable, os.path.join(ROOT, "tests", "stub_ai.py")), "graph": "off"}, file)
        # The plugin as it would be installed: everything but tests and data.
        shutil.copytree(ROOT, self.plugin, ignore=shutil.ignore_patterns(".git", "data", "tests", ".scratch", "__pycache__"))
        with open(os.path.join(self.plugins, "seed", "plugin.json"), "w") as file:
            json.dump({"name": "Seed", "script": "main.js", "permissions": ["files"]}, file)
        with open(os.path.join(self.plugins, "seed", "main.js"), "w") as file:
            file.write(SEED_PLUGIN)

    def omabook(self, *arguments, timeout=120, check=True):
        done = subprocess.run([OMABOOK] + [str(argument) for argument in arguments] + ["--library", self.library],
                              env=self.env, capture_output=True, text=True, timeout=timeout)
        if check and done.returncode != 0:
            raise AssertionError("omabook %s failed:\n%s\n%s" % (" ".join(map(str, arguments)), done.stdout, done.stderr))
        return done

    def run(self, what, *arguments, plugin=NAME, timeout=120):
        """Runs a function or an event of the plugin; answers {result, said, log, error?}."""
        done = self.omabook("plugin", "run", plugin, what, json.dumps(list(arguments)) if ":" not in what else json.dumps(arguments[0]),
                            "--folder", self.plugins, "--json", timeout=timeout, check=False)
        try:
            return json.loads(done.stdout)
        except ValueError:
            raise AssertionError("plugin run %s printed no JSON:\n%s\n%s" % (what, done.stdout, done.stderr))

    def ok(self, what, *arguments, **options):
        answer = self.run(what, *arguments, **options)
        if answer.get("error"):
            raise AssertionError("%s failed: %s\n%s" % (what, answer["error"], "\n".join(answer.get("log", []))))
        return answer["result"]

    def json(self, *arguments):
        return json.loads(self.omabook(*arguments, "--json").stdout)

    # The stub model: how it should misbehave, and what it was asked.
    def control(self, **how):
        with open(os.path.join(self.stub, "control.json"), "w") as file:
            json.dump(how, file)
        for name in ("calls.jsonl", "state.json"):
            if os.path.exists(os.path.join(self.stub, name)):
                os.remove(os.path.join(self.stub, name))

    def calls(self):
        path = os.path.join(self.stub, "calls.jsonl")
        if not os.path.exists(path):
            return []
        with open(path, encoding="utf-8") as file:
            return [json.loads(line) for line in file]

    def tasks(self):
        return [call["task"] for call in self.calls()]

    def story(self, story_id):
        with open(os.path.join(self.plugin, "data", "stories", story_id + ".story"), encoding="utf-8") as file:
            return json.load(file)

    def scope(self, scope):
        return self.json("graph", "show", "--scope", scope)

    def turn(self, book, story, section, fraction, sections=None, timeout=120):
        """The reader stops on a page: sets where the book was read to, and tells the plugin."""
        self.omabook("progress", book, "--section", section, "--fraction", fraction)
        return self.run("event:page.turned", {"id": book, "generated": NAME, "identifiers": {"generated": NAME, "storyteller": story},
                                               "section": section, "sections": sections or len(self.story(story)["chapters"]),
                                               "fraction": fraction, "percent": 0}, timeout=timeout)


def names(view, kind=None):
    return sorted(node["name"] for node in view["nodes"] if kind is None or node["kind"] == kind)


def main():
    if not OMABOOK:
        sys.exit("omabook was not found: put it on the PATH or set OMABOOK=/path/to/omabook.")
    bench = Bench()
    passed = []

    def step(title):
        passed.append(title)
        print("ok %2d  %s" % (len(passed), title), flush=True)

    try:
        # ---------------------------------------------------------------- setup
        check = bench.json("plugin", "check", NAME, "--folder", bench.plugins)
        assert check["ok"], check
        registered = json.dumps(check["registered"])
        for expected in ("story-write", "story-steer", "story-ask", "story-branch", "story-sequel", "story-next", "Storyteller story", "page.turned"):
            assert expected in registered, (expected, registered)
        step("the plugin loads and registers its format, panel, commands and events")

        # An ordinary book, by a person, with what the graph knows of it.
        human_file = os.path.join(bench.scratch, "The Brass Orchard.md")
        with open(human_file, "w") as file:
            file.write("# One\n\nVesper Quill came down to Harrowgate in the rain.\n")
        bench.omabook("add", human_file)
        human = bench.json("list")[0]["id"]
        bench.omabook("set", human, "--title", "The Brass Orchard", "--authors", "Mira Tolland", "--tags", "maritime fantasy, slow burn",
                      "--rating", 5, "--status", "read")
        for kind, name, summary, more in (
                ("character", "Vesper Quill", "A captain who owes everyone.", ["--alias", "the Quillmaster"]),
                ("place", "Harrowgate", "A port.", []),
                ("theme", "debts between friends", "", []),
                ("topic", "tidal mechanics", "", []),
                ("topic", "The Odyssey", "", []),
                ("concept", "Tidewrighting", "A magic paid for in memories, as Vesper Quill learns in Harrowgate.", [])):
            bench.omabook("graph", "add", "--kind", kind, "--name", name, "--summary", summary, "--book", human, "--section", 0, *more)
        bench.omabook("graph", "sync")
        bench.ok("settings", {"chapter_words": 200, "chapters": 4, "stale_seconds": 1})

        taste = bench.ok("taste")
        assert "debts between friends" in taste and "tidal mechanics" in taste, taste
        for name in ("Vesper", "Quill", "Harrowgate", "Brass Orchard", "Tolland", "Tidewrighting", "Odyssey"):
            assert name not in taste, (name, taste)
        step("the taste profile holds themes and kinds of thing, and no name from the library")

        forbidden = [entry["name"] for entry in bench.ok("forbiddenNames")]
        for name in ("Vesper Quill", "Quillmaster", "Harrowgate", "Brass Orchard", "Mira Tolland", "Tolland", "Gandalf"):
            assert name in forbidden, (name, forbidden)
        assert "debts between friends" not in forbidden and "tidal mechanics" not in forbidden
        assert bench.ok("checkOriginality", "She rose early. Rose petals fell. He handed Vesper Quill the key in harrowgate.") == ["Vesper Quill"]
        assert bench.ok("checkOriginality", "They sailed for Harrowgate at dawn.") == ["Harrowgate"]
        bench.ok("forbid", "Zorvath")
        assert bench.ok("checkOriginality", "They met Zorvath on the road.") == ["Zorvath"]
        bench.ok("allow", "Harrowgate")
        assert bench.ok("checkOriginality", "They sailed for Harrowgate at dawn.") == []
        bench.ok("settings", {"allowed_names": []})
        step("forbidden names come from the graph, the library, the built-in list and the reader's own")

        # ---------------------------------------------------------- a new story
        bench.control(collide_world=True, bad_once="cast")
        made = bench.ok("startStory", "a quiet mystery by the sea")
        book, story_id = made["book"], made["story"]
        assert bench.tasks() == ["world", "rename", "cast", "cast", "plot", "chapter", "update"], bench.tasks()
        step("a story starts: world, cast and plot in three requests, then chapter one (a bad answer is asked for again)")

        for call in bench.calls():
            assert "THE ORIGINALITY RULE" in call["prompt"], call["task"]
            if call["task"] != "rename":
                for name in ("Vesper Quill", "Harrowgate", "Brass Orchard", "Tolland"):
                    assert name not in call["prompt"], (call["task"], name)
        world_prompt = bench.calls()[0]["prompt"]
        assert "a quiet mystery by the sea" in world_prompt and "debts between friends" in world_prompt
        step("every request states the originality rule, and none carries a name from the library")

        story = bench.story(story_id)
        seen, plan = story["world"]["seen"], story["world"]["plan"]
        assert (seen, plan) == ("world:" + story_id, "world:" + story_id + ":plan")
        planned = bench.scope(plan)
        assert "Harrowgate" not in names(planned) and "Brinehollow" in names(planned, "place"), names(planned)
        assert "Harrowgate" not in json.dumps(story) and "Harrowgate" not in json.dumps(planned)
        step("a world that used a library name was renamed before anything was kept")

        assert len(names(planned, "character")) == 4 and len(names(planned, "twist")) == 1 and len(names(planned, "ending")) == 2
        assert names(planned, "thread") and names(planned, "promise") and names(planned, "concept") and names(planned, "event")
        ilse = [node for node in planned["nodes"] if node["name"] == "Ilse Marrow"][0]
        assert ilse["data"]["secret"] and ilse["data"]["want"] and ilse["data"]["contradiction"] and ilse["data"]["spoiler"] is True
        twist = [node for node in planned["nodes"] if node["kind"] == "twist"][0]
        assert twist["data"]["seeded_in"] == [1, 2] and twist["data"]["pays_off_in"] == 4 and twist["data"]["spoiler"] is True
        assert twist["data"]["status"] == "seeded" and twist["data"]["planted_in"] == [1], twist["data"]
        assert any(edge["kind"] == "turns on" for edge in planned["edges"]) and any(edge["kind"] == "godfather of" for edge in planned["edges"])
        step("the world is a graph in its own scope: places, groups, rules, history, people with secrets, and the plot as nodes")

        listed = [entry for entry in bench.json("list") if entry["id"] == book][0]
        assert listed["identifiers"] == {"generated": NAME, "storyteller": story_id} and listed["formats"] == ["story"], listed
        toc = bench.omabook("toc", book).stdout
        text = bench.omabook("text", book).stdout
        assert "Tally 1" in toc and "Ilse Marrow counted the glass" in text
        assert "TWISTSECRET" not in text and "ENDINGSECRET" not in text and "sluices" not in text
        assert story["lineage"] is None and story["premise"]["wish"] == "a quiet mystery by the sea" and len(story["plan"]["beats"]) == 4
        assert story["cost"]["calls"] == 7 and story["cost"]["sent"] > 1000
        step("chapter one is a book in the library, read through the plugin's format, with the plan out of sight")

        # ------------------------------------------------- writing as they read
        bench.control()
        bench.turn(book, story_id, 0, 0.1)
        assert bench.tasks() == [] and len(bench.story(story_id)["chapters"]) == 1
        assert seen not in [entry["scope"] for entry in bench.json("graph", "scopes")["scopes"]]
        step("early in the last chapter nothing is written, and the reader's graph is still empty")

        bench.control(collide_chapter=True)
        said = bench.turn(book, story_id, 0, 0.6)
        story = bench.story(story_id)
        assert bench.tasks() == ["chapter", "rename", "update"], bench.tasks()
        assert len(story["chapters"]) == 2 and "Chapter 2" in " ".join(said["said"]), said
        assert "Vesper Quill" not in story["chapters"][1]["text"] and "Brinehollow" in story["chapters"][1]["text"]
        assert story["chapters"][1]["renames"] == {"Vesper Quill": "Brinehollow"}, story["chapters"][1]["renames"]
        assert "Tally 2" in bench.omabook("toc", book).stdout
        step("a page turn past the threshold writes the next chapter; a library name in it is renamed")

        known = bench.scope(seen)
        assert names(known) == ["Ilse Marrow", "Ninefold Market", "Weight of chapter 1"], names(known)
        assert not [node for node in known["nodes"] if node["kind"] in ("twist", "ending", "thread", "promise")]
        assert "secret" not in json.dumps(known) and "TWISTSECRET" not in json.dumps(known)
        assert story["revealed"] == 1 and story["reached"] == 1
        step("the reader's graph holds what chapter one showed, and nothing of the plan or of chapter two")

        bench.control()
        bench.turn(book, story_id, 0, 0.95)
        assert bench.tasks() == [] and len(bench.story(story_id)["chapters"]) == 2
        step("never more than one chapter ahead of the reader")

        # ------------------------------------------------------------- steering
        steered = bench.ok("steer", book, "More of the ferryman, and kill nobody.")
        story = bench.story(story_id)
        assert steered["rewritten"] is True and steered["shapes"] == 2, steered
        assert bench.tasks() == ["replan", "chapter", "update"], bench.tasks()
        assert "More of the ferryman, and kill nobody." in bench.calls()[0]["prompt"]
        assert "More of the ferryman, and kill nobody." in bench.calls()[1]["prompt"]
        assert len(story["chapters"]) == 2 and story["steering"][0]["applied"] == 2 and story["steering"][0]["planned"] == 2
        assert story["plan"]["beats"][1]["goal"].startswith("Revised:") and not story["plan"]["beats"][0]["goal"].startswith("Revised:")
        assert "The weights were hers" in names(bench.scope(plan), "twist")
        assert "Weight of chapter 2" in names(bench.scope(plan)) and "Weight of chapter 2" not in names(bench.scope(seen))
        step("steering revises the plan and rewrites the chapter that was written ahead but not read")

        bench.control()
        answer = bench.ok("askAuthor", book, "Why does she count everything?")
        asked = bench.calls()[0]["prompt"]
        assert answer["spoilers"] is False and "NO-PLAN" in answer["answer"]
        assert "TWISTSECRET" not in asked and "sluices" not in asked and "Tally 2" not in asked, "the plan or an unread chapter leaked"
        assert "Why does she count everything?" in asked and "Ilse Marrow counted the glass" in asked
        answer = bench.ok("askAuthor", book, "Spoil me: who forged it?")
        assert answer["spoilers"] is True and "WITH-PLAN" in answer["answer"] and "TWISTSECRET" in bench.calls()[1]["prompt"]
        assert [entry["spoilers"] for entry in bench.story(story_id)["asked"]] == [False, True]
        step("asking the author sends only what was read, and the plan only when spoilers are asked for")

        bench.control()
        bench.turn(book, story_id, 1, 0.5)
        story = bench.story(story_id)
        assert bench.tasks() == ["chapter", "update"] and len(story["chapters"]) == 3, bench.tasks()
        assert "kill nobody" in bench.calls()[0]["prompt"], "a standing wish is repeated to every later chapter"
        assert "Weight of chapter 2" in names(bench.scope(seen)) and story["revealed"] == 2
        step("reading on writes chapter three, with the standing wish still in force")

        # ---------------------------------------------- interrupted, and resumed
        bench.control(hang="update")
        try:
            bench.turn(book, story_id, 2, 0.5, timeout=6)
            raise AssertionError("the hanging request came back")
        except subprocess.TimeoutExpired:
            pass  # Omabook was killed mid-chapter, as a crash or a quit would.
        step_tasks = bench.tasks()
        subprocess.run(["pkill", "-f", os.path.join(ROOT, "tests", "stub_ai.py")], check=False)
        assert step_tasks == ["chapter", "update"], step_tasks
        assert len(bench.story(story_id)["chapters"]) == 3
        jobs = bench.ok("unfinished")
        assert len(jobs) == 1 and jobs[0]["kind"] == "chapter" and jobs[0]["chapter"] == 4, jobs
        json.loads(open(os.path.join(bench.plugin, "data", "stories", story_id + ".story")).read())
        time.sleep(1.3)
        bench.control()
        assert bench.ok("unfinished")[0]["state"] == "interrupted"
        bench.turn(book, story_id, 2, 0.5)
        story = bench.story(story_id)
        assert bench.tasks() == ["update"], "only the request that was cut off is made again: %s" % bench.tasks()
        assert len(story["chapters"]) == 4 and bench.ok("unfinished") == []
        step("a chapter cut off mid-way is picked up where it stopped, and the draft is not paid for twice")

        # --------------------------------------------------------------- the end
        assert story["ended"] is True
        assert "The end." in bench.omabook("text", book, "--section", 3).stdout
        bench.control()
        bench.turn(book, story_id, 3, 0.9)
        assert bench.tasks() == []
        refused = bench.run("nextChapter", book)
        assert "has ended" in refused.get("error", ""), refused
        refused = bench.run("steer", book, "One more chapter!")
        assert "has ended" in refused.get("error", ""), refused
        step("the story ends when its plan does: the last chapter says so, and nothing more is written")

        # ---------------------------------------------------------------- sequel
        bench.control()
        made = bench.ok("sequel", book, "the clerk's story")
        sequel_book, sequel_id = made["book"], made["story"]
        sequel = bench.story(sequel_id)
        assert bench.tasks() == ["sequel", "chapter", "update"], bench.tasks()
        assert sequel_book != book and sequel["title"] == "The Glass Debt" and len(sequel["chapters"]) == 1
        assert sequel["lineage"]["kind"] == "sequel" and sequel["lineage"]["story"] == story_id and sequel["lineage"]["chapter"] == 4
        sequel_plan = bench.scope(sequel["world"]["plan"])
        assert sequel["world"]["plan"] != plan and "Ilse Marrow" in names(sequel_plan, "character") and "Pell Orrin" in names(sequel_plan, "character")
        old_twist = [node for node in sequel_plan["nodes"] if node["name"] == "The weights were hers"][0]
        assert old_twist["data"]["past"] is True
        assert "Weight of chapter 3" in names(sequel_plan), "what the first book invented is part of the world now"
        assert "In chapter 1 Ilse Marrow" in bench.calls()[0]["prompt"], "the sequel is planned knowing what happened"
        assert len(bench.story(story_id)["chapters"]) == 4
        step("a sequel is a new book in a copy of the same world, with the old plot as history")

        # ------------------------------------------------------------------ fork
        bench.control()
        made = bench.ok("branch", book, "What if she burns the ledger?", 2)
        fork_book, fork_id = made["book"], made["story"]
        fork, parent = bench.story(fork_id), bench.story(story_id)
        assert bench.tasks() == ["replan", "chapter", "update"], bench.tasks()
        assert "What if she burns the ledger?" in bench.calls()[0]["prompt"]
        assert fork["lineage"]["kind"] == "fork" and fork["lineage"]["story"] == story_id and fork["lineage"]["chapter"] == 2
        assert fork["lineage"]["difference"] == "What if she burns the ledger?" and fork["title"] == "The Glass Tithe: The Other Door"
        assert [chapter["text"] for chapter in fork["chapters"][:2]] == [chapter["text"] for chapter in parent["chapters"][:2]]
        assert len(fork["chapters"]) == 3 and fork["chapters"][2]["number"] == 3 and len(parent["chapters"]) == 4
        assert fork["world"]["seen"] == "world:" + fork_id and fork["world"]["plan"] == "world:" + fork_id + ":plan"
        fork_seen, fork_plan = bench.scope(fork["world"]["seen"]), bench.scope(fork["world"]["plan"])
        assert "Weight of chapter 2" in names(fork_seen) and "Weight of chapter 3" not in names(fork_seen), names(fork_seen)
        assert "Weight of chapter 4" not in names(fork_plan) and "Weight of chapter 2" in names(fork_plan) and "Ilse Marrow" in names(fork_plan)
        assert "Weight of chapter 4" in names(bench.scope(plan)), "the parent's world is untouched"
        listed = {entry["id"]: entry for entry in bench.json("list")}
        assert listed[fork_book]["identifiers"]["storyteller"] == fork_id and listed[fork_book]["title"] == fork["title"]
        assert "A branch of" in bench.json("show", fork_book)["description"]
        step("a branch is a new book: the chapters up to there, both graphs copied and cut back, its lineage kept")

        # ------------------------------------------------ not for other books
        bench.control()
        before = open(bench.json("show", human)["files"]["md"]).read()
        for function, arguments in (("branch", [human, "another way"]), ("steer", [human, "faster"]), ("nextChapter", [human]),
                                    ("sequel", [human, ""]), ("askAuthor", [human, "why?"])):
            refused = bench.run(function, *arguments)
            assert "was not written by Storyteller" in refused.get("error", ""), (function, refused)
        refused = bench.run("command:story-branch", {"book": human, "place": "reader"})
        assert "was not written by Storyteller" in " ".join(refused["said"]), refused
        turned = bench.run("event:page.turned", {"id": human, "generated": "", "identifiers": {}, "section": 0, "sections": 1, "fraction": 0.9, "percent": 90})
        assert not turned.get("error")
        assert bench.ok("overwrite", human, plugin="seed").startswith("refused"), "the host refuses to rewrite a person's book"
        assert bench.ok("overwrite", book, plugin="seed").startswith("refused"), "and another plugin's"
        assert bench.tasks() == [] and open(bench.json("show", human)["files"]["md"]).read() == before
        assert len(bench.json("list")) == 4
        step("a book by a person can't be branched, steered, continued or rewritten")

        # ------------------------------------------------ answers that are no good
        bench.control(empty="chapter")
        failed = bench.run("nextChapter", sequel_book)
        assert "could not be used, twice" in failed.get("error", ""), failed
        assert bench.tasks() == ["chapter", "chapter"], bench.tasks()
        assert len(bench.story(sequel_id)["chapters"]) == 1
        assert bench.ok("unfinished")[0]["state"] == "failed"
        bench.control()
        bench.turn(sequel_book, sequel_id, 0, 0.9)
        assert bench.tasks() == [], "a failed chapter is not tried again by itself"
        bench.ok("nextChapter", sequel_book)
        assert bench.tasks() == ["chapter", "update"] and len(bench.story(sequel_id)["chapters"]) == 2
        step("an empty answer is asked for once more, then reported; the story file is untouched and a retry works")

        bench.control(collide_chapter=True, rename_bad=True)
        failed = bench.run("nextChapter", sequel_book)
        assert "names that belong to existing books" in failed.get("error", "") and "Vesper Quill" in failed["error"], failed
        assert bench.tasks() == ["chapter", "rename", "rename"], bench.tasks()
        assert len(bench.story(sequel_id)["chapters"]) == 2 and "Tally 3" not in bench.omabook("toc", sequel_book).stdout
        bench.ok("abandon", sequel_id)
        assert bench.ok("unfinished") == [] and len(bench.story(sequel_id)["chapters"]) == 2
        step("a chapter that still uses a library name after two renames is not published")

        # ----------------------------------------------------------- odds and ends
        bench.control()
        bench.ok("settings", {"write_ahead": False})
        bench.turn(fork_book, fork_id, 2, 0.9)
        assert bench.tasks() == []
        bench.ok("settings", {"write_ahead": True})
        step("with writing ahead switched off, turning pages writes nothing")

        master = os.path.join(bench.plugin, "data", "stories", fork_id + ".story")
        os.remove(master)
        bench.omabook("toc", fork_book)
        assert os.path.exists(master) and bench.story(fork_id)["title"] == fork["title"]
        step("a story whose working copy is lost gets it back from the library's copy")

        overview = {entry["story"]: entry for entry in bench.ok("stories")}
        assert overview[story_id]["chapters"] == 4 and overview[story_id]["ended"] and overview[fork_id]["lineage"]["kind"] == "fork"
        view = bench.ok("world", book)
        assert view["scope"] == seen and "Ilse Marrow" in [node["name"] for node in view["nodes"]]
        general = bench.json("graph", "show")
        assert not [node for node in general["nodes"] if node["name"] in ("Ilse Marrow", "Teodor Vash", "Brinehollow")]
        step("the general graph holds nothing of the made-up worlds")

        print("\nAll %d steps passed." % len(passed))
        if "--keep" in sys.argv:
            print("The scratch folder is kept: " + bench.scratch)
        else:
            shutil.rmtree(bench.scratch, ignore_errors=True)
        return 0
    except AssertionError as error:
        import traceback
        line = traceback.extract_tb(error.__traceback__)[-1]
        print("\nFAILED after %d steps, at line %d (%s): %s" % (len(passed), line.lineno, line.line, error))
        print("The scratch folder is kept: " + bench.scratch)
        return 1
    except subprocess.TimeoutExpired as error:
        print("\nFAILED after %d steps: Omabook did not come back: %s" % (len(passed), error))
        print("The scratch folder is kept: " + bench.scratch)
        return 1


if __name__ == "__main__":
    sys.exit(main())
