#!/usr/bin/env node
/* Build an empty, managed STARLINK TV preview from the current FOSS web build. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
function stage(platform, apiBase) {
    if (!["samsung", "lg"].includes(platform))
        throw new Error("Choose samsung or lg");
    const api = new URL(apiBase);
    if (
        api.protocol !== "https:" ||
        api.username ||
        api.password ||
        api.search ||
        api.hash ||
        api.pathname !== "/"
    )
        throw new Error(
            "Use an HTTPS API origin without credentials, path, query or fragment"
        );
    const source = path.join(root, "dist");
    for (const file of ["index.html", "player.js", "provider-m3u.js"])
        if (!fs.existsSync(path.join(source, file)))
            throw new Error("Run npm run build first: missing " + file);
    // New output each time. Never overwrite a previous candidate or official package.
    const parent = path.join(root, "build", "starlink-tv");
    fs.mkdirSync(parent, { recursive: true });
    const out = fs.mkdtempSync(path.join(parent, platform + "-"));
    fs.mkdirSync(path.join(out, "dist"));
    for (const name of fs.readdirSync(source)) {
        if (
            name === "index.html" ||
            name === "dist-mobile" ||
            name === "offline-worker.js"
        )
            continue;
        if (/^provider-.*\.js$/.test(name) && name !== "provider-m3u.js")
            continue;
        const absolute = path.join(source, name);
        if (fs.lstatSync(absolute).isSymbolicLink())
            throw new Error("Unexpected build symlink");
        // Provider bundles keep the classic /dist/ ABI; other assets live at the package root.
        const dest = /^(player|provider-.+)\.js$/.test(name)
            ? path.join(out, "dist", name)
            : path.join(out, name);
        fs.cpSync(absolute, dest, { recursive: true });
    }
    fs.mkdirSync(path.join(out, "starlink"));
    for (const name of [
        "controller.js",
        "bootstrap.js",
        "theme.css",
        "logo.png",
    ])
        fs.copyFileSync(
            path.join(root, "starlink/tv", name),
            path.join(out, "starlink", name)
        );
    const config = {
        apiBase: api.origin,
        contentBundled: false,
        platform,
        version: "0.1.0-preview",
    };
    const configScript =
        "window.STARLINK_TV_CONFIG=" + JSON.stringify(config) + ";\n";
    fs.writeFileSync(path.join(out, "starlink/config.js"), configScript);
    let html = fs.readFileSync(path.join(source, "index.html"), "utf8");
    html = html.replace(
        /<title>[^<]*<\/title>/,
        "<title>STARLINK IPTV</title>"
    );
    html = html.replace(
        "</head>",
        '<link rel="stylesheet" href="./starlink/theme.css">\n' +
            '<script src="./starlink/config.js"></script>\n<script src="./starlink/controller.js"></script>\n' +
            '<script src="./starlink/bootstrap.js"></script>\n</head>'
    );
    html = html.replace(/(src|href)="\//g, '$1="./');
    const hostPattern =
        /var host = window\.location\.origin \|\|\s*\(window\.location\.host \? window\.location\.protocol \+ "\/\/" \+ window\.location\.host : "http:\/\/localhost:8080"\);/;
    if (!hostPattern.test(html))
        throw new Error(
            "Upstream host bootstrap changed; inspect before staging"
        );
    html = html.replace(hostPattern, "var host = window.__starlinkTvRoot;");
    html = html.replace(
        "var ott_device = detectDevice();",
        'var ott_device = window.STARLINK_TV_CONFIG.platform === "samsung" ? "samsung/tizen" : "lg/webos";'
    );
    fs.writeFileSync(path.join(out, "index.html"), html);
    // Use a preview identity, so installation never replaces an existing STARLINK app.
    fs.copyFileSync(
        path.join(root, "starlink/tv/logo.png"),
        path.join(out, "icon.png")
    );
    fs.copyFileSync(
        path.join(root, "starlink/tv/logo.png"),
        path.join(out, "images/player-logo.png")
    );
    if (platform === "lg") {
        fs.writeFileSync(
            path.join(out, "appinfo.json"),
            JSON.stringify(
                {
                    appDescription:
                        "Player sem conteúdo pré-instalado. Catálogo atribuído remotamente após login.",
                    disableBackHistoryAPI: true,
                    icon: "icon.png",
                    id: "com.starlink.iptv.tv.preview",
                    main: "index.html",
                    resolution: "1920x1080",
                    title: "STARLINK IPTV Prévia",
                    type: "web",
                    vendor: "STARLINK",
                    version: "0.1.0",
                },
                null,
                2
            )
        );
    } else {
        fs.writeFileSync(
            path.join(out, "config.xml"),
            '<?xml version="1.0" encoding="UTF-8"?>\n' +
                '<widget xmlns="http://www.w3.org/ns/widgets" xmlns:tizen="http://tizen.org/ns/widgets" id="https://starlink.local/tv/preview" version="0.1.0" viewmodes="maximized">\n' +
                '<tizen:application id="STLTVP0010.StarlinkTV" package="STLTVP0010" required_version="5.5"/>\n' +
                '<content src="index.html"/><name>STARLINK IPTV Prévia</name><icon src="icon.png"/>\n' +
                '<tizen:profile name="tv-samsung"/><feature name="http://tizen.org/feature/screen.size.all"/>\n' +
                '<tizen:privilege name="http://tizen.org/privilege/internet"/><tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"/>\n' +
                '<tizen:setting screen-orientation="landscape" context-menu="disable" background-support="disable" hwkey-event="enable"/>\n' +
                '<access origin="*" subdomains="true"/>\n' +
                "<tizen:content-security-policy>default-src 'self'; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: http: https:; connect-src http: https:; media-src http: https: blob:; worker-src 'self' blob:; object-src 'self'; frame-src 'none'</tizen:content-security-policy>\n</widget>\n"
        );
    }
    for (const name of ["LICENSE", "THIRD-PARTY-NOTICES.md"])
        fs.copyFileSync(path.join(root, name), path.join(out, name));
    const hashes = {};
    function walk(dir, prefix = "") {
        for (const name of fs.readdirSync(dir).sort()) {
            const file = path.join(dir, name),
                key = prefix + name;
            if (fs.statSync(file).isDirectory()) walk(file, key + "/");
            else
                hashes[key] = crypto
                    .createHash("sha256")
                    .update(fs.readFileSync(file))
                    .digest("hex");
        }
    }
    walk(out);
    fs.writeFileSync(
        path.join(out, "starlink-build.json"),
        JSON.stringify(
            {
                ...config,
                hardwareValidated: false,
                hashes,
                signed: false,
                sourceDirty:
                    execFileSync("git", ["status", "--porcelain"], {
                        cwd: root,
                        encoding: "utf8",
                    }).trim().length > 0,
                sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], {
                    cwd: root,
                    encoding: "utf8",
                }).trim(),
            },
            null,
            2
        )
    );
    return out;
}
module.exports = { stage };
if (require.main === module) {
    try {
        console.log(
            stage(
                process.argv[2],
                process.argv[3] || "https://panel.taila5c5c2.ts.net"
            )
        );
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
