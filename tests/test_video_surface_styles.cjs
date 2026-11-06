// Keep the compact video surface equivalent to the previous DOM and CSS.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { JSDOM } = require("jsdom");
const baseline =
    '<div id="vdiv" style="position: absolute; overflow: hidden; background-color: black; display: flex; align-items: center; justify-content: center;"><video id="video" playsinline style="object-fit: contain; object-position: center center; max-width: 100%; max-height: 100%;"></video></div><video id="videopip" playsinline muted style="position: absolute; display: none; background-color: black; object-fit: cover; object-position: center center;"></video>';
const file = path.join(__dirname, "../src/core/index.ts");
const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true
);
const matches = [];
function visit(node) {
    if (
        ts.isStringLiteral(node) &&
        node.text.startsWith('<div id="vdiv" style=')
    )
        matches.push(node.text);
    ts.forEachChild(node, visit);
}
visit(source);
assert.equal(matches.length, 1);
const windows = [];
function snapshot(html) {
    const dom = new JSDOM(html);
    windows.push(dom.window);
    return [...dom.window.document.body.querySelectorAll("*")].map((el) => ({
        tag: el.tagName,
        parent: el.parentElement.id,
        attributes: [...el.attributes].map((a) => [
            a.name,
            a.name === "style" ? el.style.cssText : a.value,
        ]),
    }));
}
try {
    assert.deepEqual(snapshot(matches[0]), snapshot(baseline));
    assert.ok(
        Buffer.byteLength(matches[0]) <= Buffer.byteLength(baseline) - 22
    );
    console.log(
        "PASS compact video surface: identical DOM, attributes and CSS; reduced bytes"
    );
} finally {
    windows.forEach((window) => window.close());
}
