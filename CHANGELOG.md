# Changelog

What each release of Storyteller brought. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
`"version"` in `plugin.json`. Each release names the Omabook it needs.

Every change that someone using the plugin would notice gets a line under
*Unreleased* in the commit that makes it, with its issue number. A release
moves those lines under its version.

## [Unreleased]

### Added

- A harness that checks every change the same way, whoever makes it: the
  plugin's script rules (no async/await, modules or timers; the model only
  through `Ai`), its parts layered in include order, ruff for the Python,
  file-size and complexity budgets, secret scanning (Talisman) and an issue
  number in every commit message. It runs in the agents' edit hooks, on
  commit and in CI, and is left out of an installed plugin (#2).
- A story's world goes with a collection you publish or share, with its
  graph: only what you have been shown of it, never the plan, and each reader
  sees only as far as they have read. The story itself goes as a file only
  when you say so ("Storyteller: what goes when this story is shared"); a
  book by a person never brings a world. In a shared space you write in,
  "Storyteller: write in a world shared with you" starts a story of your own
  in it, which goes into the space with its world. Needs Omabook 0.1.7; an
  older one keeps worlds at home (#1).

## [1.2.1] - 2026-11-15

### Fixed

- "Write a new story" on the shelf stopped with *A choice of "pov" has no
  value*: "Let the story decide" now has a value, and the tests put the form
  through Omabook's own check.

## [1.2] - 2026-11-15

Needs Omabook 0.1.4.

### Added

- "Write a new story" is the first thing on the shelf, with a form for the
  wish, the skills, point of view, tone, chapters and words per chapter, and
  where the story lives.
- A story in the world of another, with that story's plot still to come; a
  sequel follows a story that has ended, a branch leaves one at a chapter.
- Removing a story says what goes and asks first; a shared world can stay.
- A length of its own for each story.

## [1.1] - 2026-11-15

Needs Omabook 0.1.2. The first release.

### Added

- Skills: style, structure, genre and craft guidance chosen per story (16
  built in; add your own, or install one from GitHub).
- A planning and writing pipeline built on research into story craft
  (docs/craft.md), with an editor's pass on every chapter.
- A new story is in the library at once, with a page that says how far the
  writing has got.

[Unreleased]: https://github.com/jellespijker/omabook-storyteller/compare/v1.2.1...HEAD
[1.2.1]: https://github.com/jellespijker/omabook-storyteller/compare/v1.2...v1.2.1
[1.2]: https://github.com/jellespijker/omabook-storyteller/compare/v1.1...v1.2
[1.1]: https://github.com/jellespijker/omabook-storyteller/releases/tag/v1.1
