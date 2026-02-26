/**
 * server.js – PVA Bazaar Local Dev Server
 *
 * Zero external dependencies. Pure Node.js built-ins only.
 * Serves all embed pages + mocks every Netlify Function locally
 * so you can run and test everything without deploying.
 *
 * Usage:
 *   node server.js          → starts on http://localhost:8888
 *   node server.js --port=3000
 *   node server.js --open   → also opens browser automatically
 */

"use strict";

const http    = require("http");
const fs      = require("fs");
const path    = require("path");
const url     = require("url");
const os      = require("os");
const { execSync, exec } = require("child_process");

// ─── Config ──────────────────────────────────────────────────────────────────

const ARGS      = process.argv.slice(2);
const PORT      = Number(getArg("--port") || 8888);
const AUTO_OPEN = ARGS.includes("--open") || ARGS.includes("-o");
const STATIC_DIR = path.join(__dirname, "Extensionadmoney");
const DATA_DIR   = path.join(__dirname, ".dev-data");

// Load .env if present
loadDotEnv(path.join(__dirname, ".env"));

const CHANNEL = process.env.TWITCH_CHANNEL || "ricktaur";

// ─── Dev state (in-memory, backed to .dev-data/) ────────────────────────────

let mockLive = false; // toggle with POST /dev/toggle-live

const revenueFile = path.join(DATA_DIR, "revenue.json");
const eventsFile  = path.join(DATA_DIR, "events.log");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readRevenue() {
  ensureDataDir();
  try { return JSON.parse(fs.readFileSync(revenueFile, "utf8")); }
  catch { return defaultRevenue(); }
}

function writeRevenue(data) {
  ensureDataDir();
  fs.writeFileSync(revenueFile, JSON.stringify(data, null, 2));
}

function appendEvent(payload) {
  ensureDataDir();
  const line = JSON.stringify({ ...payload, receivedAt: new Date().toISOString() }) + "\n";
  fs.appendFileSync(eventsFile, line);
}

function defaultRevenue() {
  return {
    embedLoads: 0, affiliateClicks: 0, donationInitiations: 0,
    sponsorClicks: 0, vodPlays: 0,
    affiliateByProduct: {}, donationsByProvider: {},
    lastUpdated: null,
  };
}

// ─── MIME types ──────────────────────────────────────────────────────────────

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml":  "application/xml; charset=utf-8",
  ".txt":  "text/plain; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function json(res, status, data) {
  res.writeHead(status, { ...CORS, "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      try { resolve(JSON.parse(raw)); }
      catch { resolve({}); }
    });
  });
}

function getArg(name) {
  const entry = ARGS.find((a) => a.startsWith(name + "="));
  return entry ? entry.split("=")[1] : null;
}

function loadDotEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx < 0) return;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  });
}

function openBrowser(url) {
  const platform = os.platform();
  try {
    if (platform === "win32") exec(`start "" "${url}"`);
    else if (platform === "darwin") exec(`open "${url}"`);
    else exec(`xdg-open "${url}"`);
  } catch { /* ignore */ }
}

// ─── Function handlers (mock Netlify Functions) ──────────────────────────────

async function handleStreamStatus(req, res) {
  // Check ?channel= param
  const parsed  = url.parse(req.url, true);
  const channel = parsed.query.channel || CHANNEL;

  // If TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET are set, hit the real API.
  // Otherwise return mock state.
  const clientId     = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (clientId && clientSecret) {
    try {
      // Get app access token
      const tokenRes = await httpPost(
        "https://id.twitch.tv/oauth2/token",
        `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
        "application/x-www-form-urlencoded"
      );
      const tokenData = JSON.parse(tokenRes);
      const token = tokenData.access_token;

      // Query Helix
      const streamRes = await httpGet(
        `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`,
        { "Client-ID": clientId, "Authorization": `Bearer ${token}` }
      );
      const streamData = JSON.parse(streamRes);
      const isLive = Array.isArray(streamData.data) && streamData.data.length > 0;

      return json(res, 200, { live: isLive, channel, lastCheckedAt: new Date().toISOString(), source: "twitch_api" });
    } catch (err) {
      console.warn("  ⚠  Twitch API error – using mock state:", err.message);
    }
  }

  // Fallback: return mock live state (toggle with /dev/toggle-live)
  json(res, 200, { live: mockLive, channel, lastCheckedAt: new Date().toISOString(), source: "mock" });
}

async function handleLog(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});

  const body = await readBody(req);
  if (!body.event || !body.timestamp) return json(res, 400, { error: "Invalid payload" });

  console.log(`  📊 Event: ${body.event}`, body.properties || "");
  appendEvent(body);

  // Also update revenue counters
  const rev = readRevenue();
  rev.lastUpdated = new Date().toISOString();
  switch (body.event) {
    case "embed_loaded":       rev.embedLoads = (rev.embedLoads || 0) + 1; break;
    case "affiliate_click":    rev.affiliateClicks = (rev.affiliateClicks || 0) + 1;
      if (body.properties?.productId) rev.affiliateByProduct[body.properties.productId] = (rev.affiliateByProduct[body.properties.productId] || 0) + 1;
      break;
    case "donation_initiated": rev.donationInitiations = (rev.donationInitiations || 0) + 1;
      if (body.properties?.providerId) rev.donationsByProvider[body.properties.providerId] = (rev.donationsByProvider[body.properties.providerId] || 0) + 1;
      break;
    case "sponsor_click": rev.sponsorClicks = (rev.sponsorClicks || 0) + 1; break;
    case "vod_played":    rev.vodPlays = (rev.vodPlays || 0) + 1; break;
  }
  writeRevenue(rev);

  json(res, 202, { received: true });
}

async function handleRevenue(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});

  if (req.method === "GET") {
    return json(res, 200, readRevenue());
  }

  if (req.method === "POST") {
    const body = await readBody(req);
    if (!body.event) return json(res, 400, { error: "Missing event" });
    const rev = readRevenue();
    rev.lastUpdated = new Date().toISOString();
    switch (body.event) {
      case "embed_loaded":       rev.embedLoads = (rev.embedLoads || 0) + 1; break;
      case "affiliate_click":    rev.affiliateClicks = (rev.affiliateClicks || 0) + 1; break;
      case "donation_initiated": rev.donationInitiations = (rev.donationInitiations || 0) + 1; break;
      case "sponsor_click":      rev.sponsorClicks = (rev.sponsorClicks || 0) + 1; break;
      case "vod_played":         rev.vodPlays = (rev.vodPlays || 0) + 1; break;
    }
    writeRevenue(rev);
    return json(res, 202, { accepted: true });
  }

  json(res, 405, { error: "Method Not Allowed" });
}

async function handleNotify(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method !== "POST") return json(res, 405, { error: "Method Not Allowed" });

  const body    = await readBody(req);
  const secret  = process.env.NOTIFY_SECRET;
  if (secret && body.secret !== secret) return json(res, 401, { error: "Unauthorized" });

  const channel  = CHANNEL;
  const siteUrl  = `http://localhost:${PORT}`;
  const liveUrl  = `${siteUrl}/live-now.html`;

  console.log("\n  🚀 GO-LIVE triggered!");
  console.log(`     Channel : ${channel}`);
  console.log(`     Title   : ${body.title || "(no title)"}`);
  console.log(`     Game    : ${body.game  || "(no game)"}`);
  console.log(`     Live URL: ${liveUrl}`);

  // Toggle mock live state
  mockLive = true;
  console.log("     Mock live state → LIVE ✓\n");

  // Discord webhook (real)
  const results = [];
  const discordUrl = process.env.DISCORD_WEBHOOK_URL;
  if (discordUrl) {
    try {
      const payload = JSON.stringify({
        username: `${channel} Stream Bot`,
        content: `@everyone 🔴 **${channel} is LIVE!**`,
        embeds: [{
          title: `${channel} is live on Twitch!`,
          url: `https://www.twitch.tv/${channel}`,
          color: 0x9146ff,
          description: body.title ? `🎮 **${body.title}**\n\nJoin the stream now!` : "Join the stream now!",
          fields: [
            { name: "Watch Live", value: `[Twitch](https://www.twitch.tv/${channel})`, inline: true },
            { name: "Embed Page", value: `[Live Now](${liveUrl})`, inline: true },
          ],
          timestamp: new Date().toISOString(),
        }],
      });
      const discordRes = await httpPostJson(discordUrl, payload);
      results.push({ destination: "discord", status: "sent" });
      console.log("  ✓ Discord notification sent.");
    } catch (err) {
      results.push({ destination: "discord", status: "error", message: err.message });
      console.warn("  ✗ Discord error:", err.message);
    }
  } else {
    results.push({ destination: "discord", status: "skipped", reason: "DISCORD_WEBHOOK_URL not set in .env" });
    console.log("  ○ Discord skipped (DISCORD_WEBHOOK_URL not set).");
  }

  json(res, 200, { fired: true, channel, liveUrl, notifications: results, firedAt: new Date().toISOString() });
}

// ─── Dev-only routes ─────────────────────────────────────────────────────────

function handleDev(pathname, req, res) {
  // GET/POST /dev/toggle-live – flip the mock live state
  if (pathname === "/dev/toggle-live") {
    mockLive = !mockLive;
    console.log(`  🎮 Mock live state toggled → ${mockLive ? "LIVE 🔴" : "OFFLINE ⚫"}`);
    return json(res, 200, { live: mockLive, message: `Mock state is now ${mockLive ? "LIVE" : "OFFLINE"}` });
  }

  // GET /dev/status – dump current dev state
  if (pathname === "/dev/status") {
    return json(res, 200, {
      mockLive,
      revenue: readRevenue(),
      port: PORT,
      channel: CHANNEL,
      env: {
        TWITCH_CLIENT_ID:  process.env.TWITCH_CLIENT_ID  ? "set" : "not set",
        TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET ? "set" : "not set",
        DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL ? "set" : "not set",
        NOTIFY_SECRET: process.env.NOTIFY_SECRET ? "set" : "not set",
      },
    });
  }

  // GET /dev/reset-revenue – zero out local revenue counters
  if (pathname === "/dev/reset-revenue") {
    writeRevenue(defaultRevenue());
    console.log("  🗑  Revenue counters reset.");
    return json(res, 200, { reset: true });
  }

  json(res, 404, { error: "Unknown dev route" });
}

// ─── Static file handler ─────────────────────────────────────────────────────

function serveStatic(req, res) {
  let pathname = url.parse(req.url).pathname;

  // Strip trailing slash and serve index.html
  if (pathname.endsWith("/") || pathname === "") pathname = "/index.html";

  // Map short Netlify-style routes
  const ROUTE_MAP = {
    "/embed":           "/index.html",
    "/embed/stream-chat": "/stream-chat.html",
    "/embed/chat":      "/chat-embed.html",
    "/embed/vod":       "/vod-embed.html",
    "/embed/schedule":  "/schedule-embed.html",
    "/admin":           "/admin.html",
    "/live":            "/live-now.html",
    "/live-now":        "/live-now.html",
    "/go-live":         "/go-live.html",
    "/widget":          "/widget-embed.html",
  };
  if (ROUTE_MAP[pathname]) pathname = ROUTE_MAP[pathname];
  // /widget/card → /widget-embed.html?style=card (served as same file)
  if (pathname.startsWith("/widget/")) pathname = "/widget-embed.html";

  const filePath = path.join(STATIC_DIR, pathname);

  // Security: prevent path traversal
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // Try with .html extension
      const htmlPath = filePath.endsWith(".html") ? null : filePath + ".html";
      if (htmlPath) {
        fs.stat(htmlPath, (e2, s2) => {
          if (!e2 && s2.isFile()) return sendFile(res, htmlPath);
          res.writeHead(404, { "Content-Type": "text/html" });
          res.end(`<h2>404 – Not found: ${pathname}</h2><p><a href="/">← Home</a></p>`);
        });
        return;
      }
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end(`<h2>404 – Not found: ${pathname}</h2><p><a href="/">← Home</a></p>`);
      return;
    }
    sendFile(res, filePath);
  });
}

function sendFile(res, filePath) {
  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(500); res.end("Server error"); return; }
    res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-cache" });
    res.end(data);
  });
}

// ─── HTTP helpers (no external deps) ─────────────────────────────────────────

function httpGet(reqUrl, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new url.URL(reqUrl);
    const mod   = parsed.protocol === "https:" ? require("https") : require("http");
    const opts  = { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search, method: "GET", headers };
    const req   = mod.request(opts, (r) => { let d = ""; r.on("data", (c) => d += c); r.on("end", () => resolve(d)); });
    req.on("error", reject);
    req.end();
  });
}

function httpPost(reqUrl, body, contentType) {
  return new Promise((resolve, reject) => {
    const parsed = new url.URL(reqUrl);
    const mod   = parsed.protocol === "https:" ? require("https") : require("http");
    const buf   = Buffer.from(body);
    const opts  = { hostname: parsed.hostname, port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search, method: "POST",
      headers: { "Content-Type": contentType, "Content-Length": buf.length } };
    const req   = mod.request(opts, (r) => { let d = ""; r.on("data", (c) => d += c); r.on("end", () => resolve(d)); });
    req.on("error", reject);
    req.write(buf); req.end();
  });
}

function httpPostJson(reqUrl, body) { return httpPost(reqUrl, body, "application/json"); }

// ─── Main request router ─────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS); res.end(); return;
  }

  // Netlify Functions routing
  if (pathname === "/.netlify/functions/stream-status") return handleStreamStatus(req, res).catch((e) => json(res, 500, { error: e.message }));
  if (pathname === "/.netlify/functions/log")           return handleLog(req, res).catch((e) => json(res, 500, { error: e.message }));
  if (pathname === "/.netlify/functions/revenue")       return handleRevenue(req, res).catch((e) => json(res, 500, { error: e.message }));
  if (pathname === "/.netlify/functions/notify")        return handleNotify(req, res).catch((e) => json(res, 500, { error: e.message }));

  // Dev-only helpers
  if (pathname.startsWith("/dev/")) return handleDev(pathname, req, res);

  // Static files
  serveStatic(req, res);
});

// ─── Start ───────────────────────────────────────────────────────────────────

server.listen(PORT, "127.0.0.1", () => {
  const base = `http://localhost:${PORT}`;

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║        PVA Bazaar Stream Embed – Local Dev Server         ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  console.log(`  Channel  : ${CHANNEL}`);
  console.log(`  Server   : ${base}\n`);
  console.log("  ── Embed Pages ──────────────────────────────────────────────");
  console.log(`  🎮 Stream Embed   : ${base}/`);
  console.log(`  💬 Stream + Chat  : ${base}/stream-chat.html`);
  console.log(`  🔴 Live Now       : ${base}/live`);
  console.log(`  📅 Schedule       : ${base}/embed/schedule`);
  console.log(`  🎞  VOD Embed      : ${base}/embed/vod`);
  console.log(`  💬 Chat Only      : ${base}/embed/chat`);
  console.log(`  🔲 Widget (badge) : ${base}/widget`);
  console.log(`  🔲 Widget (card)  : ${base}/widget/card`);
  console.log(`  🔲 Widget (banner): ${base}/widget/banner`);
  console.log("\n  ── Owner Tools ──────────────────────────────────────────────");
  console.log(`  🚀 Go-Live Panel  : ${base}/go-live`);
  console.log(`  📊 Admin Dashboard: ${base}/admin`);
  console.log("\n  ── Dev Tools ────────────────────────────────────────────────");
  console.log(`  🔁 Toggle LIVE    : ${base}/dev/toggle-live  (GET/POST)`);
  console.log(`  📈 Dev Status     : ${base}/dev/status`);
  console.log(`  🗑  Reset Revenue  : ${base}/dev/reset-revenue`);
  console.log("\n  ── Netlify Functions (mocked locally) ───────────────────────");
  console.log(`  /.netlify/functions/stream-status`);
  console.log(`  /.netlify/functions/log`);
  console.log(`  /.netlify/functions/revenue`);
  console.log(`  /.netlify/functions/notify`);

  const dotenvExists = fs.existsSync(path.join(__dirname, ".env"));
  if (!dotenvExists) {
    console.log("\n  ⚠  No .env file found. Copy .env.example to .env and fill in your keys.");
    console.log("     (Discord notifications and live Twitch status need real keys)");
  }

  console.log(`\n  Mock live state : ${mockLive ? "LIVE 🔴" : "OFFLINE ⚫"}  (toggle at /dev/toggle-live)`);
  console.log("\n  Press Ctrl+C to stop.\n");

  if (AUTO_OPEN) {
    setTimeout(() => openBrowser(`${base}/go-live.html`), 500);
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n  ✗ Port ${PORT} is already in use. Try: node server.js --port=3000\n`);
  } else {
    console.error("\n  ✗ Server error:", err.message);
  }
  process.exit(1);
});
