#!/usr/bin/env python3
"""Stops an agent's tool call before it does something the harness forbids.

Claude Code runs this before Bash, Write, Edit and MultiEdit (.claude/settings.json)
and hands it the pending call as JSON on stdin. Exit 2 blocks the call and
shows the reason to the agent; exit 0 lets it through.

What it stops:
  - writing a secret (a private key, a token) or a path in someone's home folder into the repository;
  - a commit whose message names no GitHub issue (#12, or owner/repo#12);
  - skipping the hooks (--no-verify, commit -n);
  - an unlimited parallel build (bare -j, -j$(nproc)), which runs this machine out of memory;
  - force-pushing main.

The pre-commit hooks look at what is staged, so they can only refuse after the
fact; this looks at the call itself. It fails open: a payload it can't read
lets the call through, because a guard that blocks everything gets switched off.
"""

from __future__ import annotations

import json
import re
import sys

SECRETS = {
    "a private key": re.compile(r"-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----"),
    "an AWS access key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "a GitHub token": re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b"),
    "an Anthropic or OpenAI key": re.compile(r"\bsk-(?:ant-)?[A-Za-z0-9_-]{32,}\b"),
    "a Slack token": re.compile(r"\bxox[abposr]-[A-Za-z0-9-]{10,}\b"),
    "a Google API key": re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"),
    "a Sentry DSN with its key": re.compile(r"https://[0-9a-f]{32}@[\w.-]+\.ingest\.[\w.]*sentry\.io/\d+"),
}
HOME_PATH = re.compile(r"(?<![\w.])/(?:home|Users)/(?!user/|tester/|runner/|\$|<)[a-z][\w.-]*/")
COMMIT = re.compile(r"\bgit\s+(?:-\S+\s+)*commit\b")
ISSUE = re.compile(r"(?:\b[\w.-]+/[\w.-]+)?#\d+\b")
MESSAGE = re.compile(r"""(?:-m|--message)(?:\s+|=)(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+))""")
NO_VERIFY = re.compile(r"\bgit\s+(?:-\S+\s+)*(?:commit|push|merge|rebase)\b[^|;&]*(?:--no-verify\b|\s-[a-zA-Z]*n[a-zA-Z]*\b)")
UNLIMITED_JOBS = re.compile(
    r"(?:\bmake|\bninja|cmake\s+--build|\bctest)\b[^|;&]*"  # a build or a test run, and in it
    r"(?:\s-j\s*(?:$|[|;&]|\s-)"  # a bare -j
    r"|\s(?:-j|--parallel)\s*=?\s*\$\(\s*nproc\s*\)"  # -j$(nproc)
    r"|\s--parallel\s*(?:$|[|;&]|\s-))"  # a bare --parallel
)
FORCE_MAIN = re.compile(r"\bgit\s+push\b(?=[^|;&]*(?:--force\b|\s-f\b|\+main\b))(?=[^|;&]*\bmain\b)")


def block(reason: str) -> int:
    print(f"Blocked by the harness (.agents/hooks/pretool_guard.py): {reason}", file=sys.stderr)
    return 2


def written(tool: str, args: dict) -> list[str]:
    if tool == "Write":
        return [args.get("content", "")]
    if tool == "Edit":
        return [args.get("new_string", "")]
    if tool == "MultiEdit":
        return [edit.get("new_string", "") for edit in args.get("edits", [])]
    return []


def check_text(texts: list[str], path: str) -> int:
    for text in texts:
        for what, pattern in SECRETS.items():
            if pattern.search(text):
                return block(f"this writes {what} into {path}. Keep secrets out of the repository (the keyring, an environment variable).")
        if match := HOME_PATH.search(text):
            return block(
                f"this writes a home folder's path ({match.group(0)}) into {path}; use a path relative to the repository, or $HOME."
            )
    return 0


def unquoted(command: str) -> str:
    """The command without its quoted strings, so a message that says "-n" is not a flag."""
    return re.sub(r"""\"(?:[^"\\]|\\.)*\"|'[^']*'""", '""', command)


def check_command(command: str) -> int:
    bare = unquoted(command)
    if NO_VERIFY.search(bare):
        return block("--no-verify / -n skips the hooks. Fix what they report instead.")
    if UNLIMITED_JOBS.search(bare):
        return block("an unlimited or -j$(nproc) build runs this machine out of memory. Give -j a number that fits its memory.")
    if FORCE_MAIN.search(bare):
        return block("force-pushing main rewrites history others have.")
    if COMMIT.search(command) and (match := MESSAGE.search(command)):
        message = next(group for group in match.groups() if group is not None)
        if not ISSUE.search(message) and not message.startswith(("Merge", "Revert", "fixup!", "squash!", "amend!")):
            return block("the commit message names no GitHub issue. Add its number, e.g. `(#2)`, or owner/repo#N for another repository's.")
    return 0


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        tool = payload["tool_name"]
        args = payload.get("tool_input") or {}
    except (ValueError, KeyError, TypeError):
        return 0
    if tool == "Bash":
        return check_command(args.get("command", ""))
    return check_text(written(tool, args), args.get("file_path", "the file"))


if __name__ == "__main__":
    sys.exit(main())
