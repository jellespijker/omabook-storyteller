# The harness: what checks a change, and when

Every change to Storyteller is checked the same way, whoever makes it. The
checks look only at what a change **adds**: old code that predates a rule is
not a finding. They live in `.agents/hooks/` and run at these moments:

| When | What runs | Wired in |
|---|---|---|
| Before an agent's tool call | `pretool_guard.py`: no secrets or home-folder paths written, no commit without an issue number, no `--no-verify`, no force-push of `main` | `.claude/settings.json` |
| After an agent edits a file | `post_edit_check.py`: the structural rules, the layers, ruff, size and complexity of that file | `.claude/settings.json` |
| On `git commit` | all of the above on what is staged, the skills' checks (`tests/evals.py`), Talisman and the commit message | `.pre-commit-config.yaml` |
| On `git push` | the life of a story (`tests/run.py`; needs `omabook`) | `.pre-commit-config.yaml` |
| In CI | the same as a commit, against the merge base with `main` | `.github/workflows/harness.yml` |

Set up a clone once: `uvx pre-commit install`. Run everything on your change by
hand: `bin/check`, then `python3 tests/run.py`.

| Check | Rule file | Tool |
|---|---|---|
| The script language and the plugin's design | [20-plugin-javascript.md](20-plugin-javascript.md), `rules/js/*.yml` | ast-grep |
| Parts in include order | [10-structure.md](10-structure.md) | `check_layers.py` |
| Python (tests, harness) | `ruff.toml` | ruff |
| File size, function complexity | [30-size-and-complexity.md](30-size-and-complexity.md) | `check_file_size.py`, lizard |
| Skills | the README, *Skills* | `tests/evals.py` |
| Secrets | `.talismanrc` | Talisman, `pretool_guard.py` |
| Commit names its issue | the workspace's `AGENTS.md` | `check_commit_msg.py` |

## When a check is wrong

- **One place**: say why on the line. `// ast-grep-ignore: rule-id` for a
  structural rule, `// layers-allow: <why>` for an include-order exception,
  `# noqa: CODE` for ruff. An exception without a reason is a finding in review.
- **Everywhere**: change the rule, with its reason, in a commit of its own.
- **Never** edit `.agents/file-size-baseline.json` by hand, and never skip the
  hooks (`--no-verify`).

## Changing the harness

Every hook has a test in `.agents/hooks/test_hooks.py`, every structural rule
has cases in `rule-tests/`. Both run when the harness changes. The harness is
`export-ignore`d (`.gitattributes`), so it never ships in an installed plugin.
