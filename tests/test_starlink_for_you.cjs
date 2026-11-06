const assert = require("node:assert/strict");
const test = require("node:test");
const { JSDOM } = require("jsdom");
const fs = require("node:fs");
const vm = require("node:vm");
const sandbox = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync("starlink/tv/for-you.js", "utf8"), sandbox);
const { rankChannels, normalize, create } = sandbox.module.exports;

test("matches only explicit selected interests without changing provider data", () => {
    const football = { ch_id: 1, channel_name: "Futebol HD", category: { name: "Esportes" }, stream_url: "https://fixture.invalid/1" };
    const gospel = { ch_id: 2, channel_name: "Louvor Gospel", category: { name: "Música" } };
    const others = { ch_id: 3, channel_name: "Jornal da Noite", category: { name: "Notícias" } };
    const channels = { 1: football, 2: gospel, 3: others };
    const result = rankChannels(channels, ["futebol"], []);
    assert.deepEqual(Array.from(result, item => item.id), [1]);
    assert.equal(football.stream_url, "https://fixture.invalid/1");
    assert.equal(football.category.name, "Esportes");
});

test("normalizes accented genres and excludes unrelated channels", () => {
    assert.equal(normalize("Séries, Animação!"), "series animacao");
    const result = rankChannels({
        17: { ch_id: 17, channel_name: "Série Clássica", category: { name: "Séries" } },
        22: { ch_id: 22, channel_name: "Infantil", category: { name: "Desenhos" } }
    }, ["series"], []);
    assert.deepEqual(Array.from(result, item => item.id), [17]);
});

test("no opt-in preferences means no suggestions or inferred tastes", () => {
    assert.equal(rankChannels({ 1: { ch_id: 1, channel_name: "Futebol" } }, [], []).length, 0);
    assert.equal(rankChannels(null, ["futebol"], []).length, 0);
});

test("favorites are a tie-breaker, not a signal to infer preferences", () => {
    const channels = {
        4: { ch_id: 4, channel_name: "Gospel Quatro" },
        5: { ch_id: 5, channel_name: "Gospel Cinco" },
        6: { ch_id: 6, channel_name: "Jornal" }
    };
    assert.deepEqual(Array.from(rankChannels(channels, ["gospel"], [5]), x => x.id), [5, 4]);
    assert.equal(rankChannels(channels, [], [5]).length, 0);
});

test("suggestions are capped and unsuitable entries are ignored", () => {
    const channels = { 0: { ch_id: 0, channel_name: "" } };
    for (let i = 1; i <= 30; i++) channels[i] = { ch_id: i, channel_name: "Futebol " + i };
    assert.equal(rankChannels(channels, ["futebol"], [], 12).length, 12);
});

test("TV overlay is optional, local and uses native setCurrent for playback", () => {
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://tv.invalid" });
    const win = dom.window;
    win.STARLINK_TV_CONFIG = { platform: "samsung", mode: "open" };
    let played = null;
    win.commandChannelsReady = true;
    win.channels = { 7: { ch_id: 7, channel_name: "Futebol RJ", category: { name: "Esportes" } } };
    win.catsArray = ["Esportes"];
    win.cats = { Esportes: [7] };
    win.setCurrent = (c, i) => { played = [c, i]; };
    const view = create(win);
    view.setAdmission(true);
    assert.equal(win.document.getElementById("starlink-for-you-launch").hidden, false);
    win.document.getElementById("starlink-for-you-launch").click();
    assert.equal(win.document.getElementById("starlink-for-you-panel").hidden, false);
    win.document.querySelector('[data-interest="futebol"]').click();
    win.document.getElementById("starlink-for-you-save").click();
    const button = win.document.querySelector('[data-channel-id="7"]');
    assert.ok(button, "matching channel must be presented");
    button.click();
    assert.deepEqual(played, [0, 0]);
    assert.equal(win.document.getElementById("starlink-for-you-panel").hidden, true);
    view.setAdmission(false);
    assert.equal(win.document.getElementById("starlink-for-you-launch").hidden, true);
    dom.window.close();
});

test("user preferences are cleared with the app local sandbox and not sent anywhere", () => {
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://tv.invalid" });
    const view = create(dom.window);
    view.setAdmission(true);
    dom.window.document.getElementById("starlink-for-you-launch").click();
    dom.window.document.querySelector('[data-interest="gospel"]').click();
    dom.window.document.getElementById("starlink-for-you-save").click();
    assert.ok(dom.window.localStorage.getItem("starlink-for-you-v1"));
    view.setAdmission(false);
    dom.window.localStorage.clear();
    const second = create(dom.window);
    second.setAdmission(true);
    assert.equal(second.getInterests().length, 0);
    dom.window.close();
});

test("first sign-in offers an optional preference screen only once per session", () => {
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://tv.invalid" });
    const view = create(dom.window);
    view.setAdmission(true);
    const panel = dom.window.document.getElementById("starlink-for-you-panel");
    assert.equal(panel.hidden, false);
    dom.window.document.getElementById("starlink-for-you-skip").click();
    assert.equal(panel.hidden, true);
    view.setAdmission(true);
    assert.equal(panel.hidden, true);
    view.setAdmission(false);
    view.setAdmission(true);
    assert.equal(panel.hidden, true);
    dom.window.close();
});

test("skipping setup persists a neutral opt-out until the TV account is reset", () => {
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://tv.invalid" });
    const win = dom.window;
    const first = create(win);
    first.setAdmission(true);
    win.document.getElementById("starlink-for-you-skip").click();
    assert.ok(win.localStorage.getItem("starlink-for-you-v1"));
    const second = create(win);
    second.setAdmission(true);
    assert.equal(win.document.getElementById("starlink-for-you-panel").hidden, true);
    assert.equal(second.getInterests().length, 0);
    dom.window.close();
});

test("Samsung Xtream shortcuts open original movie and series folders, never custom streams", () => {
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://tv.invalid" });
    const w = dom.window;
    w.STARLINK_TV_CONFIG = { mode: "open", platform: "samsung" };
    w.commandChannelsReady = true;
    const paths = [];
    w.mediaList = (target) => paths.push(target);
    const view = create(w);
    view.setAdmission(true);
    w.document.getElementById("starlink-for-you-movies").click();
    assert.deepEqual(JSON.parse(JSON.stringify(paths)), [{ kind: "vod", name: "Filmes" }]);
    assert.equal(w.document.getElementById("starlink-for-you-panel").hidden, true);
    view.open();
    w.document.getElementById("starlink-for-you-series").click();
    assert.deepEqual(JSON.parse(JSON.stringify(paths)), [
        { kind: "vod", name: "Filmes" },
        { kind: "series", name: "Séries" }
    ]);
    dom.window.close();
});

test("Samsung managed M3U does not offer Xtream-only folders", () => {
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://tv.invalid" });
    dom.window.STARLINK_TV_CONFIG = { mode: "managed", platform: "samsung" };
    const view = create(dom.window);
    view.setAdmission(true);
    assert.equal(dom.window.document.getElementById("starlink-for-you-movies").hidden, true);
    assert.equal(dom.window.document.getElementById("starlink-for-you-series").hidden, true);
    dom.window.close();
});

test("catalog category browsing selects real channel position, not recommendation position", () => {
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://tv.invalid" });
    const w = dom.window;
    w.STARLINK_TV_CONFIG = { mode: "open", platform: "samsung" };
    w.commandChannelsReady = true;
    w.channels = {
        101: { ch_id: 101, channel_name: "Canal A" },
        102: { ch_id: 102, channel_name: "Canal B" },
        103: { ch_id: 103, channel_name: "Canal C" }
    };
    w.catsArray = ["Notícias", "Esportes"];
    w.cats = { "Notícias": [101], "Esportes": [102, 103] };
    let selected = null;
    w.setCurrent = (cat, idx) => selected = [cat, idx];
    const view = create(w);
    view.setAdmission(true);
    const selectedCategory = w.document.querySelector('[data-category="Esportes"]');
    selectedCategory.focus();
    selectedCategory.click();
    assert.equal(w.document.activeElement, selectedCategory,
        "Remote focus should remain on the selected category");
    const cards = w.document.querySelectorAll(".starlink-foryou-channel");
    assert.equal(cards.length, 2);
    assert.equal(cards[0].getAttribute("data-channel-id"), "102");
    cards[1].click();
    assert.deepEqual(selected, [1, 1]);
    dom.window.close();
});

test("channel search filters visible non-adult channels without fetching remote content", () => {
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://tv.invalid" });
    const w = dom.window;
    w.STARLINK_TV_CONFIG = { mode: "open", platform: "samsung" };
    w.commandChannelsReady = true;
    w.channels = {
        4: { ch_id: 4, channel_name: "Filme Ação" },
        5: { ch_id: 5, channel_name: "Filme secreto", adult: 1 },
        6: { ch_id: 6, channel_name: "Jornal" }
    };
    w.catsArray = ["Filmes"];
    w.cats = { Filmes: [4, 5, 6] };
    const view = create(w);
    view.setAdmission(true);
    const input = w.document.getElementById("starlink-for-you-search");
    input.value = "filme";
    input.dispatchEvent(new w.Event("input", { bubbles: true }));
    const cards = w.document.querySelectorAll(".starlink-foryou-channel");
    assert.deepEqual(Array.from(cards, x => x.getAttribute("data-channel-id")), ["4"]);
    dom.window.close();
});

test("recommendations do not expose adult rows even when names match preferences", () => {
    const results = rankChannels({
        10: { ch_id: 10, channel_name: "Filmes adultos", adult: 1 },
        11: { ch_id: 11, channel_name: "Cinema Popular", adult: 0 }
    }, ["filmes"], []);
    assert.equal(results.some(x => x.id === 10), false);
});

test("duplicate channel placed in two groups keeps the explicitly selected category", () => {
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://tv.invalid" });
    const w = dom.window;
    w.STARLINK_TV_CONFIG = { mode: "open", platform: "samsung" };
    w.commandChannelsReady = true;
    w.channels = { 55: { ch_id: 55, channel_name: "Canal Duplicado" } };
    w.catsArray = ["Todos", "Infantil"];
    w.cats = { Todos: [55], Infantil: [55] };
    const played = [];
    w.setCurrent = (cat, index) => played.push([cat, index]);
    const view = create(w);
    view.setAdmission(true);
    w.document.querySelector('[data-category="Infantil"]').click();
    w.document.querySelector('[data-channel-id="55"]').click();
    assert.deepEqual(played, [[1, 0]]);
    dom.window.close();
});

test("categories appear when channel catalog becomes ready after onboarding opens", async () => {
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://tv.invalid" });
    const w = dom.window;
    w.STARLINK_TV_CONFIG = { mode: "open", platform: "samsung" };
    w.commandChannelsReady = false;
    const view = create(w);
    view.setAdmission(true);
    assert.equal(w.document.querySelectorAll("[data-category]").length, 0);
    w.commandChannelsReady = true;
    w.channels = { 2: { ch_id: 2, channel_name: "Futebol Brasil" } };
    w.catsArray = ["Esportes"];
    w.cats = { Esportes: [2] };
    await new Promise((resolve) => setTimeout(resolve, 800));
    assert.equal(w.document.querySelectorAll('[data-category="Esportes"]').length, 1);
    w.document.querySelector('[data-category="Esportes"]').click();
    assert.equal(w.document.querySelectorAll('[data-channel-id="2"]').length, 1);
    view.setAdmission(false);
    dom.window.close();
});

test("M3U channel records without ch_id use the catalog map key for lookup and playback", () => {
    const catalog = { 788: { channel_name: "Canal de validação" } };
    const recommendations = rankChannels(catalog, ["desenhos"], []);
    assert.equal(recommendations.length, 0);
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://tv.invalid" });
    const w = dom.window;
    w.STARLINK_TV_CONFIG = { mode: "managed", platform: "samsung" };
    w.commandChannelsReady = true;
    w.channels = catalog;
    w.catsArray = ["Validação"];
    w.cats = { "Validação": [788] };
    let played = null;
    w.setCurrent = (category, index) => played = [category, index];
    const view = create(w);
    view.setAdmission(true);
    const search = w.document.getElementById("starlink-for-you-search");
    search.value = "valida";
    search.dispatchEvent(new w.Event("input", { bubbles: true }));
    const button = w.document.querySelector('[data-channel-id="788"]');
    assert.ok(button, "Channel without embedded ch_id must be searchable");
    button.click();
    assert.deepEqual(played, [0, 0]);
    dom.window.close();
});
