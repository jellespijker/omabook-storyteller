"""Shared plumbing for the harness checks: what changed, and how to report it.

Every check looks only at what a change adds. Old code that predates a rule is
not a finding; a check that complains about untouched code gets switched off,
and then it guards nothing.

A change is compared with a base, chosen by the mode a check runs in:

  --staged         the index against HEAD (the pre-commit hook)
  --changed PATHS  the working tree against HEAD (the agents' edit hooks)
  --base REF       the working tree against the merge base with REF (CI)
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JS_SUFFIXES = frozenset({".js"})
HUNK = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")


def git(*args: str, check: bool = True) -> str:
    result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if check and result.returncode:
        raise RuntimeError(result.stderr.strip() or f"git {' '.join(args)} failed")
    return result.stdout


@dataclass(frozen=True)
class Scope:
    """Which change is checked: its files, its new lines, its before and after."""

    mode: str  # "staged", "changed" or "base"
    base: str = "HEAD"
    paths: tuple[str, ...] = ()

    @staticmethod
    def add_arguments(parser: argparse.ArgumentParser) -> None:
        group = parser.add_mutually_exclusive_group(required=True)
        group.add_argument("--staged", action="store_true", help="check the index against HEAD")
        group.add_argument("--changed", nargs="*", metavar="PATH", help="check the working tree against HEAD")
        group.add_argument("--base", metavar="REF", help="check the working tree against the merge base with REF")

    @classmethod
    def from_arguments(cls, args: argparse.Namespace) -> Scope:
        if args.staged:
            return cls("staged")
        if args.base:
            merge_base = git("merge-base", args.base, "HEAD").strip()
            return cls("base", merge_base)
        return cls("changed", "HEAD", tuple(relative(p) for p in args.changed if relative(p)))

    def _diff_args(self) -> list[str]:
        return ["--cached", self.base] if self.mode == "staged" else [self.base]

    def files(self, suffixes: frozenset[str] | None = None) -> list[str]:
        """Files the change adds or modifies (never deleted ones)."""
        names = set(git("diff", "--name-only", "--diff-filter=AMR", *self._diff_args(), "--", *self.paths).split())
        if self.mode != "staged":
            names |= set(git("ls-files", "--others", "--exclude-standard", "--", *self.paths).split())
        if self.paths:
            names &= set(self.paths)
        return sorted(n for n in names if (ROOT / n).is_file() and (suffixes is None or Path(n).suffix in suffixes))

    def added_lines(self, path: str) -> set[int] | None:
        """Line numbers the change adds to `path`; None when the whole file is new."""
        if self.before(path) is None:
            return None
        diff = git("diff", "--no-ext-diff", "--unified=0", *self._diff_args(), "--", path)
        lines: set[int] = set()
        for line in diff.splitlines():
            if match := HUNK.match(line):
                start, count = int(match.group(1)), int(match.group(2) or 1)
                lines.update(range(start, start + count))
        return lines

    def before(self, path: str) -> str | None:
        """The file as it was at the base; None when it did not exist."""
        result = subprocess.run(["git", "show", f"{self.base}:{path}"], cwd=ROOT, capture_output=True, text=True)
        return result.stdout if result.returncode == 0 else None

    def after(self, path: str) -> str:
        """The file as the change leaves it."""
        if self.mode == "staged":
            return git("show", f":{path}")
        return (ROOT / path).read_text(encoding="utf-8", errors="replace")


def relative(path: str) -> str:
    """`path` relative to the repository, or "" when it lies outside it."""
    resolved = (ROOT / path).resolve()
    return resolved.relative_to(ROOT).as_posix() if resolved.is_relative_to(ROOT) else ""


def touches(lines: set[int] | None, start: int, end: int) -> bool:
    return lines is None or any(line in lines for line in range(start, end + 1))


def report(check: str, findings: list[str], hint: str = "") -> int:
    """Print the findings for a person or an agent to act on; 1 when there are any."""
    if not findings:
        return 0
    print(f"{check}: {len(findings)} finding(s)", file=sys.stderr)
    for finding in findings:
        print(f"  {finding}", file=sys.stderr)
    if hint:
        print(f"  -> {hint}", file=sys.stderr)
    return 1
