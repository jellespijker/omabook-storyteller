#!/usr/bin/env python3
"""Checks a file right after an agent edits it, so the agent fixes it while it is still in context.

Claude Code runs this after Write, Edit and MultiEdit (.claude/settings.json)
with the call as JSON on stdin. It runs the fast checks on that one file:
the structural rules, the layers, Python lint, its size and complexity.

Exit 2 shows the findings to the agent; the edit itself has already happened.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from harness import ROOT, relative

HOOKS = Path(__file__).resolve().parent
CHECKS = ("check_ast_grep.py", "check_layers.py", "check_python.py", "check_file_size.py", "check_complexity.py")


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        path = relative((payload.get("tool_input") or {}).get("file_path", ""))
    except (ValueError, TypeError, AttributeError):
        return 0
    if not path or not (ROOT / path).is_file():
        return 0
    failed = False
    for check in CHECKS:
        result = subprocess.run([sys.executable, str(HOOKS / check), "--changed", path], cwd=ROOT, capture_output=True, text=True)
        if result.returncode:
            failed = True
            sys.stderr.write(result.stderr)
        elif result.stderr.strip():
            sys.stderr.write(result.stderr)  # warnings and notes: shown, not blocking
    return 2 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
