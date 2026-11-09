const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const code = fs.readFileSync(path.join(root, "devices/samsung/tizen/device.js"), "utf8");

function fixture() {
    let configured = null;
    const calls = [];
    let listener = null;
    let state = "NONE";
    let currentMs = 0;
    const avplay = {
        close() { calls.push(["close"]); state = "NONE"; },
        getCurrentTime() { return currentMs; },
        getDuration() { return 120000; },
        getState() { return state; },
        open(url) { calls.push(["open", url]); state = "IDLE"; },
        pause() { calls.push(["pause"]); state = "PAUSED"; },
        play() { calls.push(["play"]); state = "PLAYING"; },
        prepareAsync(ok) { calls.push(["prepareAsync"]); state = "READY"; ok(); },
        seekTo(ms, ok) { calls.push(["seekTo", ms]); currentMs = ms; if (ok) ok(); },
        setDisplayRect(x, y, width, height) { calls.push(["rect", x, y, width, height]); },
        setListener(value) { listener = value; calls.push(["listener"]); },
        stop() { calls.push(["stop"]); state = "READY"; },
    };
    const body = { style: { backgroundColor: "rgb(1, 2, 3)" } };
    const html = { style: { backgroundColor: "rgb(4, 5, 6)" } };
    const vdiv = {
        style: { backgroundColor: "black" },
        getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; },
    };
    const media = { style: { visibility: "visible" } };
    const w = {
        __ottCoreTransport: { configure(value) { configured = value; } },
        console: { error() {}, log() {}, warn() {} },
        document: {
            body,
            documentElement: html,
            getElementById(id) { return id === "vdiv" ? vdiv : null; },
        },
        innerHeight: 720,
        innerWidth: 1280,
        screen: { height: 1080, orientation: {}, width: 1920 },
        stbInit() {},
        tizen: { tvinputdevice: { registerKey() {} } },
        version: "test",
        webapis: { avplay },
    };
    w.window = w;
    vm.createContext(w);
    vm.runInContext(code, w);
    return { avplay, body, calls, configured: () => configured, html, listener: () => listener, media, vdiv, w };
}

{
    const f = fixture();
    const configured = f.configured();
    assert.ok(configured, "Samsung Tizen registers platform playback effects");
    assert.equal(typeof configured.engine, "function", "Samsung Tizen registers an AVPlay engine");

    const events = [];
    const lease = configured.engine(
        { url: "https://example.invalid/live/test.m3u8", position: 12, paused: false },
        (name) => events.push(name),
        f.media
    );

    assert.deepEqual(f.calls.find((x) => x[0] === "open"), ["open", "https://example.invalid/live/test.m3u8"]);
    assert.ok(f.calls.some((x) => x[0] === "rect" && x[3] === 1920 && x[4] === 1080), "AVPlay display follows the video surface");
    assert.ok(f.calls.some((x) => x[0] === "seekTo" && x[1] === 12000), "resume position is applied in milliseconds");
    assert.ok(f.calls.some((x) => x[0] === "play"), "prepared playback starts");
    assert.equal(f.media.style.visibility, "hidden", "HTML video is hidden while AVPlay owns the surface");

    f.listener().oncurrentplaytime(15500);
    const sample = lease.sample();
    assert.equal(sample.position, 15.5);
    assert.equal(sample.duration, 120);
    assert.equal(sample.paused, false);
    assert.ok(events.includes("timeupdate"));

    lease.pause();
    assert.equal(lease.sample().paused, true);
    lease.resume();
    assert.equal(lease.sample().paused, false);
    lease.seek(30);
    assert.ok(f.calls.some((x) => x[0] === "seekTo" && x[1] === 30000));

    lease.dispose();
    assert.ok(f.calls.some((x) => x[0] === "stop"));
    assert.ok(f.calls.filter((x) => x[0] === "close").length >= 1);
    assert.equal(f.media.style.visibility, "visible", "HTML surface is restored after AVPlay closes");
}

const stageScript = fs.readFileSync(path.join(root, "scripts/stage-starlink-tv.cjs"), "utf8");
assert.ok(
    stageScript.includes('$WEBAPIS/webapis/webapis.js'),
    "Samsung staging must load the Samsung AVPlay WebAPI library"
);

console.log("tizen avplay adapter tests passed");
