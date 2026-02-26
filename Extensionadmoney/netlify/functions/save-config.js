/**
 * save-config.js – Site configuration storage
 *
 * POST /.netlify/functions/save-config
 * Body: {
 *   secret?:      string          // required only if notifySecret was previously set
 *   embed?: {
 *     channel?:       string
 *     offlineMessage?: string
 *   }
 *   monetization?: {
 *     donations?: {
 *       goalLabel?:   string
 *       goalTarget?:  number
 *       goalCurrent?: number
 *       providers?:   [{ id, label, url }]
 *     }
 *   }
 *   schedule?: {
 *     timezone?: string
 *     entries?:  [{ dayOfWeek, hour, minute, title, game }]
 *   }
 * }
 *
 * Saves the supplied fields into Netlify Blobs under "site-config".
 * Shallow-merges with any previously saved values so a partial update
 * doesn't wipe out unrelated settings.
 */

"use strict";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const BLOB_STORE = "pva-bazaar-config";
const CONFIG_KEY = "site-config";
const CREDS_KEY  = "twitch-config";

/** Returns the URL string if it's a valid http(s) URL, otherwise null. */
function safeUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return (u.protocol === "https:" || u.protocol === "http:") ? url : null;
  } catch { return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  // Optional auth: if a notifySecret is stored, require it here too
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore(BLOB_STORE);
    const creds = (await store.get(CREDS_KEY, { type: "json" })) || {};
    const savedSecret = process.env.NOTIFY_SECRET || creds.notifySecret || null;
    if (savedSecret && body.secret !== savedSecret) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
    }

    // Load current site-config so we can merge (partial updates don't wipe data)
    const existing = (await store.get(CONFIG_KEY, { type: "json" })) || {};

    // Build the update – only include keys that were sent
    const update = {};

    if (body.embed) {
      update.embed = { ...(existing.embed || {}), ...body.embed };
      // Keep twitch.channel in sync with embed.channel
      if (body.embed.channel) {
        update.twitch = { ...(existing.twitch || {}), channel: body.embed.channel };
      }
    }

    if (body.monetization) {
      const updatedMon = { ...(existing.monetization || {}) };
      if (body.monetization.donations) {
        const don = { ...(existing.monetization?.donations || {}), ...body.monetization.donations };
        // Sanitize provider URLs – reject non-http(s) schemes
        if (Array.isArray(don.providers)) {
          don.providers = don.providers
            .filter(p => p && typeof p.id === "string")
            .map(p => ({ ...p, url: safeUrl(p.url) || "" }));
        }
        updatedMon.donations = don;
      }
      update.monetization = updatedMon;
    }

    if (body.schedule) {
      update.schedule = {
        ...(existing.schedule || {}),
        ...body.schedule,
      };
    }

    const merged = { ...existing, ...update, savedAt: new Date().toISOString() };
    await store.setJSON(CONFIG_KEY, merged);

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, savedAt: merged.savedAt }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: `Storage failed: ${err.message}` }),
    };
  }
};
