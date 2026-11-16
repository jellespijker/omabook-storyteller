#!/usr/bin/env python3
"""File-size budget, with a ratchet for the files that were over it already.

A file stays within its budget (`budgets` in .agents/file-size-baseline.json:
the first glob that matches). A file that was over budget when the check came
in is listed with its size then: it may shrink, never grow, and when it shrinks
its ceiling comes down with it. A new file is never listed: it meets the budget.

Splitting a file honestly is in .agents/rules/30-size-and-complexity.md;
squeezing lines together to pass is not.

  --report [PATHS]   size, ceiling and headroom of the given files (all when none)
  --init             write the baseline from the tree as it is (once, when the check is introduced)
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import sys
from pathlib import Path

from harness import ROOT, Scope, git, report

BASELINE = ROOT / ".agents/file-size-baseline.json"
CHECKED = frozenset({".js", ".qml", ".py", ".sh", ".cpp"})
EXCLUDED = ()
BUDGETS = {"*": 500}


def load() -> dict:
    return json.loads(BASELINE.read_text(encoding="utf-8"))


def budget(baseline: dict, path: str) -> int:
    return next(limit for glob, limit in baseline["budgets"].items() if fnmatch.fnmatch(path, glob))


def checked(path: str) -> bool:
    return Path(path).suffix in CHECKED and not path.startswith(EXCLUDED)


def lines(text: str) -> int:
    return text.count("\n") + (0 if text.endswith("\n") or not text else 1)


def save(baseline: dict) -> None:
    BASELINE.write_text(json.dumps(baseline, indent=2, sort_keys=False) + "\n", encoding="utf-8")


def size_on_disk(path: str) -> int:
    return lines((ROOT / path).read_text(encoding="utf-8", errors="replace"))


def init() -> int:
    tracked = [p for p in git("ls-files").split() if checked(p) and (ROOT / p).is_file()]
    defaults = {"budgets": BUDGETS}
    files = {path: size for path in tracked if (size := size_on_disk(path)) > budget(defaults, path)}
    save({"comment": COMMENT, "budgets": BUDGETS, "files": dict(sorted(files.items()))})
    print(f"check_file_size: {len(files)} files over budget recorded")
    return 0


def report_sizes(baseline: dict, paths: list[str]) -> int:
    for path in paths or [p for p in git("ls-files").split() if checked(p)]:
        size = size_on_disk(path)
        ceiling = baseline["files"].get(path, budget(baseline, path))
        print(f"{size:6} / {ceiling:<6} headroom {ceiling - size:6}  {path}")
    return 0


def lower_ceilings(baseline: dict, shrunk: dict[str, int], scope: Scope) -> int:
    """A grandfathered file that shrank keeps its new size as its ceiling."""
    for path, size in shrunk.items():
        if size <= budget(baseline, path):
            del baseline["files"][path]
        else:
            baseline["files"][path] = size
    if scope.mode == "changed":
        print(f"file size: {', '.join(shrunk)} shrank; the commit will lower the ceiling.", file=sys.stderr)
        return 0
    save(baseline)
    return report(
        "file size (ceiling lowered)",
        [f"{path}: ceiling is now {size}" for path, size in shrunk.items()],
        "the baseline was updated; stage .agents/file-size-baseline.json with the change",
    )


def check(baseline: dict, scope: Scope) -> int:
    over, shrunk = [], {}
    for path in filter(checked, scope.files()):
        size = lines(scope.after(path))
        ceiling = baseline["files"].get(path, budget(baseline, path))
        if size > ceiling:
            kind = "grandfathered, may not grow" if path in baseline["files"] else "budget"
            over.append(f"{path}: {size} lines, over its ceiling of {ceiling} ({kind}) by {size - ceiling}")
        elif path in baseline["files"] and size < ceiling:
            shrunk[path] = size
    status = report("file size", over, "split a responsibility out into a new file; see .agents/rules/30-size-and-complexity.md")
    return status | (lower_ceilings(baseline, shrunk, scope) if shrunk else 0)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--init", action="store_true")
    parser.add_argument("--report", nargs="*", metavar="PATH")
    known, rest = parser.parse_known_args(argv)
    if known.init:
        return init()
    if known.report is not None:
        return report_sizes(load(), known.report)
    scope_parser = argparse.ArgumentParser()
    Scope.add_arguments(scope_parser)
    return check(load(), Scope.from_arguments(scope_parser.parse_args(rest)))


COMMENT = (
    "Files over budget when the check came in, at their size then. They may shrink, never grow; "
    "a file that shrinks lowers its own ceiling and leaves the list once within budget. Never add an entry by hand."
)

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
