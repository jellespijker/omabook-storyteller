# AGENTS.md — Omabook Storyteller

Storyteller is a plugin for Omabook, developed in the
[omabook-workspace](https://github.com/jellespijker/omabook-workspace), the main
workspace for Omabook and its plugins (it holds the shared Kanban board, labels
and milestones). Work from there: `omabook-workspace/omabook-storyteller/`, or
the worktree `herdr-kanban claim` gives you. Read the workspace's `AGENTS.md` first.

JavaScript for Omabook's script engine (`main.js`, `lib/`), a QML panel, Markdown
skills, and Python tests.

## The harness

Every edit and commit is checked: the script language's rules and the plugin's
design (ast-grep, `rules/js/`), the parts' include order, ruff, file-size and
complexity budgets, the skills, secrets, and an issue number in the commit
message. Only what a change adds is judged. **Read the rule that applies
before you write the code**:

| Rule | When it applies |
|---|---|
| [.agents/rules/00-harness.md](.agents/rules/00-harness.md) | What runs when, and what to do when a check is wrong |
| [.agents/rules/10-structure.md](.agents/rules/10-structure.md) | Adding a part, or using one part from another |
| [.agents/rules/20-plugin-javascript.md](.agents/rules/20-plugin-javascript.md) | Any JavaScript |
| [.agents/rules/30-size-and-complexity.md](.agents/rules/30-size-and-complexity.md) | Growing a file or a function |

Once per clone: `uvx pre-commit install`. Before handing work in: `bin/check`.
Never skip the hooks (`--no-verify`) and never edit a baseline by hand.

## Testing

```bash
python3 tests/run.py     # the life of a story; needs omabook on the PATH, or OMABOOK=/path/to/omabook
python3 tests/evals.py   # the skills, with the stand-in model
```

Both pass before a ticket lands. Neither needs a window or a real model.

## Commits

Every commit message contains the number of the GitHub issue it belongs to, in
the subject or the body: `Give "Let the story decide" a value (#3)`. Write `#12`
for an issue of this repository and `jellespijker/omabook#12` for Omabook's. If
there is no issue for the work, deposit one (`herdr-kanban deposit`) before you
commit. A change someone using the plugin would notice gets a line in
`CHANGELOG.md` under *Unreleased*.

## Tickets

Issues and milestones for this repository are on the workspace board (alias
`storyteller`), with `type:*` and `domain:*` labels. A Storyteller release names
the Omabook version it needs.
