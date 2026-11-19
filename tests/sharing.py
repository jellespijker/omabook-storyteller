"""A story's world in a collection that is published or shared (#1).

Run from tests/run.py, on its bench, once the first story has been written to
its end and read: `check(bench, step, known)`. A friend is a second bench, with
HOME and the XDG folders of their own, and gets what is shared the ways Omabook
gives it: an .omabook-space file, and a shared space kept in step through a
folder. Nothing goes over the network.

What Storyteller decides is checked on every Omabook: which books bring a
world, that it is only the reader's graph, that a book by a person never brings
one, that the story's file goes only when chosen, and that each thing a world
holds is marked where it was met, so Omabook can cut it at the friend's place.
That Omabook carries the worlds, to a subscriber as a layer and to a writer of
a shared space to write in, needs an Omabook with `omabook.graph.layers` in its
plugin API (0.1.7); with one that lacks it, the steps check that nothing of a
world leaves home, and say so.
"""

import json
import os
import shutil

from bench import Bench, names

# What the plan of the first story holds, and nothing a reader is shown does.
PLAN_ONLY = ("TWISTSECRET", "ENDINGSECRET", "She altered one line herself", "Two judges owe the glassblowers", "Its vault was emptied")


def carries_worlds(bench):
    return "omabook.graph.layers" in bench.omabook("plugin", "api").stdout


def operations(path):
    with open(path, encoding="utf-8") as file:
        return json.load(file)["operations"]


def scopes_in(ops):
    """The scopes the graph's operations name: [device, number, clock, author, entity, id, field, value]."""
    return {op[7] for op in ops if op[4] == "node" and op[6] == "scope" and op[7]}


def check(bench, step, known):
    full = carries_worlds(bench)
    what_goes(bench, step, known)
    file_by_choice(bench, step, known)
    marked_where_met(bench, step, known)
    snapshot = published(bench, step, known, full)
    friend = Bench()
    subscribed(friend, step, known, snapshot, full)
    space, folder = joined(bench, friend, known)
    if full:
        written_in(bench, friend, step, known, space, folder)
    else:
        theirs = friend_copy(bench, friend, known["book"])
        assert theirs["formats"] == [] and friend.ok("worldsSharedHere") == [], theirs
        step("in a shared space this Omabook carries neither the world nor the chosen file; the friend has the book's details only")
    bench.ok("storySharing", known["book"], {"file": False})
    shutil.rmtree(friend.scratch, ignore_errors=True)


def what_goes(bench, step, known):
    book, human = known["book"], known["human"]
    shared = bench.ok("sharedWorlds", [book, human], ["graph"])
    carried = [(one["book"], one["story"], one["scope"], one["file"]) for one in shared["worlds"]]
    assert carried == [(book, known["story"], known["seen"], False)], shared
    assert [one["book"] for one in shared["left"]] == [human] and "a book by a person never goes as a world" in shared["left"][0]["why"]
    assert ":plan" not in json.dumps(shared)
    alone = bench.ok("sharedWorlds", [book], [])
    assert alone["worlds"] == [] and "goes with the graph" in alone["left"][0]["why"], alone
    step("a collection takes a story's world (the reader's graph, never the plan) with its graph, and a person's book never brings one")


def file_by_choice(bench, step, known):
    book = known["book"]
    assert bench.ok("storySharing", book) == {"world": True, "file": False}
    assert bench.ok("storySharing", book, {"file": True}) == {"world": True, "file": True}
    only_file = bench.ok("sharedWorlds", [book], [])["worlds"][0]
    assert only_file["scope"] == "" and only_file["file"], only_file
    assert bench.ok("storySharing", book, {"world": False})["world"] is False
    assert bench.ok("sharedWorlds", [book], ["graph"])["worlds"][0]["scope"] == "", "a world kept at home stays there"
    bench.ok("storySharing", book, {"world": True, "file": False})
    refused = bench.run("storySharing", known["human"], {"file": True})
    assert "was not written by Storyteller" in refused.get("error", ""), refused
    step("the story's file goes only when the reader says so for that story, and its world can be kept at home")


def marked_where_met(bench, step, known):
    book, seen = known["book"], known["seen"]
    world = bench.ok("world", book)
    later = [node for node in world["nodes"] if node["data"].get("since", 0) >= 2]
    assert later, "chapters after the first showed things"
    ids = {one["name"]: one["id"] for one in bench.scope(seen)["nodes"]}
    for node in [world["nodes"][0], later[0]]:
        met = bench.json("graph", "node", ids[node["name"]])["seen"]
        assert [(place["book"], place["section"]) for place in met] == [(book, max(0, node["data"].get("since", 0) - 1))], (node, met)
    assert later[0]["data"]["since"] >= 2, "marking where a thing was met keeps what the story knows of it"
    step("each thing of a world is marked as met in the story's book at the chapter that showed it, for Omabook to cut it there")


def published(bench, step, known, full):
    """The collection with the story and the person's book in it, published to a file."""
    bench.omabook("collections", "add", "Shelf")
    bench.omabook("collections", "include", "Shelf", known["book"], known["human"])
    snapshot = os.path.join(bench.scratch, "shelf.omabook-space")
    bench.omabook("collections", "share", "Shelf", "--with-graph", "--as", "Ann", "--output", snapshot)
    ops = operations(snapshot)
    text, scopes = json.dumps(ops), scopes_in(ops)
    assert not [scope for scope in scopes if scope.endswith(":plan")], "the plan never goes"
    assert not [secret for secret in PLAN_ONLY if secret in text]
    assert bench.story(known["story"])["chapters"][0]["text"][:80] not in text, "the story's file didn't go"
    worlds = [scope for scope in scopes if scope.startswith("world:")]
    assert worlds == ([known["seen"]] if full else []), worlds
    step("publishing the collection sends nothing of the plan or the chapters" + ("" if full else "; this Omabook keeps the world at home"))
    return snapshot


def subscribed(friend, step, known, snapshot, full):
    friend.omabook("collections", "import", snapshot, "--as", "From Ann")
    layers = friend.ok("worldsSharedHere")
    if full:
        assert [(one["of"], one["kind"], one["role"]) for one in layers] == [(known["seen"], "published", "reader")], layers
        empty = friend.run("writeInSharedWorld", layers[0]["scope"], "")
        assert "isn't in your library" in empty.get("error", ""), "without the story, nothing of its world is known"
    else:
        assert layers == [] and not [scope for scope in friend.scopes() if scope.startswith("world:")]
    # Naming a scope doesn't make it a shared world, not even one the friend made.
    friend.omabook("graph", "add", "--kind", "place", "--name", "Saltmere", "--scope", known["seen"])
    for scope in (known["seen"], "", known["plan"]):
        refused = friend.run("writeInSharedWorld", scope, "a story")
        assert "is not a world shared with you" in refused.get("error", "") and friend.tasks() == [], refused
    step(
        "a subscriber gets the world as a layer, read-only; no story is written in a scope only named"
        + ("" if full else " (this Omabook sends none)")
    )


def joined(bench, friend, known):
    """A shared space of the collection, the story's file chosen, the friend a writer, kept in step through a folder."""
    bench.ok("storySharing", known["book"], {"file": True})
    space = bench.json("spaces", "create", "Shelf", "--parts", "graph")["space"]
    person = friend.omabook("identity", "--export").stdout.strip().splitlines()[-1]
    invite, folder = os.path.join(bench.scratch, "invite.json"), os.path.join(bench.scratch, "space-folder")
    os.makedirs(folder)
    bench.omabook("spaces", "invite", space, person, "--role", "writer", "--out", invite)
    bench.omabook("spaces", "sync", space, "--folder", folder)
    friend.omabook("spaces", "join", invite, "--as", "Shelf")
    friend.omabook("spaces", "sync", space, "--folder", folder)
    return space, folder


def friend_copy(bench, friend, book):
    theirs = [one for one in friend.json("list") if one["title"] == bench.json("show", book)["title"]]
    assert theirs, "the story's book is in the friend's collection"
    return theirs[0]


def written_in(bench, friend, step, known, space, folder):
    """The chosen file came along; the friend has read chapter one, and the world they write in is cut there."""
    theirs = friend_copy(bench, friend, known["book"])
    assert theirs["formats"] == ["story"], theirs
    friend.omabook("progress", theirs["id"], "--section", 0, "--fraction", 0.9)
    layer = [one for one in friend.ok("worldsSharedHere") if one["of"] == known["seen"] and one["kind"] == "shared"][0]
    assert layer["role"] == "writer"
    first = set(names(friend.scope(layer["scope"])))
    later = {node["name"] for node in bench.ok("world", known["book"])["nodes"] if node["data"].get("since", 0) >= 2}
    assert first and not first & later, "nothing of a chapter the friend hasn't read"
    friend.control()
    made = friend.ok("writeInSharedWorld", layer["scope"], "the ferry at night")
    story = friend.story(made["story"])
    assert made["shared"] is True and story["lineage"]["shared"]["space"] == space
    assert not later & set(names(friend.scope(story["world"]["plan"])))
    friend.omabook("spaces", "sync", space, "--folder", folder)
    bench.omabook("spaces", "sync", space, "--folder", folder)
    assert [one for one in bench.ok("worldsSharedHere") if one["of"] == "world:" + made["story"]], "the friend's story's world is back"
    step("a writer of a shared space writes a new story in the world as far as they have read, and it goes into the space with its world")
