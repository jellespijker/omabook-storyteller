// Work in progress, kept on disk.
//
// Writing takes minutes and several requests, and Omabook can be closed in
// the middle of any of them. So a piece of writing is a "job": a small
// JSON file, data/jobs/<story id>.json, that says what is being made and
// holds every result so far (the world once it is built, the draft once it
// is written). The script's memory holds nothing that matters. Picking a
// job up again repeats at most the one request that was cut off.
//
// A job is in one of four states, told from the file and from memory:
//   running      this script is working on it now
//   elsewhere    another Omabook is (the file shows a recent sign of life)
//   interrupted  nobody is: it was cut off, and can be picked up
//   failed       it stopped with a problem, which is kept in the file; it
//                is tried again only when the reader asks, never by itself,
//                so a model that keeps failing does not keep costing.
var Jobs = (function () {
    "use strict";

    const FOLDER = "data/jobs";
    const active = {};

    function path(id) { return FOLDER + "/" + id + ".json"; }

    function read(id) {
        const words = omabook.files.read(path(id));
        if (words === null)
            return null;
        try {
            const job = JSON.parse(words);
            return job && job.story === id ? job : null;
        } catch (error) {
            return null;
        }
    }

    // Every save is also a sign of life.
    function save(job) {
        job.beat = Date.now();
        omabook.files.write(path(job.story), JSON.stringify(job, null, 1));
        return job;
    }

    function clear(id) {
        delete active[id];
        omabook.files.remove(path(id));
    }

    function all() {
        return omabook.files.list(FOLDER).filter(function (name) { return /\.json$/.test(name); })
            .map(function (name) { return read(name.replace(/\.json$/, "")); }).filter(Boolean);
    }

    function stale() { return Config.get("stale_seconds") * 1000; }

    function state(id) {
        const job = read(id);
        if (active[id]) return "running";
        if (!job) return "none";
        if (job.failed) return "failed";
        return Date.now() - (job.beat || 0) > stale() ? "interrupted" : "elsewhere";
    }

    // Marks a job as this script's and keeps its file fresh while a request
    // is out, so another Omabook leaves it alone. There is no repeating
    // timer in a plugin; a timer that sets itself again is one.
    function begin(job) {
        delete job.failed;
        delete job.collisions;
        active[job.story] = job;
        save(job);
        const every = Math.max(250, Math.min(1500, stale() / 3));
        function tick() {
            if (active[job.story] !== job)
                return;
            save(job);
            omabook.after(every, tick);
        }
        omabook.after(every, tick);
    }

    function fail(job, error) {
        delete active[job.story];
        job.failed = Util.text(error && error.message || error) || "It went wrong.";
        if (error && error.collisions)
            job.collisions = error.collisions;
        save(job);
    }

    return {read: read, save: save, clear: clear, all: all, state: state, begin: begin, fail: fail,
            running: function (id) { return !!active[id]; }};
})();
