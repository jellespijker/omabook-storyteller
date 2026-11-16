#!/usr/bin/env python3
"""ruff (ruff.toml), on the Python a change adds: lint on its new lines, format on new files.

Old files are not reformatted wholesale: that is a change of its own.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys

from harness import ROOT, Scope, report, touches

RUFF_VERSION = "0.17.5"


def ruff() -> list[str] | None:
    if binary := shutil.which("ruff"):
        return [binary]
    if uvx := shutil.which("uvx"):
        return [uvx, f"ruff=={RUFF_VERSION}"]
    return None


def lint(command: list[str], selected: dict[str, set[int] | None]) -> list[str]:
    result = subprocess.run([*command, "check", "--output-format=json", "--quiet", *selected], cwd=ROOT, capture_output=True, text=True)
    findings = []
    for finding in json.loads(result.stdout or "[]"):
        path = finding["filename"].removeprefix(str(ROOT) + "/")
        line = finding["location"]["row"]
        if path in selected and touches(selected[path], line, finding["end_location"]["row"]):
            findings.append(f"{path}:{line}: [{finding['code']}] {finding['message']}")
    return findings


def unformatted(command: list[str], scope: Scope, paths: list[str]) -> list[str]:
    found = []
    for path in paths:
        result = subprocess.run(
            [*command, "format", "--check", "--quiet", f"--stdin-filename={path}", "-"],
            cwd=ROOT,
            input=scope.after(path),
            capture_output=True,
            text=True,
        )
        if result.returncode:
            found.append(f"{path}: not formatted (a new file is checked whole; `ruff format {path}`)")
    return found


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    Scope.add_arguments(parser)
    scope = Scope.from_arguments(parser.parse_args(argv))
    selected = {path: scope.added_lines(path) for path in scope.files(frozenset({".py"}))}
    selected = {path: lines for path, lines in selected.items() if lines != set()}
    if not selected:
        return 0
    command = ruff()
    if command is None:
        print("check_python: neither ruff nor uvx is installed; skipped.", file=sys.stderr)
        return 0
    findings = lint(command, selected)
    findings += unformatted(command, scope, [path for path, lines in selected.items() if lines is None])
    return report("ruff", findings, "`uvx ruff check --fix <file>` fixes many of these")


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
