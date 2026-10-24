const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");
const acorn = require("acorn");
const { JSDOM } = require("jsdom");
const controllerSource = fs.readFileSync("starlink/tv/controller.js", "utf8");
const context = { module: { exports: {} } };
vm.runInNewContext(controllerSource, context);
const { create, assignment, serverOrigin } = context.module.exports;
const future = "2030-01-01T00:00:00Z";
const saved = {
    expires: future,
    token: "fixture-token-at-least-20-characters",
};
function rig(session = null, mode) {
    let stored = session,
        now = Date.parse("2026-10-24T00:00:00Z"),
        timer = null;
    const requests = [],
        states = [],
        applied = [],
        stops = [],
        resets = [];
    const ports = {
        apply: (url, revision) => {
            applied.push({ revision, url });
        },
        clearTimer: () => {
            timer = null;
        },
        now: () => now,
        read: () => stored,
        request: (method, path, body, headers, done) => {
            const req = { aborted: false, body, done, headers, method, path };
            requests.push(req);
            return () => {
                req.aborted = true;
            };
        },
        reset: () => resets.push(true),
        save: (value) => {
            stored = value;
        },
        setTimer: (fn, delay) => {
            timer = { delay, fn };
            return timer;
        },
        state: (value) => states.push(value),
        stop: () => stops.push(true),
    };
    const owner = create(ports, {
        apiBase: "https://panel.invalid",
        deviceId: "starlink-tv-samsung:fixture",
        mode,
        platform: "samsung",
    });
    const data = (revision = "r1", configured = true) => ({
        configured,
        platform: "samsung",
        refresh_seconds: 120,
        revision,
        schema_version: 1,
        source_url: configured ? "https://media.invalid/authorized.m3u" : null,
    });
    return {
        applied,
        data,
        expire: () => {
            now = Date.parse(future) + 1;
        },
        owner,
        ports,
        requests,
        resets,
        states,
        stops,
        stored: () => stored,
        timer: () => timer,
    };
}
test("new installation never starts a demo or makes a catalog request", () => {
    const r = rig();
    r.owner.start();
    assert.equal(r.states.at(-1), "login");
    assert.equal(r.requests.length, 0);
    assert.equal(r.applied.length, 0);
    assert.equal(r.owner.admitted(), false);
});
test("relative login lifetime avoids interpreting a naive server timestamp in the TV timezone", () => {
    const r = rig();
    r.owner.login("fixture", "secret");
    r.requests[0].done(200, {
        authorized: true,
        expires_at: "2000-01-01T00:00:00",
        expires_in_seconds: 3600,
        session_token: saved.token,
    });
    assert.equal(r.stored().expires, "2026-10-24T01:00:00.000Z");
    assert.equal(r.requests.length, 2);
});
test("login stores only bearer/expiry and waits for later remote assignment", () => {
    const r = rig();
    r.owner.start();
    r.owner.login("fixture", "fixture-secret");
    assert.equal(r.requests[0].path, "/app/auth/login");
    r.requests[0].done(200, {
        authorized: true,
        expires_at: future,
        session_token: saved.token,
    });
    assert(!JSON.stringify(r.stored()).includes("fixture-secret"));
    assert.equal(
        r.requests[1].headers["X-Device-ID"],
        "starlink-tv-samsung:fixture"
    );
    r.requests[1].done(200, r.data("empty", false));
    assert.equal(r.states.at(-1), "waiting");
    assert.equal(r.applied.length, 0);
    r.timer().fn();
    r.requests.at(-1).done(200, r.data());
    assert.equal(r.owner.admitted(), true);
    assert.equal(r.applied.length, 1);
});
test("remote revision changes reload once without reinstall; unchanged revisions do not", () => {
    const r = rig(saved);
    r.owner.start();
    r.requests.at(-1).done(200, r.data());
    r.timer().fn();
    r.requests.at(-1).done(200, r.data());
    assert.equal(r.applied.length, 1);
    r.timer().fn();
    r.requests.at(-1).done(200, r.data("r2"));
    assert.equal(r.applied.length, 2);
    r.timer().fn();
    r.requests.at(-1).done(200, r.data("empty", false));
    assert.equal(r.owner.admitted(), false);
    assert.equal(r.states.at(-1), "waiting");
});
test("revocation cancels old replies and clears both session and managed profile", () => {
    const r = rig(saved);
    r.owner.start();
    const old = r.requests[0];
    r.owner.refresh();
    assert.equal(old.aborted, true);
    old.done(200, r.data());
    assert.equal(r.applied.length, 0);
    r.requests.at(-1).done(403, {});
    assert.equal(r.stored(), null);
    assert.equal(r.owner.admitted(), false);
    assert.equal(r.resets.length, 1);
    assert.equal(r.timer(), null);
});
test("logout during login cannot be undone by its late successful response", () => {
    const r = rig();
    r.owner.login("fixture", "secret");
    const old = r.requests[0];
    r.owner.logout();
    old.done(200, {
        authorized: true,
        expires_at: future,
        session_token: saved.token,
    });
    assert.equal(r.stored(), null);
    assert.equal(r.requests.length, 1);
});
test("expired session, network failure and malformed config never admit cached playback", () => {
    const r = rig(saved);
    r.owner.start();
    r.requests[0].done(200, r.data());
    r.timer().fn();
    r.requests.at(-1).done(0, null);
    assert.equal(r.states.at(-1), "connection_error");
    assert.equal(r.owner.admitted(), false);
    r.timer().fn();
    r.requests.at(-1).done(200, { ...r.data(), platform: "lg" });
    assert.equal(r.states.at(-1), "invalid_assignment");
    assert.equal(r.owner.admitted(), false);
    r.expire();
    r.timer().fn();
    assert.equal(r.states.at(-1), "login");
});
test("provider assignment URL validation rejects credentials, fragments and executable URLs", () => {
    for (const url of [
        "javascript:alert(1)",
        "https://user:pass@host.invalid/a",
        "https://host.invalid/a#fragment",
        "https://host.invalid\\@evil/a",
    ]) {
        assert.throws(() =>
            assignment(
                {
                    configured: true,
                    platform: "lg",
                    revision: "r",
                    schema_version: 1,
                    source_url: url,
                },
                "lg"
            )
        );
    }
});
test("storage failure and reentrant logout cannot leave the player admitted", () => {
    const r = rig(saved);
    r.owner.start();
    r.ports.apply = () => {
        throw new Error("quota");
    };
    r.requests[0].done(200, r.data());
    assert.equal(r.owner.admitted(), false);
    assert.equal(r.states.at(-1), "storage_error");
    const next = rig(saved);
    next.owner.start();
    next.ports.apply = () => next.owner.logout();
    next.requests[0].done(200, next.data());
    assert.equal(next.owner.admitted(), false);
    assert.equal(next.states.at(-1), "login");
});
test("ES5 bootstrap uses branded empty shell; password never persists", (t) => {
    for (const file of ["controller.js", "bootstrap.js"])
        acorn.parse(fs.readFileSync("starlink/tv/" + file, "utf8"), {
            ecmaVersion: 5,
        });
    const dom = new JSDOM("<body class='booting'></body>", {
        runScripts: "outside-only",
        url: "https://tv.invalid/index.html",
    });
    const w = dom.window,
        writes = [],
        requests = [];
    t.after(() => {
        w.dispatchEvent(new w.Event("beforeunload"));
        dom.window.close();
    });
    w.STARLINK_TV_CONFIG = {
        apiBase: "https://panel.invalid",
        platform: "samsung",
    };
    w.stbSetItem = (key, value) => writes.push([key, value]);
    w.stbClearAllItems = () => {};
    w.XMLHttpRequest = class {
        open(method, url) {
            this.method = method;
            this.url = url;
        }
        setRequestHeader() {}
        abort() {}
        send(body) {
            this.body = body;
            requests.push(this);
        }
    };
    w.eval(controllerSource);
    w.eval(fs.readFileSync("starlink/tv/bootstrap.js", "utf8"));
    let started = 0;
    w.__starlinkTv.connect(() => started++);
    assert.equal(started, 0);
    assert.equal(
        w.document.querySelector(".starlink-brand").textContent,
        "STARLINK IPTV"
    );
    const user = w.document.getElementById("starlink-login"),
        password = w.document.getElementById("starlink-password");
    user.value = "fixture";
    password.value = "private-secret";
    w.document
        .getElementById("starlink-form")
        .dispatchEvent(new w.Event("submit", { cancelable: true }));
    assert.equal(password.value, "");
    assert.equal(requests.length, 1);
    const login = requests[0];
    login.status = 200;
    login.responseText = JSON.stringify({
        authorized: true,
        expires_at: future,
        session_token: saved.token,
    });
    login.onload();
    const source = requests[1];
    source.status = 200;
    source.responseText = JSON.stringify({
        configured: true,
        platform: "samsung",
        revision: "r",
        schema_version: 1,
        source_url: "https://media.invalid/list.m3u",
    });
    source.onload();
    assert.equal(started, 1);
    assert.equal(w.__starlinkTv.admitted(), true);
    assert(w.document.getElementById("starlink-connect").hidden);
    assert.equal(
        writes.find(
            (entry) => entry[0] === "ottplayprov" && entry[1] === "m3u"
        )[1],
        "m3u"
    );
    assert(
        !JSON.stringify(
            Object.keys(w.localStorage).map((key) =>
                w.localStorage.getItem(key)
            )
        ).includes("private-secret")
    );
    assert(
        !w.sessionStorage
            .getItem("starlink-tv-session-v1")
            .includes("private-secret")
    );
    w.dispatchEvent(new w.Event("beforeunload"));
    dom.window.close();
});

test("personal catalog validates Xtream directly and keeps credentials only in memory", () => {
    const r = rig(null, "account");
    r.owner.start();
    r.owner.login("fixture-user", "fixture-pass");
    assert(r.requests.at(-1).path.startsWith("/player_api.php?"));
    assert.equal(r.owner.accountSource(), null);
    r.requests.at(-1).done(200, { user_info: { auth: 1, status: "Active" } });
    assert.equal(r.owner.accountSource().username, "fixture-user");
    assert.equal(r.owner.accountSource().password, "fixture-pass");
    assert.equal(JSON.stringify(r.stored()).includes("fixture-pass"), false);
    assert.equal(r.applied.length, 1);
    r.owner.logout();
    assert.equal(r.owner.accountSource(), null);
    assert.equal(r.owner.admitted(), false);
    assert.equal(r.stored(), null);
});
test("personal restart requires login rather than persisting Xtream credentials", () => {
    const r = rig(saved, "account");
    r.owner.start();
    assert.equal(r.states.at(-1), "login");
    assert.equal(r.requests.length, 0);
    assert.equal(r.owner.accountSource(), null);
});

test("login failures distinguish local fields, credentials, denial and server responses without exposing detail", () => {
    for (const [status, code, state] of [
        [401, "invalid_credentials", "credentials_error"],
        [403, "client_blocked", "blocked_error"],
        [403, "subscription_expired", "expired_error"],
        [403, "client_inactive", "inactive_error"],
        [403, "unknown", "access_error"],
        [429, "anything", "rate_error"],
        [404, "anything", "endpoint_error"],
        [422, "anything", "format_error"],
        [500, "anything", "server_error"],
        [200, "anything", "response_error"],
        [0, "anything", "connection_error"],
    ]) {
        const r = rig();
        r.owner.login("fixture-user", "fixture-secret");
        r.requests[0].done(status, {
            detail: { code, message: "private-server-detail" },
        });
        assert.equal(r.states.at(-1), state);
        assert.equal(r.owner.admitted(), false);
        assert.equal(r.requests.length, 1);
        assert.equal(r.stored(), null);
    }
});

test("personal account cannot bypass denial and polling does not reopen the catalog", () => {
    for (const data of [
        { user_info: { auth: 0 } },
        { user_info: { auth: 1, status: "Expired" } },
        {},
    ]) {
        const r = rig(null, "account");
        r.owner.login("fixture-user", "fixture-pass");
        r.requests[0].done(200, data);
        assert.equal(r.owner.admitted(), false);
        assert.equal(r.owner.accountSource(), null);
        assert.equal(r.applied.length, 0);
    }
    const r = rig(null, "account");
    r.owner.login("fixture-user", "fixture-pass");
    const success = { user_info: { auth: "1", status: "Active" } };
    r.requests.at(-1).done(200, success);
    assert.deepEqual(Object.keys(r.requests[0].headers), []);
    r.timer().fn();
    r.requests.at(-1).done(200, success);
    assert.equal(r.applied.length, 1);
    r.owner.refresh(true);
    r.requests.at(-1).done(200, success);
    assert.equal(r.applied.length, 2);
    r.owner.refresh();
    const late = r.requests.at(-1);
    r.owner.logout();
    late.done(200, success);
    assert.equal(r.owner.admitted(), false);
    assert.equal(r.owner.accountSource(), null);
    assert.equal(r.stored(), null);
});

test("open player starts empty and requires an explicit credential-free server origin", () => {
    for (const value of [
        "",
        "ftp://host",
        "https://user:pass@host",
        "https://host/path",
        "https://host?x=1",
        "https://host#fragment",
        "https://host\\evil",
    ])
        assert.equal(serverOrigin(value), "");
    assert.equal(
        serverOrigin(" https://my-server.invalid:8443/ "),
        "https://my-server.invalid:8443"
    );
    assert.equal(
        serverOrigin("http://192.168.1.10:8080"),
        "http://192.168.1.10:8080"
    );
    const r = rig(null, "open");
    r.owner.start();
    assert.equal(r.requests.length, 0);
    r.owner.login("fixture", "secret", "https://user:pass@host");
    assert.equal(r.requests.length, 0);
    assert.equal(r.states.at(-1), "invalid_server_error");
    r.owner.login("fixture", "secret", "https://chosen.invalid:8443/");
    assert.equal(r.owner.serverOrigin(), "https://chosen.invalid:8443");
    assert(r.requests[0].path.startsWith("/player_api.php?"));
    r.requests[0].done(200, { user_info: { auth: 1, status: "Active" } });
    assert.equal(r.owner.accountSource().server, "https://chosen.invalid:8443");
    assert.equal(r.applied[0].url, "https://chosen.invalid:8443");
    assert.equal(r.stored(), null);
    r.owner.logout();
    assert.equal(r.owner.admitted(), false);
});
