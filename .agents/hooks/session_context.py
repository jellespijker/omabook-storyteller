#!/usr/bin/env python3
"""What an agent is told when a session starts: the ticket it is on and the harness's rules."""

from __future__ import annotations

import re

from harness import ROOT, git


def main() -> None:
    branch = git("branch", "--show-current", check=False).strip()
    ticket = re.fullmatch(r"kanban/issue-(\d+)", branch)
    print(f"Branch {branch or '(detached)'}" + (f", ticket #{ticket.group(1)}: name it in every commit." if ticket else "."))
    print("Development happens in the omabook-workspace (its AGENTS.md); start with `herdr-kanban board`.")
    print("The harness checks every edit and commit. Its rules, read the one that applies before writing code:")
    for rule in sorted((ROOT / ".agents/rules").glob("*.md")):
        first = next((line for line in rule.read_text(encoding="utf-8").splitlines() if line.startswith("# ")), rule.stem)
        print(f"  .agents/rules/{rule.name}: {first.removeprefix('# ')}")


if __name__ == "__main__":
    main()
