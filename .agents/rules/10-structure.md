# Structure: parts in include order

A script plugin has no modules. `main.js` includes each file of `lib/`,
**lowest first**, and each file makes **one global**, named for what it does:

```js
var Util = (function () {
    // ...
    return {text: text, words: words};
})();
```

The order in `main.js` is the dependency order: a part may use the globals of
the parts included before it, never after it. `check_layers.py` checks this,
that every file in `lib/` is included, and that each makes exactly one global.

## Where code goes

| Part | What it is for |
|---|---|
| `Util`, `Config` | helpers and settings: know nothing of stories |
| `Stories` | the `.story` file and its book format |
| `Prompts` | **every word sent to the model**, in one place |
| `Ai` | **the only way to ask the model**; checks every answer |
| `Originality`, `Taste`, `Skills`, `World`, `Checks` | what a story is made from and checked against |
| `Jobs`, `Status` | work in progress on disk; what the panel shows |
| `Writer`, `Reading` | planning and writing; what the reader does |
| `main.js` | the front door: registers the format, commands, panel and events |

`main.js` stays a list of registrations and thin functions that call the parts;
the work is in `lib/`. A new part is a new file with one global, included at
the place in the order its dependencies allow.

## When a part needs a later one

The dependency points the wrong way. Move the shared piece into an earlier
part, or have the earlier part take a function as a parameter. A use that must
stay (it runs only long after everything is loaded) says so:
`// layers-allow: <why>`. `Config.change` calling `Skills.settle` is the one
there is today.
