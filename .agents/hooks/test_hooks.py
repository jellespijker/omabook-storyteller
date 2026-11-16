#!/usr/bin/env python3
"""Each harness check fires on what it is for, and stays quiet on old code.

Every test works in a scratch git repository holding a copy of the harness, so
the checks see a real diff. Run: python3 .agents/hooks/test_hooks.py
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path
from unittest import mock

REPO = Path(__file__).resolve().parents[2]
HARNESS = [".agents", "rules", "rule-tests", "sgconfig.yml", "ruff.toml"]


def isolated() -> dict[str, str]:
    """This process's environment without git's own variables.

    Run as a hook, these tests inherit GIT_DIR, GIT_INDEX_FILE and the rest from
    the commit being made, and every git command would work on that repository
    instead of the scratch one: commit into it, write its config, re-init it.
    """
    return {name: value for name, value in os.environ.items() if not name.startswith("GIT_")}


class Scratch:
    """A repository with the harness and one committed source file per test."""

    def __init__(self) -> None:
        self.folder = tempfile.TemporaryDirectory()
        self.root = Path(self.folder.name)
        for item in HARNESS:
            source, target = REPO / item, self.root / item
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copytree(source, target, ignore=shutil.ignore_patterns("__pycache__")) if source.is_dir() else shutil.copy2(
                source, target
            )
        (self.root / "lib").mkdir()
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.email", "harness@example.invalid")
        self.git("config", "user.name", "Harness test")
        self.commit()

    def git(self, *args: str) -> None:
        subprocess.run(["git", *args], cwd=self.root, check=True, capture_output=True, env=isolated())

    def write(self, path: str, text: str) -> None:
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(textwrap.dedent(text).lstrip(), encoding="utf-8")

    def commit(self) -> None:
        self.git("add", "-A")
        self.git("commit", "-q", "--no-verify", "-m", "Start (#1)")

    def run(self, check: str, *args: str, stdin: str | None = None) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(self.root / ".agents/hooks" / check), *args],
            cwd=self.root,
            input=stdin,
            capture_output=True,
            text=True,
            env=isolated(),
        )

    def close(self) -> None:
        self.folder.cleanup()


class HarnessTest(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = Scratch()

    def tearDown(self) -> None:
        self.repo.close()

    def assertFires(self, result: subprocess.CompletedProcess, text: str) -> None:
        self.assertNotEqual(result.returncode, 0, result.stderr)
        self.assertIn(text, result.stderr)

    def assertQuiet(self, result: subprocess.CompletedProcess) -> None:
        self.assertEqual(result.returncode, 0, result.stderr)


class Isolation(unittest.TestCase):
    def test_a_hooks_git_variables_leave_that_repository_alone(self) -> None:
        with tempfile.TemporaryDirectory() as other:
            subprocess.run(["git", "init", "-q", other], check=True, env=isolated())
            config = (Path(other) / ".git/config").read_text(encoding="utf-8")
            hook = {"GIT_DIR": f"{other}/.git", "GIT_INDEX_FILE": f"{other}/.git/index", "GIT_WORK_TREE": other}
            with mock.patch.dict(os.environ, hook):
                repo = Scratch()
                repo.write("lib/a.js" if (REPO / "main.js").exists() else "src/a.cpp", "x\n")
                repo.commit()
                repo.close()
            self.assertEqual((Path(other) / ".git/config").read_text(encoding="utf-8"), config)
            log = subprocess.run(["git", "-C", other, "log", "--oneline"], capture_output=True, text=True, env=isolated())
            self.assertEqual(log.stdout, "", "a commit went into the repository the hook ran for")


class PretoolGuard(HarnessTest):
    def guard(self, tool: str, **args: str) -> subprocess.CompletedProcess:
        return self.repo.run("pretool_guard.py", stdin=json.dumps({"tool_name": tool, "tool_input": args}))

    def test_commit_must_name_an_issue(self) -> None:
        self.assertFires(self.guard("Bash", command='git commit -m "Tidy the shelf"'), "names no GitHub issue")
        self.assertQuiet(self.guard("Bash", command='git commit -m "Tidy the shelf (#29)"'))
        self.assertQuiet(self.guard("Bash", command='git commit -m "Tidy it, for jellespijker/omabook-storyteller#2"'))

    def test_hooks_are_not_skipped(self) -> None:
        self.assertFires(self.guard("Bash", command='git commit --no-verify -m "x (#1)"'), "skips the hooks")
        self.assertQuiet(self.guard("Bash", command='git commit -m "Add the -name flag (#1)"'))

    def test_builds_are_limited(self) -> None:
        self.assertFires(self.guard("Bash", command="cmake --build build -j$(nproc)"), "out of memory")
        self.assertFires(self.guard("Bash", command="make -j"), "out of memory")
        self.assertQuiet(self.guard("Bash", command='cmake --build build -j"$(bin/jobs)"'))

    def test_secrets_and_home_paths_are_not_written(self) -> None:
        token = "ghp_" + "a1" * 20
        self.assertFires(self.guard("Write", file_path="lib/a.js", content=f'var t = "{token}";'), "GitHub token")
        self.assertFires(self.guard("Edit", file_path="lib/a.js", new_string='var p = "/home/someone/Books";'), "home folder")
        self.assertQuiet(self.guard("Edit", file_path="lib/a.js", new_string="var p = omabook.files.home();"))

    def test_unreadable_payload_lets_the_call_through(self) -> None:
        self.assertQuiet(self.repo.run("pretool_guard.py", stdin="not json"))


class CommitMessage(HarnessTest):
    def message(self, text: str) -> subprocess.CompletedProcess:
        (self.repo.root / "MSG").write_text(text, encoding="utf-8")
        return self.repo.run("check_commit_msg.py", "MSG")

    def test_names_an_issue(self) -> None:
        self.assertFires(self.message("Tidy the shelf\n"), "names no GitHub issue")
        self.assertQuiet(self.message("Tidy the shelf\n\nPart of #29.\n"))
        self.assertQuiet(self.message("Merge branch 'kanban/issue-29'\n"))


class AstGrep(HarnessTest):
    def test_new_lines_are_checked_and_old_ones_are_not(self) -> None:
        self.repo.write("lib/old.js", "var Old = (function () { if (a == b) {} })();\n")
        self.repo.commit()
        self.repo.write("lib/old.js", "var Old = (function () { if (a == b) {} })();\nvar x = 1;\n")
        self.assertQuiet(self.repo.run("check_ast_grep.py", "--changed", "lib/old.js"))
        self.repo.write("lib/old.js", "var Old = (function () { if (a == b) {} })();\nsetTimeout(go, 10);\n")
        self.assertFires(self.repo.run("check_ast_grep.py", "--changed", "lib/old.js"), "no-timers")


class Layers(HarnessTest):
    def setUp(self) -> None:
        super().setUp()
        self.repo.write("main.js", 'omabook.include("lib/util.js");\nomabook.include("lib/writer.js");\n')
        self.repo.write("lib/util.js", "var Util = (function () { return {}; })();\n")
        self.repo.write("lib/writer.js", "var Writer = (function () { Util.text(); return {}; })();\n")
        self.repo.commit()

    def test_a_part_uses_only_the_parts_before_it(self) -> None:
        self.repo.write("lib/util.js", "var Util = (function () { Writer.go(); return {}; })();\n")
        self.assertFires(self.repo.run("check_layers.py", "--changed", "lib/util.js"), "uses Writer")

    def test_an_allowed_use_says_why(self) -> None:
        self.repo.write("lib/util.js", "var Util = (function () {\n    Writer.go(); // layers-allow: called late\n    return {};\n})();\n")
        self.assertQuiet(self.repo.run("check_layers.py", "--changed", "lib/util.js"))

    def test_every_part_is_included(self) -> None:
        self.repo.write("lib/stray.js", "var Stray = (function () { return {}; })();\n")
        self.assertFires(self.repo.run("check_layers.py", "--changed", "lib/stray.js"), "not included by main.js")


class Python(HarnessTest):
    def test_a_new_file_is_formatted_and_linted(self) -> None:
        self.repo.write("tests/fresh.py", "import os\nx=1\n")
        result = self.repo.run("check_python.py", "--changed", "tests/fresh.py")
        self.assertFires(result, "not formatted")
        self.assertIn("F401", result.stderr)


class FileSize(HarnessTest):
    def setUp(self) -> None:
        super().setUp()
        baseline = {"budgets": {"*": 500}, "files": {"lib/big.js": 600}}
        (self.repo.root / ".agents/file-size-baseline.json").write_text(json.dumps(baseline))

    def test_grandfathered_files_do_not_grow(self) -> None:
        self.repo.write("lib/big.js", "var x;\n" * 600)
        self.repo.commit()
        self.repo.write("lib/big.js", "var x;\n" * 601)
        self.assertFires(self.repo.run("check_file_size.py", "--changed", "lib/big.js"), "may not grow")

    def test_new_files_meet_the_budget(self) -> None:
        self.repo.write("lib/new.js", "var x;\n" * 501)
        self.assertFires(self.repo.run("check_file_size.py", "--changed", "lib/new.js"), "over its ceiling of 500")


class Complexity(HarnessTest):
    BRANCHY = "function pick(v) {\n" + "".join(f"    if (v === {i}) return {i};\n" for i in range(20)) + "    return -1;\n}\n"

    def test_a_new_complex_function_fails(self) -> None:
        self.repo.write("lib/pick.js", self.BRANCHY)
        self.assertFires(self.repo.run("check_complexity.py", "--changed", "lib/pick.js"), "cyclomatic complexity")

    def test_old_complexity_that_does_not_grow_passes(self) -> None:
        self.repo.write("lib/pick.js", self.BRANCHY)
        self.repo.commit()
        self.repo.write("lib/pick.js", self.BRANCHY + "function other() { return 1; }\n")
        self.assertQuiet(self.repo.run("check_complexity.py", "--changed", "lib/pick.js"))


if __name__ == "__main__":
    unittest.main()
