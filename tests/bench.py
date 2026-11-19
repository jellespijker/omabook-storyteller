"""The scratch bench the tests drive Omabook on: HOME and the XDG folders in a
scratch folder, the plugin installed there, and Omabook's AI set to the stand-in
model (tests/stub_ai.py). See tests/run.py for what is done on it.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile

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
        self.env = dict(
            os.environ,
            HOME=self.home,
            XDG_CONFIG_HOME=self.config,
            XDG_CACHE_HOME=os.path.join(self.home, ".cache"),
            XDG_DATA_HOME=os.path.join(self.home, ".data"),
            STUB_DIR=self.stub,
            QT_QPA_PLATFORM="offscreen",
        )
        self.env.pop("ANTHROPIC_API_KEY", None)
        with open(os.path.join(self.config, "omabook", "config.json"), "w") as file:
            json.dump(
                {
                    "library": self.library,
                    "ai_provider": "command",
                    "ai_command": f"{sys.executable} {os.path.join(ROOT, 'tests', 'stub_ai.py')}",
                    "graph": "off",
                },
                file,
            )
        # The plugin as it would be installed: everything but tests and data.
        shutil.copytree(ROOT, self.plugin, ignore=shutil.ignore_patterns(".git", "data", "tests", ".scratch", "__pycache__"))
        with open(os.path.join(self.plugins, "seed", "plugin.json"), "w") as file:
            json.dump({"name": "Seed", "script": "main.js", "permissions": ["files"]}, file)
        with open(os.path.join(self.plugins, "seed", "main.js"), "w") as file:
            file.write(SEED_PLUGIN)

    def omabook(self, *arguments, timeout=120, check=True):
        done = subprocess.run(
            [OMABOOK] + [str(argument) for argument in arguments] + ["--library", self.library],
            env=self.env,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if check and done.returncode != 0:
            raise AssertionError(f"omabook {' '.join(map(str, arguments))} failed:\n{done.stdout}\n{done.stderr}")
        return done

    def run(self, what, *arguments, plugin=NAME, timeout=120):
        """Runs a function or an event of the plugin; answers {result, said, log, error?}."""
        done = self.omabook(
            "plugin",
            "run",
            plugin,
            what,
            json.dumps(list(arguments)) if ":" not in what else json.dumps(arguments[0]),
            "--folder",
            self.plugins,
            "--json",
            timeout=timeout,
            check=False,
        )
        try:
            return json.loads(done.stdout)
        except ValueError:
            raise AssertionError(f"plugin run {what} printed no JSON:\n{done.stdout}\n{done.stderr}") from None

    def ok(self, what, *arguments, **options):
        answer = self.run(what, *arguments, **options)
        if answer.get("error"):
            log = "\n".join(answer.get("log", []))
            raise AssertionError(f"{what} failed: {answer['error']}\n{log}")
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

    def scopes(self):
        return [entry["scope"] for entry in self.json("graph", "scopes")["scopes"]]

    def turn(self, book, story, section, fraction, timeout=120):
        """The reader stops on a page: sets where the book was read to, and tells the plugin."""
        self.omabook("progress", book, "--section", section, "--fraction", fraction)
        return self.run(
            "event:page.turned",
            {
                "id": book,
                "generated": NAME,
                "identifiers": {"generated": NAME, "storyteller": story},
                "section": section,
                "sections": len(self.story(story)["chapters"]),
                "fraction": fraction,
                "percent": 0,
            },
            timeout=timeout,
        )


def names(view, kind=None):
    return sorted(node["name"] for node in view["nodes"] if kind is None or node["kind"] == kind)
