/* =============================================================================
   ci/check.js — does this site actually work when it is nothing but files?

   GitHub Pages is a static host with no build step, a case-sensitive
   filesystem, and no tolerance for a path that only resolved because your
   laptop's filesystem was not fussy. So this serves the repository exactly the
   way Pages will, over plain HTTP, and drives the real page in a real browser.

   Run it with `node ci/check.js`; it needs playwright on NODE_PATH, which the
   workflow installs. Nothing here ships — Pages only ever serves the files in
   the repository root.
============================================================================= */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const PORT = 8123;
const BASE = "http://127.0.0.1:" + PORT;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

const failures = [];
function check(ok, what) {
  if (!ok) failures.push(what);
  console.log((ok ? "  ok   " : "  FAIL ") + what);
}

/* A deliberately literal static server: no directory listings, no extension
   guessing, no case folding. If it 404s here it will 404 on Pages. */
function serve() {
  return new Promise(function (resolve) {
    const server = http.createServer(function (req, res) {
      let rel = decodeURIComponent(req.url.split("?")[0]);
      if (rel.endsWith("/")) rel += "index.html";
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404).end("not found");
        return;
      }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(fs.readFileSync(file));
    });
    server.listen(PORT, "127.0.0.1", function () { resolve(server); });
  });
}

/* Every path the site asks for, pulled out of the source rather than listed
   here, so a new import cannot quietly go unchecked. */
function referencedPaths() {
  const out = new Set(["/index.html"]);
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  for (const m of html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)) out.add(m[1].slice(1));
  for (const name of fs.readdirSync(ROOT)) {
    if (!name.endsWith(".js")) continue;
    const js = fs.readFileSync(path.join(ROOT, name), "utf8");
    for (const m of js.matchAll(/from\s+"(\.\/[^"]+)"/g)) out.add(m[1].slice(1));
  }
  return [...out];
}

async function get(url) {
  return new Promise(function (resolve) {
    http.get(url, function (res) { res.resume(); resolve(res.statusCode); })
        .on("error", function () { resolve(0); });
  });
}

async function run(page, vp, label) {
  const errors = [];
  page.on("pageerror", function (e) { errors.push("pageerror: " + e.message); });
  page.on("console", function (m) { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("requestfailed", function (r) { errors.push("request failed: " + r.url()); });

  await page.setViewportSize(vp);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);          // the pour, and a few hundred frames

  check(errors.length === 0, label + ": no errors on load" +
        (errors.length ? " — " + errors.slice(0, 4).join(" | ") : ""));

  const state = await page.evaluate(function () {
    const c = document.getElementById("stage");
    return {
      loaded: document.body.classList.contains("loaded"),
      w: c ? c.width : 0,
      h: c ? c.height : 0,
      counter: document.getElementById("counter").textContent
    };
  });
  // `loaded` is only set after the renderer has drawn a frame, so it is the
  // one flag that proves WebGL came up and the scene was built.
  check(state.loaded, label + ": world rendered a frame");
  check(state.w >= 300 && state.h >= 200,
        label + ": canvas backing store is " + state.w + "x" + state.h);
  check(/^\d+$/.test(state.counter.replace(/,/g, "")),
        label + ": visitor count resolved to a number (" + state.counter + ")");

  // Tapping the middle of the ring must find the hourglass. That exercises the
  // whole chain — geometry built, camera framed, raycast picking real hit
  // boxes — and it is the cheapest proof the scene is not an empty canvas.
  await page.mouse.click(vp.width / 2, vp.height / 2);
  await page.waitForTimeout(1800);
  check(await page.evaluate(function () { return document.body.classList.contains("focused"); }),
        label + ": tapping the centre selects the hourglass");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(1200);
  check(!(await page.evaluate(function () { return document.body.classList.contains("focused"); })),
        label + ": Escape backs out again");
}

(async function () {
  const server = await serve();
  console.log("serving " + ROOT + " on " + BASE + "\n");

  console.log("files the site asks for:");
  for (const p of referencedPaths()) {
    check((await get(BASE + p)) === 200, "200 " + p);
  }

  // Pages runs Jekyll on a branch deploy unless this is here, and Jekyll drops
  // anything beginning with an underscore.
  console.log("\nstatic host assumptions:");
  check(fs.existsSync(path.join(ROOT, ".nojekyll")), ".nojekyll present");
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  check(!/(?:src|href)="\/(?!\/)/.test(html), "no root-absolute asset paths in index.html");
  check(!/file:\/\//.test(html + fs.readFileSync(path.join(ROOT, "world.js"), "utf8")),
        "no file:// paths left in the source");

  // CI installs chromium where playwright expects it; CHROMIUM_PATH is only
  // for running this by hand somewhere with a browser already lying around.
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]
  });
  try {
    console.log("\ndesktop:");
    const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await run(await desk.newPage(), { width: 1440, height: 900 }, "desktop");

    console.log("\nmobile:");
    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true
    });
    await run(await phone.newPage(), { width: 390, height: 844 }, "mobile");
  } finally {
    await browser.close();
    server.close();
  }

  console.log("");
  if (failures.length) {
    console.log(failures.length + " check(s) failed:");
    for (const f of failures) console.log("  - " + f);
    process.exit(1);
  }
  console.log("all checks passed");
})().catch(function (e) {
  console.error("FATAL", e);
  process.exit(1);
});
