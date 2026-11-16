#!/usr/bin/env python3
"""The plugin's parts are layered by the order main.js includes them.

A script plugin has no modules: main.js includes each file in lib/, lowest
first, and each file makes one global (`var Util = (function () { ... })();`).
A file may use the globals of the files included before it, never those
after it, so the order in main.js is the dependency order.

Checks, for the code as a change leaves it:
  - every file in lib/ is included by main.js;
  - every file in lib/ makes exactly one global, at its top level;
  - no file uses the global of a file included after it.

Comments and strings are left out before looking for names, so a comment
that mentions a later part is fine. A use that must stay says so on its line,
with the reason: `// layers-allow: <why>`. It is a debt, not a pattern.
"""

from __future__ import annotations

import argparse
import functools
import re
import sys

from harness import ROOT, Scope, report

INCLUDE = re.compile(r'^\s*omabook\.include\("(lib/[\w.-]+\.js)"\)', re.MULTILINE)
GLOBAL = re.compile(r"^var\s+([A-Z]\w*)\s*=", re.MULTILINE)
ALLOW = re.compile(r"^.*//\s*layers-allow:\s*\S.*$", re.MULTILINE)
NOISE = re.compile(r"//[^\n]*|/\*.*?\*/|\"(?:[^\"\\\n]|\\.)*\"|'(?:[^'\\\n]|\\.)*'", re.DOTALL)


@functools.cache
def changed(scope: Scope) -> frozenset[str]:
    return frozenset(scope.files())


def text_of(path: str, scope: Scope) -> str:
    return scope.after(path) if path in changed(scope) else (ROOT / path).read_text(encoding="utf-8")


def check(scope: Scope) -> list[str]:
    order = INCLUDE.findall(text_of("main.js", scope))
    findings = []
    on_disk = sorted(p.relative_to(ROOT).as_posix() for p in (ROOT / "lib").glob("*.js"))
    missing = [path for path in on_disk if path not in order]
    findings += [f'{path}: not included by main.js; add omabook.include("{path}") where it belongs' for path in missing]

    owner: dict[str, int] = {}
    code: dict[str, str] = {}
    for position, path in enumerate(order):
        if not (ROOT / path).exists():
            findings.append(f"main.js: includes {path}, which does not exist")
            continue
        text = text_of(path, scope)
        names = GLOBAL.findall(text)
        if len(names) != 1:
            findings.append(f"{path}: makes {len(names)} top-level globals ({', '.join(names) or 'none'}); a part makes exactly one")
        for name in names:
            owner[name] = position
        code[path] = NOISE.sub('""', ALLOW.sub("", text))

    for position, path in enumerate(order):
        for name, defined in owner.items():
            if defined > position and path in code and re.search(rf"\b{name}\.", code[path]):
                findings.append(f"{path}: uses {name} ({order[defined]}), which main.js includes after it")
    return findings


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    Scope.add_arguments(parser)
    scope = Scope.from_arguments(parser.parse_args(argv))
    if not any(path == "main.js" or path.startswith("lib/") for path in changed(scope)):
        return 0
    hint = "move the shared piece into an earlier part, or pass it in as a parameter; see .agents/rules/10-structure.md"
    return report("layers", check(scope), hint)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
