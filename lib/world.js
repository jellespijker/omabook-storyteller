// The world of a story, kept as two graphs.
//
// Omabook's knowledge graph has scopes: "" is the general graph of what the
// reader has read, and any other name is a graph of its own. A story keeps
// two:
//
//   world:<id>:plan   the author's: every place, people, rule and person
//                     with their secrets, and the plot as nodes (threads,
//                     promises, twists with where they are seeded and paid
//                     off, endings). It is what the model is shown.
//   world:<id>        the reader's: only what the chapters they have read
//                     have shown. It is what the panel lists and what is
//                     safe to browse.
//
// Why two scopes and not one graph with a "spoiler" flag on some nodes: a
// flag hides nothing unless every viewer honours it, and the graph view,
// `omabook graph`, the MCP tools and the exports know nothing of this
// plugin's flags. A scope is a boundary all of them already keep. So
// anything that shows "world:<id>" is spoiler-free by construction, and a
// fact crosses from the plan to it in exactly one place, `reveal`, when
// the reader has read the chapter that shows it. (Spoiler-bearing nodes of
// the plan carry data.spoiler = true as well, for tools that do look.)
var World = (function () {
    "use strict";

    const PLOT = ["thread", "promise", "twist", "ending"];

    // A scope read once, findable by name and by other name.
    function index(scope) {
        const view = omabook.graph.whole(scope, 5000), byName = {}, byId = {};
        view.nodes.forEach(function (node) {
            node.data = node.data || {};
            byId[node.id] = node;
            [node.name].concat(Util.list(node.data.aliases)).forEach(function (name) {
                if (!byName[Util.norm(name)])
                    byName[Util.norm(name)] = node;
            });
        });
        return {
            scope: scope, nodes: view.nodes, edges: view.edges, byId: byId,
            find: function (name) { return byName[Util.norm(name)] || null; },
            add: function (node) {
                node.data = node.data || {};
                view.nodes.push(node);
                byId[node.id] = node;
                [node.name].concat(Util.list(node.data.aliases)).forEach(function (name) { byName[Util.norm(name)] = node; });
            },
            ofKind: function (kind) { return view.nodes.filter(function (node) { return node.kind === kind; }); }
        };
    }

    // Adds a thing, or brings the one of that name up to date. The graph
    // tells things apart by kind and name; a model may call the same thing
    // a "group" today and a "place" tomorrow, so a name that is known
    // keeps the kind it has.
    function put(known, kind, name, summary, data, aliases) {
        name = Util.text(name);
        if (!name)
            return 0;
        const has = known.find(name);
        const thing = {scope: known.scope, kind: has ? has.kind : kind, name: has ? has.name : name, data: data || {}};
        if (Util.text(summary))
            thing.summary = Util.text(summary);
        const others = Util.list(aliases).map(Util.text).filter(Boolean);
        if (others.length > 0)
            thing.aliases = others;
        const id = omabook.graph.upsert(thing);
        if (id && !has)
            known.add({id: id, kind: kind, name: name, summary: thing.summary || "", data: Object.assign({aliases: others}, data)});
        else if (has) {
            Object.assign(has.data, data);
            if (thing.summary)
                has.summary = thing.summary;
        }
        return id;
    }

    function tie(known, from, to, relation, note, place) {
        const source = known.find(from), target = known.find(to);
        if (!source || !target || source.id === target.id || !Util.text(relation))
            return 0;
        const details = {};
        if (Util.text(note))
            details.note = Util.text(note);
        if (place && place.book > 0)
            Object.assign(details, place);
        return omabook.graph.link(source.id, target.id, Util.clip(relation, 60), details);
    }

    // --- Laying the bible into the plan graph -----------------------------

    function plantWorld(story, world) {
        const known = index(story.world.plan);
        Util.list(world.places).forEach(function (place) {
            put(known, "place", place.name, place.summary, {secret: Util.text(place.secret), since: 0, spoiler: !!Util.text(place.secret)});
        });
        Util.list(world.groups).forEach(function (group) {
            put(known, "group", group.name, group.summary,
                {wants: Util.text(group.wants), secret: Util.text(group.secret), since: 0, spoiler: !!Util.text(group.secret)});
        });
        Util.list(world.rules).forEach(function (rule) {
            put(known, "concept", rule.name, rule.summary, {rule: Util.text(rule.kind), cost: Util.text(rule.cost), since: 0});
        });
        Util.list(world.history).forEach(function (event) {
            put(known, "event", event.name, event.summary,
                {when: Util.text(event.when), truth: Util.text(event.truth), since: 0, spoiler: !!Util.text(event.truth)});
        });
        Util.list(world.relations).forEach(function (relation) { tie(known, relation.from, relation.to, relation.relation, relation.note); });
    }

    function plantCast(story, cast, since) {
        const known = index(story.world.plan);
        Util.list(cast.characters).forEach(function (person) {
            put(known, "character", person.name, person.summary, {
                role: Util.text(person.role), want: Util.text(person.want), need: Util.text(person.need), fear: Util.text(person.fear),
                secret: Util.text(person.secret), contradiction: Util.text(person.contradiction), voice: Util.text(person.voice),
                since: since || 0, spoiler: true
            }, person.aliases);
        });
        Util.list(cast.relations).forEach(function (relation) {
            tie(known, relation.from, relation.to, relation.relation,
                (relation.hidden ? "hidden. " : "") + Util.text(relation.note));
        });
    }

    function plantPlot(story, plot) {
        const known = index(story.world.plan);
        Util.list(plot.threads).forEach(function (thread) {
            put(known, "thread", thread.name, thread.summary, {since: 0, spoiler: true});
            turnsOn(known, thread);
        });
        Util.list(plot.promises).forEach(function (promise) {
            put(known, "promise", promise.name, promise.summary, {status: "open", since: 0, spoiler: true});
        });
        plantTwists(known, plot.twists);
        Util.list(plot.endings).forEach(function (ending) { put(known, "ending", ending.name, ending.summary, {since: 0, spoiler: true}); });
    }

    function plantTwists(known, twists) {
        Util.list(twists).forEach(function (twist) {
            const has = known.find(twist.name);
            put(known, "twist", twist.name, twist.summary, {
                seeds: Util.list(twist.seeds).map(Util.text).filter(Boolean),
                seeded_in: Util.list(twist.seeded_in).map(Number).filter(Boolean),
                pays_off_in: Number(twist.pays_off_in) || 0, changes: Util.text(twist.changes),
                // One that is revised keeps what has already happened to it.
                status: has && has.data.status ? has.data.status : "planned", since: has ? has.data.since || 0 : 0, spoiler: true
            });
            turnsOn(known, twist);
        });
    }

    // The plot is part of the graph, not a list beside it: a thread or a
    // twist is tied to the people, places and groups it turns on.
    function turnsOn(known, plotNode) {
        Util.list(plotNode.involves).forEach(function (name) { tie(known, plotNode.name, name, "turns on"); });
    }

    // What a revised plan changes in the graph: twists and endings by name,
    // and people who are new.
    function replant(story, revised, since) {
        const known = index(story.world.plan);
        plantTwists(known, revised.twists);
        Util.list(revised.endings).forEach(function (ending) { put(known, "ending", ending.name, ending.summary, {spoiler: true}); });
        if (Util.list(revised.characters).length > 0)
            plantCast(story, {characters: revised.characters, relations: revised.relations}, since);
    }

    // --- Reading the plan graph back, as text for a prompt ----------------

    function line(node, parts) {
        const extra = parts.filter(function (part) { return part[1]; }).map(function (part) { return part[0] + ": " + Util.clip(part[1], 600); });
        return "- " + node.name + (Util.list(node.data.aliases).length ? " (also: " + node.data.aliases.join(", ") + ")" : "")
               + ": " + Util.clip(node.summary, 700) + (extra.length ? " [" + extra.join(" | ") + "]" : "");
    }

    function section(title, lines) { return lines.length ? title + "\n" + lines.join("\n") : ""; }

    function worldPart(known) {
        return [
            section("PLACES", known.ofKind("place").map(function (node) { return line(node, [["not generally known", node.data.secret]]); })),
            section("PEOPLES AND FACTIONS", known.ofKind("group").map(function (node) {
                return line(node, [["wants", node.data.wants], ["secret", node.data.secret]]);
            })),
            section("RULES OF THE WORLD", known.ofKind("concept").map(function (node) {
                return line(node, [["kind", node.data.rule], ["cost", node.data.cost]]);
            })),
            section("HISTORY", known.ofKind("event").map(function (node) {
                return line(node, [["when", node.data.when], ["what really happened", node.data.truth]]);
            })),
            section("THINGS", known.ofKind("item").map(function (node) { return line(node, []); }))
        ];
    }

    function castPart(known) {
        const relations = known.edges.map(function (edge) {
            const from = known.byId[edge.source], to = known.byId[edge.target];
            if (!from || !to || PLOT.indexOf(from.kind) >= 0 || PLOT.indexOf(to.kind) >= 0)
                return "";
            return "- " + from.name + " → " + edge.kind + " → " + to.name + (edge.note ? " (" + Util.clip(edge.note, 160) + ")" : "");
        }).filter(Boolean);
        return [
            section("PEOPLE", known.ofKind("character").map(function (node) {
                return line(node, [["role", node.data.role], ["wants", node.data.want], ["needs", node.data.need], ["fears", node.data.fear],
                                   ["secret", node.data.secret], ["contradiction", node.data.contradiction], ["voice", node.data.voice]]);
            })),
            section("RELATIONS", relations.slice(0, 80))
        ];
    }

    function twistLine(node) {
        const data = node.data;
        const state = data.status === "paid" ? "revealed in chapter " + data.paid_in
            : "not yet revealed; due in chapter " + (data.pays_off_in || "?")
              + (Util.list(data.planted_in).length ? "; seeds planted so far in chapters " + data.planted_in.join(", ") : "; no seed planted yet");
        return line(node, [["state", state], ["seeds to plant", Util.list(data.seeds).join(" / ")],
                           ["plant in chapters", Util.list(data.seeded_in).join(", ")], ["changes", data.changes]]);
    }

    function plotPart(known) {
        function current(kind) { return known.ofKind(kind).filter(function (node) { return !node.data.past; }); }
        const past = known.nodes.filter(function (node) { return PLOT.indexOf(node.kind) >= 0 && node.data.past; });
        return [
            section("THREADS", current("thread").map(function (node) { return line(node, []); })),
            section("PROMISES MADE TO THE READER", current("promise").map(function (node) {
                return line(node, [["state", node.data.status === "kept" ? "kept in chapter " + node.data.kept_in : "still owed"]]);
            })),
            section("TWISTS", current("twist").map(twistLine)),
            section("ENDINGS IT COULD REACH", current("ending").map(function (node) { return line(node, []); })),
            section("THE PLOT OF THE EARLIER BOOK, NOW HISTORY", past.map(function (node) { return "- " + node.name + ": " + Util.clip(node.summary, 200); }))
        ];
    }

    // The author's bible as text. `parts` picks sections: "world", "cast",
    // "plot"; all three when not given.
    function bible(story, parts) {
        const known = index(story.world.plan);
        parts = parts || ["world", "cast", "plot"];
        let sections = [];
        if (parts.indexOf("world") >= 0) sections = sections.concat(worldPart(known));
        if (parts.indexOf("cast") >= 0) sections = sections.concat(castPart(known));
        if (parts.indexOf("plot") >= 0) sections = sections.concat(plotPart(known));
        // A world that grew over a long book and its sequels is still cut
        // to a size: this bounds what a chapter costs to ask for.
        return Util.clip(sections.filter(Boolean).join("\n\n"), 36000);
    }

    function openEnds(story) {
        const known = index(story.world.plan);
        return plotPart(known).slice(1, 3).filter(Boolean).join("\n\n");
    }

    function names(story) {
        return index(story.world.plan).nodes.filter(function (node) { return PLOT.indexOf(node.kind) < 0; })
            .map(function (node) { return node.kind + ": " + node.name; }).join("\n");
    }

    // --- The reader's graph ------------------------------------------------

    const ORDER = ["character", "place", "group", "concept", "item", "event"];

    // What the reader knows, as a list for the panel and as text for the
    // model. The order is by kind, then by how lately it changed.
    function known(story) {
        return index(story.world.seen).nodes.slice().sort(function (a, b) {
            const kinds = (ORDER.indexOf(a.kind) + 99) % 99 - (ORDER.indexOf(b.kind) + 99) % 99;
            return kinds || (b.data.since || 0) - (a.data.since || 0) || (a.name < b.name ? -1 : 1);
        }).map(function (node) { return {kind: node.kind, name: node.name, summary: node.summary || "", since: node.data.since || 0}; });
    }

    function readerKnows(story) {
        return Util.clip(known(story).map(function (thing) { return "- " + thing.name + " (" + thing.kind + "): " + Util.clip(thing.summary, 240); }).join("\n"), 6000);
    }

    // Moves what chapters have shown from the story's records into the
    // reader's graph, up to chapter `upTo`. The one place a fact becomes
    // visible. Answers whether anything changed.
    function reveal(story, upTo, bookId) {
        if (story.revealed >= upTo)
            return false;
        const seen = index(story.world.seen), plan = index(story.world.plan);
        story.chapters.forEach(function (chapter) {
            if (chapter.number <= story.revealed || chapter.number > upTo)
                return;
            const record = chapter.record || {}, place = {book: bookId || 0, section: chapter.number - 1, fraction: 0};
            Util.list(record.knows).forEach(function (thing) {
                const planned = plan.find(thing.name), has = seen.find(thing.name);
                const kind = planned ? planned.kind : Util.text(thing.kind) || "concept";
                // A plot node is never a thing the reader "knows".
                if (PLOT.indexOf(kind) >= 0)
                    return;
                put(seen, kind, planned && !has ? planned.name : thing.name, thing.summary, has ? {} : {since: chapter.number}, thing.aliases);
            });
            Util.list(record.relations).forEach(function (relation) { tie(seen, relation.from, relation.to, relation.relation, "", place); });
        });
        story.revealed = upTo;
        return true;
    }

    // What a written chapter changes in the author's graph: the things it
    // invented join the bible, and the plot's ledger is brought up to date
    // (which seeds are in the ground, which twists are out, which promises
    // are kept). Done once per chapter; the chapter remembers that it was.
    function record(story, chapter, bookId) {
        const plan = index(story.world.plan), record = chapter.record || {}, number = chapter.number;
        const place = {book: bookId || 0, section: number - 1, fraction: 0};
        Util.list(record.knows).forEach(function (thing) {
            if (!plan.find(thing.name) && PLOT.indexOf(Util.text(thing.kind)) < 0)
                put(plan, Util.text(thing.kind) || "concept", thing.name, thing.summary, {since: number, invented: true}, thing.aliases);
        });
        Util.list(record.relations).forEach(function (relation) { tie(plan, relation.from, relation.to, relation.relation, "", place); });
        function mark(names, kind, change) {
            Util.list(names).forEach(function (name) {
                const node = plan.find(name);
                if (node && node.kind === kind)
                    put(plan, kind, node.name, "", change(node.data));
            });
        }
        mark(record.seeds_planted, "twist", function (data) {
            const planted = Util.list(data.planted_in).filter(function (n) { return n !== number; }).concat([number]);
            return {planted_in: planted, status: data.status === "paid" ? "paid" : "seeded"};
        });
        mark(record.twists_paid, "twist", function () { return {status: "paid", paid_in: number}; });
        mark(record.promises_kept, "promise", function () { return {status: "kept", kept_in: number}; });
        chapter.recorded = true;
    }

    // Takes back everything after chapter `after`, in both graphs: for a
    // branch (which shares only the chapters up to there) and for a chapter
    // that was written ahead and thrown away when the reader steered.
    // `bookId` is the book whose chapters the relations were learned in.
    function forget(story, after, bookId) {
        [story.world.seen, story.world.plan].forEach(function (scope) {
            const known = index(scope);
            known.nodes.forEach(function (node) {
                const data = node.data;
                if ((data.since || 0) > after) {
                    omabook.graph.remove(node.id);
                    return;
                }
                if (node.kind === "twist") {
                    const planted = Util.list(data.planted_in).filter(function (n) { return n <= after; });
                    const paid = data.status === "paid" && data.paid_in <= after;
                    if (planted.length !== Util.list(data.planted_in).length || (data.status === "paid" && !paid))
                        put(known, "twist", node.name, "", {planted_in: planted, status: paid ? "paid" : planted.length ? "seeded" : "planned",
                                                            paid_in: paid ? data.paid_in : 0});
                }
                if (node.kind === "promise" && data.status === "kept" && data.kept_in > after)
                    put(known, "promise", node.name, "", {status: "open", kept_in: 0});
            });
            known.edges.forEach(function (edge) {
                if (edge.learned && edge.learned.book === bookId && edge.learned.section >= after)
                    omabook.graph.unlink(edge.id);
            });
        });
        story.revealed = Math.min(story.revealed, after);
    }

    // A copy of another story's two graphs under this story's names.
    function copy(from, to) {
        [["seen", "seen"], ["plan", "plan"]].forEach(function (pair) {
            omabook.graph.removeScope(to.world[pair[1]]);
            if (omabook.graph.scopes().indexOf(from.world[pair[0]]) >= 0 && !omabook.graph.copyScope(from.world[pair[0]], to.world[pair[1]]))
                throw new Error("The world of \"" + from.title + "\" could not be copied.");
        });
    }

    // For a sequel: everything the copied world holds is from before this
    // book (chapter 0), and the old plot is history, not open ends.
    function settle(story) {
        [story.world.seen, story.world.plan].forEach(function (scope) {
            const known = index(scope);
            known.nodes.forEach(function (node) {
                const plot = PLOT.indexOf(node.kind) >= 0;
                if ((node.data.since || 0) > 0 || (plot && !node.data.past))
                    put(known, node.kind, node.name, "", plot ? {since: 0, past: true} : {since: 0});
            });
        });
    }

    function drop(story) {
        omabook.graph.removeScope(story.world.seen);
        omabook.graph.removeScope(story.world.plan);
    }

    // The nodes of one of the two graphs, as plain lists, for a look from
    // the command line.
    function listing(scope) {
        const known = index(scope);
        return {
            scope: scope,
            nodes: known.nodes.map(function (node) { return {kind: node.kind, name: node.name, summary: node.summary || "", data: node.data}; }),
            relations: known.edges.map(function (edge) {
                return (known.byId[edge.source] || {}).name + " → " + edge.kind + " → " + (known.byId[edge.target] || {}).name;
            })
        };
    }

    return {
        index: index, plantWorld: plantWorld, plantCast: plantCast, plantPlot: plantPlot, replant: replant, bible: bible,
        openEnds: openEnds, names: names, known: known, readerKnows: readerKnows, reveal: reveal, record: record,
        forget: forget, copy: copy, settle: settle, drop: drop, listing: listing
    };
})();
