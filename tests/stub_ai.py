#!/usr/bin/env python3
"""A stand-in for the model, for the tests.

Omabook's AI setting "a command" runs a program that reads a prompt on
standard input and writes the answer to standard output. This is such a
program: it reads the line "Task: <name>" that every one of the plugin's
prompts starts with and answers with canned JSON or prose, so the whole
life of a story can be run without a model, in seconds and for nothing.

The folder named by STUB_DIR holds:
  calls.jsonl    every request, one JSON object a line: {"task", "prompt",
                 "tier" ("main" or "quick": the model Omabook was asked for)}
  control.json   how to misbehave, written by the test (all optional):
      {"collide_world": true}    the world uses a name from the library
      {"collide_chapter": true}  the chapter does
      {"rename_bad": true}       a rename answers with another taken name
      {"bad_once": "cast"}       the first answer for that task is not JSON
      {"empty": "chapter"}       every answer for that task is empty
      {"hang": "update"}         that task never answers (to be killed)
  state.json     what this stub remembers between calls
"""
import json
import os
import re
import sys
import time

FOLDER = os.environ.get("STUB_DIR", ".")
TAKEN_PLACE = "Harrowgate"
TAKEN_PERSON = "Vesper Quill"


def read(name, fallback):
    try:
        with open(os.path.join(FOLDER, name), encoding="utf-8") as file:
            return json.load(file)
    except (OSError, ValueError):
        return fallback


def write(name, value):
    with open(os.path.join(FOLDER, name), "w", encoding="utf-8") as file:
        json.dump(value, file)


def blocks(prompt):
    """The pieces of material in a prompt, between <<< and >>>."""
    return re.findall(r"<<<\n(.*?)\n>>>", prompt, re.S)


def world(control):
    harbour = TAKEN_PLACE if control.get("collide_world") else "Saltmere Stair"
    return {
        "title": "The Glass Tithe",
        "logline": "A tally-keeper must find who forged the tithe ledger of %s before the tide court sits." % harbour,
        "genre": "harbour mystery", "tone": "wry and salt-stung",
        "voice": "Close third person, past tense, short plain sentences.",
        "blurb": "In a harbour that pays its debts in glass, one ledger does not add up.",
        "places": [
            {"name": harbour, "summary": "A stepped harbour town cut into a cliff.", "secret": "Its lowest stair is older than the town."},
            {"name": "Ninefold Market", "summary": "Nine terraces of stalls, one for each tithe.", "secret": ""},
            {"name": "Drowned Counting House", "summary": "Half under water at spring tide.", "secret": "Its vault was emptied before the flood."},
        ],
        "groups": [
            {"name": "Tide Court", "summary": "Judges who sit only at slack water.", "wants": "The tithe paid in full.", "secret": "Two judges owe the glassblowers."},
            {"name": "Glasswrights of the Low Stair", "summary": "A guild of blowers.", "wants": "An end to the tithe.", "secret": ""},
        ],
        "rules": [
            {"name": "Glass tithe", "kind": "economy", "summary": "Debts are paid in blown glass weighed by the court.",
             "cost": "Glass once weighed can never be melted again."},
            {"name": "Slack-water oath", "kind": "law", "summary": "A promise made at slack water binds until the next.", "cost": "It can't be withdrawn."},
        ],
        "history": [
            {"name": "Flood of the Counting House", "when": "Forty years ago", "summary": "A storm drowned the old counting house.",
             "truth": "The sluices were opened on purpose."},
        ],
        "relations": [{"from": "Tide Court", "to": harbour, "relation": "sits in"}],
    }


def cast():
    return {
        "characters": [
            {"name": "Ilse Marrow", "aliases": ["the tally-keeper"], "role": "protagonist", "summary": "Keeps the tithe tallies.",
             "want": "To clear her name.", "need": "To stop keeping other people's accounts.", "fear": "Being her mother.",
             "secret": "She altered one line herself, years ago.", "contradiction": "Exact with numbers, careless with people.",
             "voice": "Counts under her breath."},
            {"name": "Teodor Vash", "aliases": [], "role": "antagonist", "summary": "Senior judge of the court.",
             "want": "The tithe kept whole.", "need": "To be forgiven.", "fear": "The low stair.", "secret": "He opened the sluices.",
             "contradiction": "Just, and guilty.", "voice": "Never raises it."},
            {"name": "Quenna Dray", "aliases": [], "role": "ally", "summary": "A glasswright with burned hands.",
             "want": "Her guild free of debt.", "need": "A friend.", "fear": "Cold furnaces.", "secret": "She made the false weights.",
             "contradiction": "Loyal and for sale.", "voice": "Trade slang."},
            {"name": "Old Brannoch", "aliases": [], "role": "wildcard", "summary": "A ferryman who remembers the flood.",
             "want": "To be left alone.", "need": "To tell it.", "fear": "Slack water.", "secret": "He saw who opened the sluices.",
             "contradiction": "Silent, and a gossip.", "voice": "Half sentences."},
        ],
        "relations": [
            {"from": "Ilse Marrow", "to": "Tide Court", "relation": "keeps tallies for", "hidden": False, "note": ""},
            {"from": "Teodor Vash", "to": "Ilse Marrow", "relation": "godfather of", "hidden": True, "note": "Nobody told her."},
            {"from": "Quenna Dray", "to": "Glasswrights of the Low Stair", "relation": "member of", "hidden": False, "note": ""},
        ],
    }


def beat(number, last):
    return {"chapter": number, "title": "Tally %d" % number, "pov": "Ilse Marrow", "goal": "Find line %d of the ledger." % number,
            "events": "She follows the glass.", "seeds": "A cracked weight." if number == 1 else "",
            "scenes": [{"goal": "Weigh the tithe.", "conflict": "The scale is wrong.", "outcome": "no-and: one weight is missing"}],
            "turn": "The ledger closes." if number == last else "The count is off by one.", "hook": "Who took weight %d?" % number}


def plot(chapters, title=None):
    made = {
        "structure": "Try-fail cycles: every count she makes fails worse, until the trial.",
        "arcs": [{"name": "The short count", "chapters": [1, chapters // 2], "purpose": "She finds the fraud.", "ends_with": "She is accused."},
                 {"name": "The trial", "chapters": [chapters // 2 + 1, chapters], "purpose": "She proves it.", "ends_with": "The court sits."}],
        "threads": [{"name": "The forged ledger", "kind": "inquiry", "summary": "Who altered the tithe?", "opened_in": 1, "closed_in": chapters,
                     "involves": ["Ilse Marrow", "Tide Court"]}],
        "promises": [{"name": "The court will sit", "summary": "The reader is promised a trial.", "opened_in": 1, "pays_off_in": chapters}],
        "twists": [{"name": "The judge opened the sluices", "summary": "TWISTSECRET: Teodor Vash drowned the counting house himself.",
                    "seeds": ["A cracked weight", "Wet boots on a dry day"], "seeded_in": [1, 2], "pays_off_in": chapters,
                    "changes": "Every kindness of his.", "involves": ["Teodor Vash"]}],
        "endings": [{"name": "The tithe ends", "summary": "ENDINGSECRET: the glass is melted."},
                    {"name": "The tithe holds", "summary": "She keeps the lie."}],
        "beats": [beat(number, chapters) for number in range(1, chapters + 1)],
    }
    if title:
        made.update({"title": title, "logline": "The debt comes due again.", "blurb": "Years on, the glass remembers.",
                     "characters": [{"name": "Pell Orrin", "aliases": [], "role": "protagonist", "summary": "A court clerk.", "want": "A post.",
                                     "need": "A spine.", "fear": "Ink.", "secret": "Reads sealed letters.", "contradiction": "Timid, nosy.",
                                     "voice": "Apologises first."}],
                     "relations": [{"from": "Pell Orrin", "to": "Tide Court", "relation": "clerk of", "hidden": False, "note": ""}]})
    return made


def replan(prompt):
    start = int(re.search(r"Revise the plan from chapter (\d+) on", prompt).group(1))
    planned = []
    for block in blocks(prompt):
        if block.startswith("["):
            try:
                planned = json.loads(block)
            except ValueError:
                planned = []
    last = max([start + 1] + [int(item.get("chapter", 0)) for item in planned])
    beats = [beat(number, last) for number in range(start, last + 1)]
    for item in beats:
        item["goal"] = "Revised: " + item["goal"]
    branch = "go another way" in prompt
    # A wish about how it is written chooses a skill from the menu.
    now = re.search(r"written now: (.*)\.", prompt)
    current = [] if not now or now.group(1) == "none" else now.group(1).split(", ")
    skills = current + ["lush-lyrical", "made-up-skill"] if "lusher" in prompt and "- lush-lyrical (style)" in prompt else []
    return {"title": "The Glass Tithe: The Other Door" if branch else "", "note": "The road bends a little from here.", "beats": beats,
            "skills": skills,
            "twists": [{"name": "The weights were hers", "summary": "TWISTSECRET2: Quenna Dray made the false weights.",
                        "seeds": ["Burned hands"], "seeded_in": [start], "pays_off_in": last, "changes": "Her help."}],
            "endings": [], "characters": []}


def chapter(prompt, control):
    number = int(re.search(r"Write chapter (\d+) of the novel", prompt).group(1))
    words = int(re.search(r"Length: about (\d+) words", prompt).group(1))
    who = TAKEN_PERSON if control.get("collide_chapter") else "Teodor Vash"
    lines = ["# Tally %d" % number, "",
             "Ilse Marrow counted the glass twice before the bell, and twice it came out one short.",
             "",
             "On the stair she met %s, who said nothing about the weights. The harbour smelled of kelp and hot sand." % who,
             ""]
    filler = "She set the weight down, wrote the figure, and did not believe it. "
    while sum(len(line.split()) for line in lines) < words:
        lines += [filler * 6, ""]
    lines += ["* * *", "", "By slack water the count for chapter %d was still off by one." % number]
    return "\n".join(lines)


def update(prompt):
    number = int(re.search(r"just written chapter (\d+) of", prompt).group(1))
    made = {
        "summary": "In chapter %d Ilse Marrow counted the tithe and found it short." % number,
        "knows": [
            {"kind": "character", "name": "Ilse Marrow", "aliases": [], "summary": "The tally-keeper; by chapter %d she doubts the ledger." % number},
            {"kind": "place", "name": "Ninefold Market", "aliases": [], "summary": "Where the glass is weighed."},
            {"kind": "item", "name": "Weight of chapter %d" % number, "aliases": [], "summary": "A cracked brass weight."},
        ],
        "relations": [{"from": "Ilse Marrow", "to": "Ninefold Market", "relation": "works in"},
                      {"from": "Ilse Marrow", "to": "Weight of chapter %d" % number, "relation": "found"}],
        "seeds_planted": ["The judge opened the sluices"] if number <= 2 else [],
        "twists_paid": [], "promises_kept": [],
        "people": [{"name": "Ilse Marrow", "where": "On the Ninefold stair, chapter %d" % number, "learned": "Weight %d is false." % number,
                    "wants_now": "To find the forger.", "changed": "She stops trusting the court." if number == 2 else ""}],
        "threads": [{"name": "The forged ledger", "state": "Open after chapter %d." % number}],
        "when": "Day %d, at slack water." % number,
        "questions": ["Who cracked weight %d?" % number],
    }
    return made


def revise(prompt):
    """The editor: it mends the one sentence every stub chapter repeats from the prompt's lists."""
    draft = blocks(prompt)[0]
    edits = []
    if "The harbour smelled of kelp and hot sand." in draft:
        edits.append({"find": "The harbour smelled of kelp and hot sand.", "replace": "REVISED: the harbour smelled of kelp.", "why": "repetition"})
    # One edit that is not in the draft at all, which must be left out.
    edits.append({"find": "A sentence the draft never had.", "replace": "Anything.", "why": "clarity"})
    return {"checks": {"continuity": "ok", "viewpoint": "ok", "scenes": "ok", "ending": "ok", "clarity": "ok",
                       "repetition": "a stock image", "telling": "ok", "skills": "ok", "originality": "ok"}, "edits": edits}


def rename(prompt, control):
    hits = [line[2:].strip() for line in blocks(prompt)[0].splitlines() if line.startswith("- ")]
    fresh = ["Brinehollow", "Orsolya Fenn", "Dunmarrow", "Calder Wick"]
    if control.get("rename_bad"):
        # Out of one taken name, into another.
        return {"renames": {hit: TAKEN_PERSON if hit == TAKEN_PLACE else TAKEN_PLACE for hit in hits}}
    return {"renames": {hit: fresh[index % len(fresh)] for index, hit in enumerate(hits)}}


def eval_draft(prompt):
    """A scene for a skill's eval: short sentences when a skill is in the prompt, long ones without."""
    if "<<<skill:" in prompt:
        return "She shut the door. The lamp hissed. She counted the coins twice and put them away."
    return "She shut the door very slowly, and it seemed to her that the lamp was hissing like a symphony of small regrets, a testament to the night."


def grade(prompt):
    """A grader that passes every statement, unless told the text fails."""
    statements = [line[2:].strip() for line in blocks(prompt)[1].splitlines() if line.startswith("- ")]
    return {"grades": [{"text": text, "passed": "testament" not in blocks(prompt)[0], "evidence": "stub"} for text in statements]}


def main():
    prompt = sys.stdin.read()
    found = re.search(r"^Task: (\w+)", prompt, re.M)
    task = found.group(1) if found else "none"
    control, state = read("control.json", {}), read("state.json", {})
    with open(os.path.join(FOLDER, "calls.jsonl"), "a", encoding="utf-8") as log:
        # Omabook tells a command which of its two models was asked for.
        log.write(json.dumps({"task": task, "prompt": prompt, "tier": os.environ.get("OMABOOK_AI_TIER", "")}) + "\n")

    seen = state.get(task, 0)
    state[task] = seen + 1
    write("state.json", state)

    if control.get("hang") == task:
        time.sleep(600)
    if control.get("empty") == task:
        return
    if control.get("bad_once") == task and seen == 0:
        print("Here is what I came up with: {not json")
        return

    if task == "world":
        answer = world(control)
    elif task == "cast":
        answer = cast()
    elif task == "plot":
        answer = plot(int(re.search(r"for exactly (\d+) chapters", prompt).group(1)))
    elif task == "sequel":
        answer = plot(int(re.search(r"of exactly (\d+) chapters", prompt).group(1)), "The Glass Debt")
    elif task == "replan":
        answer = replan(prompt)
    elif task == "update":
        answer = update(prompt)
    elif task == "rename":
        answer = rename(prompt, control)
    elif task == "revise":
        answer = revise(prompt)
    elif task == "eval":
        print(eval_draft(prompt))
        return
    elif task == "grade":
        answer = grade(prompt)
    elif task == "chapter":
        print(chapter(prompt, control))
        return
    elif task == "answer":
        print("She counts because numbers hold still. " + ("WITH-PLAN" if "They asked for spoilers" in prompt else "NO-PLAN"))
        return
    else:
        print("I don't know this task.")
        return
    # Models like a code fence; the plugin has to cope with one.
    print("```json\n" + json.dumps(answer, indent=1) + "\n```")


if __name__ == "__main__":
    main()
