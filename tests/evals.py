#!/usr/bin/env python3
"""The skills' evals, in the layout of Anthropic's skill-creator.

    python3 tests/evals.py                      # the mechanical checks, with the stand-in model: free, a few seconds
    python3 tests/evals.py --quality            # every eval case on the real AI, with and without its skill: costs
    python3 tests/evals.py --quality --skill spare-concrete --skill wry --jobs 4 --iteration 2

Each built-in skill is a folder skills/<name>/ with its SKILL.md and an
evals/ folder of test cases, one folder each, as skill-creator and `claude
plugin eval` read them:

    evals/<case>/prompt.md      a settings block, then the brief ("Write a scene of about 300 words: ...")
    evals/<case>/case.yaml      the case's name and what a good result looks like
    evals/<case>/graders/NN-*.md  one statement each, judged on the result
    evals/<case>/metrics.json   (optional) counts this script makes itself, against the run without the skill

The mechanical checks need no model: every skill loads in the plugin with no
problem, its front matter is valid Agent Skills front matter too, every case
is well formed, and every skill in tests/refused/ is refused by the plugin's
loader for the reason its file name gives.

--quality runs each case twice through the plugin (`evalDraft`): with the
skill, and without it (the baseline), both with the same craft context a
real chapter has. Each result is graded (`evalGrade`) against the case's
statements by the model, and against its metrics by this script. Results go
to a workspace in skill-creator's layout (iteration-N/<skill>--<case>/
{with_skill,without_skill}/{outputs,grading.json,timing.json}), so its
aggregate_benchmark.py and eval-viewer read them; pass --skill-creator to
run the aggregation. The AI is a scratch Omabook set to the provider in
STORYTELLER_AI ("claude" when not set: Claude Code, with your own Claude
login); no library or settings of yours are touched.
"""
import argparse
import concurrent.futures
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import run as bench_module  # noqa: E402  (tests/run.py: the scratch Omabook)

ROOT = bench_module.ROOT
ALLOWED = {"name", "description", "license", "allowed-tools", "metadata", "compatibility"}
SETTINGS = {"tags", "max_turns", "timeout_seconds", "allowed_tools"}
REASONS = {"imitation": "imitation", "author": "names the author", "rules": "rules or instructions", "markers": "markers",
           "names": "existing books", "long": "keep it short", "frontmatter": "front matter"}


def front(text):
    found = re.match(r"---\n(.*?)\n---\n?(.*)$", text, re.S)
    return (found.group(1), found.group(2)) if found else (None, text)


def skill_folders():
    folder = os.path.join(ROOT, "skills")
    return sorted(name for name in os.listdir(folder) if os.path.isfile(os.path.join(folder, name, "SKILL.md")))


def cases(skill):
    folder = os.path.join(ROOT, "skills", skill, "evals")
    if not os.path.isdir(folder):
        return []
    made = []
    for name in sorted(os.listdir(folder)):
        path = os.path.join(folder, name)
        if not os.path.isdir(path):
            continue
        prompt = open(os.path.join(path, "prompt.md"), encoding="utf-8").read()
        settings, brief = front(prompt)
        graders = sorted(os.listdir(os.path.join(path, "graders")))
        statements = [front(open(os.path.join(path, "graders", grader), encoding="utf-8").read())[1].strip() for grader in graders]
        metrics = json.load(open(os.path.join(path, "metrics.json"))) if os.path.exists(os.path.join(path, "metrics.json")) else []
        made.append({"skill": skill, "name": name, "path": path, "settings": settings, "brief": brief.strip(), "statements": statements,
                     "graders": graders, "metrics": metrics, "case": open(os.path.join(path, "case.yaml"), encoding="utf-8").read()})
    return made


# ------------------------------------------------------------ what is counted

FILLER = ["just", "very", "really", "suddenly", "somehow", "began to", "started to", "seemed to", "quite", "rather"]


def sentences(text):
    return [part for part in re.split(r"(?<=[.!?])[\"'”’)]*\s+", re.sub(r"\s+", " ", text)) if re.search(r"\w", part)]


def stock_list():
    source = open(os.path.join(ROOT, "lib", "prompts.js"), encoding="utf-8").read()
    block = re.search(r"const STOCK = \[(.*?)\];", source, re.S).group(1)
    return [phrase.rstrip(",") for phrase in re.findall(r'"([^"]+)"', block)]


def metric(name, text):
    words = re.findall(r"[A-Za-z']+", text)
    lower = [word.lower() for word in words]
    if name == "mean_sentence_words":
        found = sentences(text)
        return round(sum(len(re.findall(r"[A-Za-z']+", s)) for s in found) / max(1, len(found)), 1)
    if name == "filler_per_1000":
        flat = " " + " ".join(lower) + " "
        return round(sum(flat.count(" " + word + " ") for word in FILLER) * 1000 / max(1, len(words)), 1)
    if name == "stock_phrases":
        flat = re.sub(r"\s+", " ", text.lower())
        return sum(flat.count(phrase) for phrase in stock_list())
    if name == "second_person_ratio":
        you = sum(lower.count(word) for word in ("you", "your", "yours", "yourself"))
        others = sum(lower.count(word) for word in ("i", "me", "my", "he", "she", "his", "her", "him"))
        return round(you / max(1, you + others), 2)
    raise ValueError("no metric " + name)


def judged(rule, mine, other, configuration):
    """A metric as an expectation for one run, compared with the other run."""
    value, against = metric(rule["metric"], mine), metric(rule["metric"], other) if other is not None else None
    if "min" in rule:
        return {"text": "%s is at least %s" % (rule["metric"], rule["min"]), "passed": value >= rule["min"], "evidence": "measured %s" % value}
    if "max" in rule:
        return {"text": "%s is at most %s" % (rule["metric"], rule["max"]), "passed": value <= rule["max"], "evidence": "measured %s" % value}
    # Compared: with the skill against the baseline, and the baseline the
    # same way against the skill, so both runs carry the same expectation.
    other_name = "the run without the skill" if configuration == "with_skill" else "the run with the skill"
    compare = rule["compare"]
    passed = {"lower": value < against, "higher": value > against, "not_higher": value <= against}[compare]
    return {"text": "%s is %s than in %s" % (rule["metric"], compare.replace("_", " "), other_name), "passed": passed,
            "evidence": "%s here, %s there" % (value, against)}


# ------------------------------------------------------------ the checks

def mechanical(bench):
    problems = []
    listed = {entry["id"]: entry for entry in bench.ok("skills", True)}
    for skill in skill_folders():
        text = open(os.path.join(ROOT, "skills", skill, "SKILL.md"), encoding="utf-8").read()
        meta, body = front(text)
        if skill not in listed:
            problems.append("%s: not loaded" % skill)
        elif listed[skill]["problems"]:
            problems.append("%s: %s" % (skill, "; ".join(listed[skill]["problems"])))
        try:
            import yaml
            parsed = yaml.safe_load(meta)
            if set(parsed) - ALLOWED:
                problems.append("%s: front matter keys outside Agent Skills: %s" % (skill, set(parsed) - ALLOWED))
            if parsed.get("name") != skill or "<" in parsed.get("description", "") or ">" in parsed.get("description", ""):
                problems.append("%s: name or description is not valid Agent Skills front matter" % skill)
        except ImportError:
            pass
        if not cases(skill):
            problems.append("%s: no eval cases" % skill)
        for case in cases(skill):
            keys = set(re.findall(r"^(\w+):", case["settings"] or "", re.M))
            if not case["settings"] or keys - SETTINGS:
                problems.append("%s/%s: prompt.md settings block" % (skill, case["name"]))
            if 'schema_version: "1.1"' not in case["case"] or "name: %s\n" % case["name"] not in case["case"]:
                problems.append("%s/%s: case.yaml" % (skill, case["name"]))
            if not case["statements"] or not all(s for s in case["statements"]):
                problems.append("%s/%s: graders" % (skill, case["name"]))
            for rule in case["metrics"]:
                metric(rule["metric"], "One. Two words.")
    refused = os.path.join(HERE, "refused")
    for name in sorted(os.listdir(refused)):
        why = REASONS[name.split("-")[0]]
        answer = bench.run("addSkill", open(os.path.join(refused, name), encoding="utf-8").read())
        if why not in answer.get("error", ""):
            problems.append("tests/refused/%s was not refused for %s: %s" % (name, why, answer.get("error") or "it was accepted"))
    return problems, len(skill_folders()), sum(len(cases(skill)) for skill in skill_folders()), len(os.listdir(refused))


def quality(bench, chosen, workspace, iteration, jobs, attempts=3):
    out = os.path.join(workspace, "iteration-%d" % iteration)
    todo = [case for skill in skill_folders() if not chosen or skill in chosen for case in cases(skill)]

    # One library a worker: two Omabooks can't open one library at once,
    # and the evals need no books.
    local = threading.local()

    def library():
        if not hasattr(local, "library"):
            local.library = os.path.join(bench.scratch, "library-%d" % threading.get_ident())
            os.makedirs(local.library, exist_ok=True)
        return local.library

    def call(what, *arguments):
        # The model through a harness can fail now and then; that is not
        # the skill's fault, so it is asked again.
        last = None
        for _ in range(attempts):
            done = subprocess.run([bench_module.OMABOOK, "plugin", "run", bench_module.NAME, what, json.dumps(list(arguments)),
                                   "--folder", bench.plugins, "--json", "--wait", "15", "--library", library()],
                                  env=bench.env, capture_output=True, text=True, timeout=1000)
            try:
                answer = json.loads(done.stdout)
            except ValueError:
                answer = {"error": (done.stdout + done.stderr).strip()[:400] or "no answer"}
            if not answer.get("error"):
                return answer["result"]
            last = answer["error"]
        raise RuntimeError(last)

    def one(case, configuration):
        started = time.time()
        made = call("evalDraft", case["skill"] if configuration == "with_skill" else "", case["brief"])
        return configuration, made, time.time() - started

    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=jobs) as pool:
        futures = {pool.submit(one, case, configuration): case for case in todo for configuration in ("with_skill", "without_skill")}
        for future in concurrent.futures.as_completed(futures):
            case = futures[future]
            configuration, made, seconds = future.result()
            results[(case["skill"], case["name"], configuration)] = (made, seconds)
            print("  drafted %s/%s %s (%.0fs)" % (case["skill"], case["name"], configuration, seconds), flush=True)

    def graded(case, configuration):
        made, seconds = results[(case["skill"], case["name"], configuration)]
        other = "without_skill" if configuration == "with_skill" else "with_skill"
        grades = call("evalGrade", made["text"], case["statements"])
        grades += [judged(rule, made["text"], results[(case["skill"], case["name"], other)][0]["text"], configuration) for rule in case["metrics"]]
        return case, configuration, made, seconds, grades

    summary = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=jobs) as pool:
        for case, configuration, made, seconds, grades in pool.map(lambda pair: graded(*pair), [(c, k) for c in todo for k in ("with_skill", "without_skill")]):
            folder = os.path.join(out, "%s--%s" % (case["skill"], case["name"]))
            run_dir = os.path.join(folder, configuration)
            os.makedirs(os.path.join(run_dir, "outputs"), exist_ok=True)
            with open(os.path.join(run_dir, "outputs", "output.md"), "w", encoding="utf-8") as file:
                file.write(made["text"] + "\n")
            passed = sum(1 for grade in grades if grade["passed"])
            json.dump({"expectations": grades, "summary": {"passed": passed, "failed": len(grades) - passed, "total": len(grades),
                                                           "pass_rate": round(passed / max(1, len(grades)), 2)}},
                      open(os.path.join(run_dir, "grading.json"), "w"), indent=1)
            tokens = (made["cost"]["sent"] + made["cost"]["received"]) // 4
            json.dump({"total_tokens": tokens, "duration_ms": int(seconds * 1000), "total_duration_seconds": round(seconds, 1)},
                      open(os.path.join(run_dir, "timing.json"), "w"), indent=1)
            json.dump({"eval_name": "%s--%s" % (case["skill"], case["name"]), "prompt": case["brief"],
                       "assertions": case["statements"] + [grade["text"] for grade in grades[len(case["statements"]):]]},
                      open(os.path.join(folder, "eval_metadata.json"), "w"), indent=1)
            entry = summary.setdefault(case["skill"], {"with_skill": [0, 0], "without_skill": [0, 0], "failed": []})
            entry[configuration][0] += passed
            entry[configuration][1] += len(grades)
            if configuration == "with_skill":
                entry["failed"] += ["%s: %s (%s)" % (case["name"], grade["text"], grade["evidence"][:160]) for grade in grades if not grade["passed"]]
    return out, summary


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--quality", action="store_true", help="run the cases on the real AI (costs)")
    parser.add_argument("--stub", action="store_true", help="with --quality: use the stand-in model, to try the runner")
    parser.add_argument("--skill", action="append", default=[], help="only this skill (again for more)")
    parser.add_argument("--jobs", type=int, default=4)
    parser.add_argument("--iteration", type=int, default=1)
    parser.add_argument("--workspace", default=os.path.join(ROOT, ".scratch", "skills-workspace"))
    parser.add_argument("--skill-creator", default="", help="skill-creator's folder: run its aggregate_benchmark.py on the results")
    parser.add_argument("--keep", action="store_true")
    options = parser.parse_args()
    if not bench_module.OMABOOK:
        sys.exit("omabook was not found: put it on the PATH or set OMABOOK=/path/to/omabook.")

    bench = bench_module.Bench()
    try:
        if options.quality and not options.stub:
            # The real AI, through a scratch Omabook all the same.
            provider = os.environ.get("STORYTELLER_AI", "claude")
            with open(os.path.join(bench.config, "omabook", "config.json"), "w") as file:
                json.dump({"library": bench.library, "ai_provider": provider, "graph": "off"}, file)
            real_home = os.path.expanduser("~")
            bench.env.setdefault("CLAUDE_CONFIG_DIR", os.environ.get("CLAUDE_CONFIG_DIR") or os.path.join(real_home, ".claude"))
            bench.env["PATH"] = os.environ.get("PATH", "")
        bench.control()
        if not options.quality:
            problems, skills, case_count, refused = mechanical(bench)
            for problem in problems:
                print("FAIL  " + problem)
            print("%d skills, %d eval cases, %d unsafe skills refused: %s" % (skills, case_count, refused, "all well" if not problems else "%d problems" % len(problems)))
            return 1 if problems else 0
        out, summary = quality(bench, options.skill, options.workspace, options.iteration, options.jobs)
        total = {"with_skill": [0, 0], "without_skill": [0, 0]}
        print("\n%-20s %12s %12s" % ("skill", "with skill", "without"))
        for skill in sorted(summary):
            entry = summary[skill]
            for key in total:
                total[key][0] += entry[key][0]
                total[key][1] += entry[key][1]
            print("%-20s %7d/%-4d %7d/%-4d" % (skill, entry["with_skill"][0], entry["with_skill"][1], entry["without_skill"][0], entry["without_skill"][1]))
        print("%-20s %7d/%-4d %7d/%-4d" % ("all", total["with_skill"][0], total["with_skill"][1], total["without_skill"][0], total["without_skill"][1]))
        failures = [(skill, line) for skill in sorted(summary) for line in summary[skill]["failed"]]
        if failures:
            print("\nWhat failed with the skill:")
            for skill, line in failures:
                print("  %s/%s" % (skill, line))
        print("\nResults: " + out)
        if options.skill_creator:
            subprocess.run([sys.executable, "-m", "scripts.aggregate_benchmark", out, "--skill-name", "storyteller-skills"],
                           cwd=options.skill_creator, check=False)
        return 0
    finally:
        if options.keep:
            print("The scratch folder is kept: " + bench.scratch)
        else:
            shutil.rmtree(bench.scratch, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
