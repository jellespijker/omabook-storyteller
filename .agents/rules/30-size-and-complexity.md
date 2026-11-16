# File size and function complexity

A big file is expensive for every person and agent that reads it afterwards;
a complex function is where the bugs are. Both have a budget.

| Measure | Budget | Check |
|---|---|---|
| Lines in a file (`.js`, `.qml`, `.py`, `.sh`, `.cpp`) | 500 | `check_file_size.py` |
| Cyclomatic complexity of a function | 15 | `check_complexity.py` (lizard) |
| Lines of code in a function | 80 | `check_complexity.py` |
| Parameters of a function | 6 | `check_complexity.py` |

## Old code

Files that were over budget when the check came in are listed in
`.agents/file-size-baseline.json` at their size then. **They may shrink, never
grow**; when one shrinks the commit lowers its ceiling, and once it is within
budget it leaves the list. A new file is never listed.

A function that was over a limit before is checked against itself: it fails
only if the change makes it worse on that measure. Touching it is fine;
growing it is not.

## Plan for it

Before changing a file, look at its headroom:

```bash
python3 .agents/hooks/check_file_size.py --report main.js lib/writer.js
python3 .agents/hooks/check_complexity.py --report lib/writer.js
```

If the change doesn't fit, the plan says **which responsibility moves out,
where to, and what the new part is called**, and the new part is included in
`main.js` where its dependencies allow (10-structure.md). A file at its
ceiling is a reason for a new part, never for an exception.

## Meet the budget honestly

These pass the numbers and fail the rule:

- deleting blank lines or comments, joining statements onto one line
- shortening names, inlining helpers so a function grows elsewhere
- moving code to a file named `writer2.js` or `misc.js` with no single purpose

Split by responsibility: planning from writing, a prompt's words (Prompts)
from how its answer is checked (Ai), one big `if` chain into a table or a
function per case.
