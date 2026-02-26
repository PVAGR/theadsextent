/**
 * ping.js – Live ping endpoint
 *
 * Called by the GO LIVE button the moment you go live.
 * Stores a timestamp so all embedded widgets know to refresh instantly
 * instead of waiting for their 90-second poll cycle.
 *
 * POST /.netlify/functions/ping  { secret: "..." }
 * GET  /.netlify/functions/ping  → { pingedAt: ISO, live: true }
 */

"use strict";

exports.handler = async (event) => {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  const secret = process.env.NOTIFY_SECRET;

  // ── POST: record a new go-live ping ──────────────────────────────────────
  if (event.httpMethod === "POST") {
    let body = {};
    try { body = JSON.parse(event.body || "{}"); } catch {}

    if (secret && body.secret !== secret) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
    }

    const pingedAt = new Date().toISOString();

    // Try to persist via Netlify Blobs; fall back gracefully
    try {
      const { getStore } = await import("@netlify/blobs");
      const store = getStore("pva-bazaar-ping");
      await store.setJSON("latest", { pingedAt, live: true });
    } catch { /* Blobs not available locally – no-op */ }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ pinged: true, pingedAt }),
    };
  }

  // ── GET: return most recent ping timestamp ────────────────────────────────
  let pingedAt = null;
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("pva-bazaar-ping");
    const data  = await store.get("latest", { type: "json" });
    if (data?.pingedAt) pingedAt = data.pingedAt;
  } catch { /* Blobs not available */ }

  return {
    statusCode: 200,
    headers: { ...CORS, "Cache-Control": "no-store" },
    body: JSON.stringify({ pingedAt, live: !!pingedAt }),
  };
};
