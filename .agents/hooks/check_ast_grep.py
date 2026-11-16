#!/usr/bin/env python3
"""The plugin's structural rules (rules/js, ast-grep), on the lines a change adds.

An error fails the check; a warning is printed and does not. Rules and their
reasons: rules/js/*.yml. Their own cases: `ast-grep test` (rule-tests/).
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys

from harness import JS_SUFFIXES, ROOT, Scope, report, touches

AST_GREP_VERSION = "0.51.1"


def ast_grep() -> list[str] | None:
    """How to run ast-grep: installed, or through uvx at the pinned version."""
    if binary := shutil.which("ast-grep"):
        return [binary]
    if uvx := shutil.which("uvx"):
        return [uvx, "--from", f"ast-grep-cli=={AST_GREP_VERSION}", "ast-grep"]
    return None


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    Scope.add_arguments(parser)
    scope = Scope.from_arguments(parser.parse_args(argv))

    selected = {path: scope.added_lines(path) for path in scope.files(JS_SUFFIXES)}
    selected = {path: lines for path, lines in selected.items() if lines != set()}
    if not selected:
        return 0
    command = ast_grep()
    if command is None:
        print("check_ast_grep: neither ast-grep nor uvx is installed; skipped.", file=sys.stderr)
        return 0 if scope.mode == "changed" else 1

    result = subprocess.run([*command, "scan", "--json=compact", *selected], cwd=ROOT, capture_output=True, text=True)
    if result.returncode not in (0, 1) or not result.stdout.strip().startswith("["):
        print(f"check_ast_grep: ast-grep failed: {result.stderr.strip()}", file=sys.stderr)
        return 1

    errors, warnings = [], []
    for finding in json.loads(result.stdout):
        path = finding["file"].removeprefix("./")
        start, end = finding["range"]["start"]["line"] + 1, finding["range"]["end"]["line"] + 1
        if path in selected and touches(selected[path], start, end):
            line = f"{path}:{start}: [{finding['ruleId']}] {finding['message']}"
            (errors if finding["severity"] == "error" else warnings).append(line)
    if warnings:
        report("ast-grep (warnings, not blocking)", warnings)
    return report("ast-grep", errors, "the rule's note in rules/js/<rule>.yml says why and what to write instead")


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
