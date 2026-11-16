#!/usr/bin/env python3
"""Function complexity budget (lizard), for the functions a change adds or makes worse.

A function fails when, as the change leaves it, it is over a limit AND it is
new or got worse on that measure. A function that was over before and is no
worse is left alone: that is old code, not the change's.

Limits (also in .agents/rules/30-size-and-complexity.md):
  cyclomatic complexity  15
  lines of code          80   (non-blank, non-comment)
  parameters              6

Git is the baseline: the function before the change is read from the base,
so there is no file of numbers to keep up to date.

  --report PATHS   the functions of the given files that are over a limit
"""

from __future__ import annotations

import argparse
import csv
import io
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

from harness import ROOT, Scope, report

LIZARD_VERSION = "1.26.0"
CHECKED = frozenset({".js", ".py"})
LIMITS = {"ccn": 15, "nloc": 80, "params": 6}
NAMES = {"ccn": "cyclomatic complexity", "nloc": "lines of code", "params": "parameters"}


@dataclass(frozen=True)
class Function:
    name: str
    line: int
    ccn: int
    nloc: int
    params: int


def lizard() -> list[str] | None:
    if binary := shutil.which("lizard"):
        return [binary]
    if uvx := shutil.which("uvx"):
        return [uvx, f"lizard=={LIZARD_VERSION}"]
    return None


def measure(command: list[str], texts: dict[str, str]) -> dict[str, dict[str, Function]]:
    """The functions of each text, by their full signature."""
    with tempfile.TemporaryDirectory() as folder:
        files = {}
        for key, text in texts.items():
            target = Path(folder) / f"{len(files)}{Path(key.split('@')[0]).suffix}"
            target.write_text(text, encoding="utf-8")
            files[str(target)] = key
        result = subprocess.run([*command, "--csv", *files], capture_output=True, text=True)
    measured: dict[str, dict[str, Function]] = {key: {} for key in texts}
    for row in csv.reader(io.StringIO(result.stdout)):
        if len(row) < 11 or row[6] not in files:
            continue
        nloc, ccn, _, params, _, _, file, _, long_name, start, _ = row[:11]
        measured[files[file]][long_name] = Function(long_name, int(start), int(ccn), int(nloc), int(params))
    return measured


def over_limits(function: Function) -> list[str]:
    return [f"{NAMES[key]} {getattr(function, key)}" for key, limit in LIMITS.items() if getattr(function, key) > limit]


def report_functions(command: list[str], paths: list[str]) -> int:
    texts = {path: (ROOT / path).read_text(encoding="utf-8", errors="replace") for path in paths}
    for path, functions in measure(command, texts).items():
        for function in functions.values():
            if over := over_limits(function):
                print(f"{path}:{function.line}: {function.name}: {', '.join(over)}")
    return 0


def worse(path: str, function: Function, old: Function | None) -> list[str]:
    """The limits `function` is over and that the change made it reach (or a new function is over)."""
    found = []
    for key, limit in LIMITS.items():
        value = getattr(function, key)
        if value > limit and (old is None or value > getattr(old, key)):
            was = f", was {getattr(old, key)}" if old else ", new"
            found.append(f"{path}:{function.line}: {function.name}: {NAMES[key]} {value} > {limit}{was}")
    return found


def check(command: list[str], scope: Scope) -> int:
    paths = [p for p in scope.files() if Path(p).suffix in CHECKED]
    if not paths:
        return 0
    texts = {f"{p}@after": scope.after(p) for p in paths}
    texts |= {f"{p}@before": before for p in paths if (before := scope.before(p)) is not None}
    measured = measure(command, texts)
    findings = []
    for path in paths:
        before = measured.get(f"{path}@before", {})
        for function in measured[f"{path}@after"].values():
            findings += worse(path, function, before.get(function.name))
    return report("complexity", findings, "split the function by what it does; see .agents/rules/30-size-and-complexity.md")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--report", nargs="+", metavar="PATH")
    known, rest = parser.parse_known_args(argv)
    command = lizard()
    if command is None:
        print("check_complexity: neither lizard nor uvx is installed; skipped.", file=sys.stderr)
        return 0
    if known.report:
        return report_functions(command, known.report)
    scope_parser = argparse.ArgumentParser()
    Scope.add_arguments(scope_parser)
    return check(command, Scope.from_arguments(scope_parser.parse_args(rest)))


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
