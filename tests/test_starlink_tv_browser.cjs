/* Built-package smoke test. Every panel/source/media request is synthetic. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");
const { stage } = require("../scripts/stage-starlink-tv.cjs");

async function run(platform, mode = "managed") {
    const personal = mode === "account";
    const directory = stage(platform, "https://panel.invalid", mode);
    const server = http.createServer((request, response) => {
        const file = path.resolve(
            directory,
            "." + new URL(request.url, "http://local").pathname
        );
        if (
            !file.startsWith(directory + path.sep) ||
            !fs.existsSync(file) ||
            !fs.statSync(file).isFile()
        ) {
            response.writeHead(404);
            response.end();
            return;
        }
        const mime = {
            ".css": "text/css",
            ".html": "text/html",
            ".js": "application/javascript",
            ".json": "application/json",
            ".png": "image/png",
        };
        response.setHeader(
            "Content-Type",
            mime[path.extname(file)] || "application/octet-stream"
        );
        fs.createReadStream(file).pipe(response);
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    let browser;
    try {
        browser = await chromium.launch({
            args: ["--no-sandbox"],
            executablePath: process.env.STARLINK_CHROMIUM || undefined,
            headless: true,
        });
        const origin = "http://127.0.0.1:" + server.address().port;
        const page = await browser.newPage({
            viewport: { height: 1080, width: 1920 },
        });
        let configured = false,
            revision = "empty",
            sourceRequests = 0;
        const unexpected = [],
            errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/*", async (route) => {
            const request = route.request(),
                url = new URL(request.url());
            if (url.origin === origin) {
                await route.continue();
                return;
            }
            const cors = {
                "Access-Control-Allow-Headers":
                    "authorization,x-device-id,content-type,accept",
                "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
                "Access-Control-Allow-Origin": origin,
            };
            if (request.method() === "OPTIONS") {
                await route.fulfill({ headers: cors, status: 204 });
                return;
            }
            if (
                personal &&
                url.origin === "https://panel.invalid" &&
                /^\/live\//.test(url.pathname)
            ) {
                await route.abort();
                return;
            }
            if (url.origin === "https://panel.invalid") {
                if (url.pathname === "/app/auth/login") {
                    const body = request.postDataJSON();
                    assert.equal(body.login, "fixture-user");
                    assert(
                        body.device_id.startsWith(
                            "starlink-tv-" + platform + ":"
                        )
                    );
                    await route.fulfill({
                        headers: cors,
                        json: {
                            authorized: true,
                            expires_at: new Date(
                                Date.now() + 3600000
                            ).toISOString(),
                            session_token: "fixture-session-token-at-least-20",
                        },
                    });
                    return;
                }
                if (
                    personal &&
                    url.pathname === "/app/auth/playlist-revision"
                ) {
                    await route.fulfill({
                        headers: cors,
                        json: { poll_after_seconds: 120, revision: "original" },
                    });
                    return;
                }
                if (personal && url.pathname === "/player_api.php") {
                    assert.equal(
                        url.searchParams.get("username"),
                        "fixture-user"
                    );
                    assert.equal(
                        url.searchParams.get("password"),
                        "fixture-pass"
                    );
                    const action = url.searchParams.get("action");
                    const responses = {
                        get_live_categories: [
                            {
                                category_id: "10",
                                category_name: "Original M81",
                            },
                        ],
                        get_live_streams: [
                            {
                                category_id: "10",
                                name: "Original live",
                                stream_id: 42,
                                stream_type: "live",
                            },
                        ],
                        get_series: [{ name: "Original series", series_id: 8 }],
                        get_series_categories: [],
                        get_series_info: {
                            episodes: {
                                1: [
                                    {
                                        container_extension: "mp4",
                                        episode_num: 1,
                                        id: "81",
                                        season: 1,
                                        title: "Original episode",
                                    },
                                ],
                            },
                        },
                        get_short_epg: { epg_listings: [] },
                        get_vod_categories: [],
                        get_vod_streams: [
                            {
                                container_extension: "mp4",
                                name: "Original movie",
                                stream_id: 43,
                            },
                        ],
                    };
                    assert(
                        action === null || action in responses,
                        "Unexpected Xtream action: " + action
                    );
                    await route.fulfill({
                        headers: cors,
                        json:
                            action === null
                                ? { user_info: { auth: 1, status: "Active" } }
                                : responses[action],
                    });
                    return;
                }
                if (url.pathname === "/api/v1/tv-m3u/source") {
                    sourceRequests++;
                    await route.fulfill({
                        headers: cors,
                        json: {
                            configured,
                            platform,
                            refresh_seconds: 120,
                            revision,
                            schema_version: 1,
                            source_url: configured
                                ? "https://media.invalid/list.m3u"
                                : null,
                        },
                    });
                    return;
                }
            }
            if (url.href === "https://media.invalid/list.m3u") {
                await route.fulfill({
                    body: '#EXTM3U\n#EXTINF:-1 tvg-id="fixture" group-title="Validação",Canal de validação\nhttps://media.invalid/live.m3u8\n',
                    contentType: "application/x-mpegurl",
                    headers: cors,
                });
                return;
            }
            // No actual playback, telemetry or remote vendor service is contacted.
            if (url.origin === "https://media.invalid") {
                await route.abort();
                return;
            }
            unexpected.push(url.origin + url.pathname);
            await route.abort();
        });
        await page.goto(origin + "/index.html");
        await page
            .locator("#starlink-login")
            .waitFor({ state: "visible", timeout: 20000 });
        assert.equal(sourceRequests, 0);
        await page.locator("#starlink-login").fill("fixture-user");
        await page.locator("#starlink-password").fill("fixture-pass");
        await page.locator("#starlink-form button").click();
        if (!personal) {
            await page
                .getByText("Aguardando configuração do catálogo pelo painel.", {
                    exact: true,
                })
                .waitFor();
            assert.equal(
                await page.evaluate(() => window.__starlinkTv.admitted()),
                false
            );
            const screenshot = path.join(
                directory,
                "STARLINK-" + platform + "-waiting.png"
            );
            await page.screenshot({ path: screenshot });
            configured = true;
            revision = "assigned";
            await page.locator("#starlink-retry").click();
        }
        await page.waitForFunction(() => window.__starlinkTv.admitted());
        await page.waitForFunction(() => window.commandChannelsReady === true, {
            timeout: 20000,
        });
        assert.equal(
            await page.evaluate(() => window.__ottActiveProviderDriver.id),
            personal ? "xtream" : "m3u"
        );
        assert.equal(
            await page.evaluate(() => window.isProviderAllowed("demo")),
            false
        );
        assert.equal(
            await page.evaluate(() => window.isProviderAllowed("xtream")),
            personal
        );
        if (personal) {
            assert.equal(sourceRequests, 0);
            const media = await page.evaluate(async () => {
                function load(target) {
                    return new Promise((resolve) =>
                        window.getMediaArray(target, () =>
                            resolve(window.mediaRecords)
                        )
                    );
                }
                const movies = await load({ kind: "vod" });
                const series = await load({ kind: "series" });
                const episodes = await load(series[0].playlist_url);
                return {
                    episode: episodes[0].stream_url,
                    movie: movies[0].stream_url,
                };
            });
            assert(
                media.movie.endsWith("/movie/fixture-user/fixture-pass/43.mp4")
            );
            assert(
                media.episode.endsWith(
                    "/series/fixture-user/fixture-pass/81.mp4"
                )
            );

            assert.equal(
                await page.evaluate(
                    () =>
                        JSON.stringify(localStorage).includes("fixture-pass") ||
                        JSON.stringify(sessionStorage).includes("fixture-pass")
                ),
                false
            );
        }
        assert.equal(
            await page.evaluate(() => window.ott_device),
            platform === "lg" ? "lg/webos" : "samsung/tizen"
        );
        await page.evaluate(() =>
            document.dispatchEvent(
                new KeyboardEvent("keydown", { bubbles: true, keyCode: 406 })
            )
        );
        await page.locator("#starlink-logout").waitFor({ state: "visible" });
        await Promise.all([
            page.waitForNavigation({ waitUntil: "domcontentloaded" }),
            page.locator("#starlink-logout").click(),
        ]);
        await page.locator("#starlink-login").waitFor({ state: "visible" });
        assert.equal(
            await page.evaluate(() => window.__starlinkTv.admitted()),
            false
        );
        assert.equal(
            await page.evaluate(() => localStorage.getItem("m3um3uArr")),
            null
        );
        assert.equal(
            errors.length,
            0,
            "Built player page errors: " + errors.join("; ")
        );
        assert.equal(
            unexpected.length,
            0,
            "Unexpected remote requests: " + unexpected.join("; ")
        );
        console.log(
            "PASS built " +
                platform +
                (personal
                    ? ": login → original Xtream live/movie/episodes → logout; "
                    : ": empty login → waiting → assigned M3U → logout; ") +
                directory
        );
    } finally {
        if (browser) await browser.close();
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
    }
}
(async () => {
    await run("samsung");
    await run("lg");
    await run("samsung", "account");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
