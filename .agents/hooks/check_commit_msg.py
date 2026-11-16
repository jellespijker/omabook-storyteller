#!/usr/bin/env python3
"""A commit message names the GitHub issue it belongs to (the commit-msg hook).

`#29` for an issue of this repository, `jellespijker/omabook-storyteller#2`
for another's. Merges, reverts and fixup!/squash!/amend! commits are exempt.

  check_commit_msg.py FILE        check a message file (pre-commit passes it)
  check_commit_msg.py --range R   check every commit in R (CI: origin/main..HEAD)
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from harness import git

ISSUE = re.compile(r"(?:\b[\w.-]+/[\w.-]+)?#\d+\b")
EXEMPT = ("Merge ", "Revert ", "fixup!", "squash!", "amend!")


def problem(message: str) -> str | None:
    text = "\n".join(line for line in message.splitlines() if not line.startswith("#"))
    if text.startswith(EXEMPT) or ISSUE.search(text):
        return None
    subject = text.strip().splitlines()[0] if text.strip() else "(empty)"
    return f"names no GitHub issue: {subject!r}"


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("file", nargs="?")
    parser.add_argument("--range")
    args = parser.parse_args(argv)
    if args.range:
        failures = []
        for sha in git("rev-list", "--no-merges", args.range).split():
            if reason := problem(git("log", "-1", "--format=%B", sha)):
                failures.append(f"{sha[:8]} {reason}")
    elif args.file:
        reason = problem(Path(args.file).read_text(encoding="utf-8"))
        failures = [reason] if reason else []
    else:
        parser.error("give a message file or --range")
    for failure in failures:
        print(f"commit message {failure}", file=sys.stderr)
    if failures:
        print("  -> add the issue's number, e.g. `(#29)`; see AGENTS.md, Commits", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
