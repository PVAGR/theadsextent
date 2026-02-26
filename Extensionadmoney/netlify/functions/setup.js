/**
 * setup.js – One-time configuration endpoint
 *
 * Stores Twitch credentials and optional secrets in Netlify Blobs.
 * All other functions (stream-status, notify) read from here when
 * Netlify env vars are not set.
 *
 * GET  /.netlify/functions/setup          → current config status (no secrets returned)
 * POST /.netlify/functions/setup  { clientId, clientSecret, channel, notifySecret?, discordWebhook? }
 *                                         → validates Twitch creds, saves config, returns { ok, live }
 */

"use strict";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const BLOB_STORE = "pva-bazaar-config";
const BLOB_KEY   = "twitch-config";

async function getBlobStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore(BLOB_STORE);
}

async function validateAndGetToken(clientId, clientSecret) {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });
  const r = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!r.ok) return null;
  const d = await r.json();
  return d.access_token || null;
}

async function checkChannelLive(clientId, token, channel) {
  const r = await fetch(
    `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`,
    { headers: { "Client-ID": clientId, Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) return false;
  const d = await r.json();
  return Array.isArray(d.data) && d.data.length > 0;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  // ── GET: return status (no credentials returned) ─────────────────────────
  if (event.httpMethod === "GET") {
    try {
      const store = await getBlobStore();
      const config = await store.get(BLOB_KEY, { type: "json" });
      if (!config) {
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ configured: false }) };
      }
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          configured: true,
          channel: config.channel,
          hasClientId: !!config.clientId,
          hasClientSecret: !!config.clientSecret,
          hasNotifySecret: !!config.notifySecret,
          hasDiscordWebhook: !!config.discordWebhook,
          savedAt: config.savedAt,
        }),
      };
    } catch {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ configured: false }) };
    }
  }

  // ── POST: validate + save config ─────────────────────────────────────────
  if (event.httpMethod === "POST") {
    let body = {};
    try { body = JSON.parse(event.body || "{}"); } catch {}

    const { clientId, clientSecret, channel } = body;
    if (!clientId || !clientSecret || !channel) {
      return {
        statusCode: 400, headers: CORS,
        body: JSON.stringify({ error: "clientId, clientSecret, and channel are required." }),
      };
    }

    // Validate by getting a token
    const token = await validateAndGetToken(clientId.trim(), clientSecret.trim());
    if (!token) {
      return {
        statusCode: 400, headers: CORS,
        body: JSON.stringify({ error: "Invalid Twitch credentials. Double-check your Client ID and Client Secret." }),
      };
    }

    // Check if channel is currently live
    const live = await checkChannelLive(clientId.trim(), token, channel.trim());

    // Save to Blobs
    try {
      const store = await getBlobStore();
      await store.setJSON(BLOB_KEY, {
        clientId:       clientId.trim(),
        clientSecret:   clientSecret.trim(),
        channel:        channel.trim(),
        notifySecret:   body.notifySecret?.trim()    || null,
        discordWebhook: body.discordWebhook?.trim()  || null,
        savedAt:        new Date().toISOString(),
      });
    } catch (e) {
      return {
        statusCode: 500, headers: CORS,
        body: JSON.stringify({ error: `Saved credentials validated but Blobs storage failed: ${e.message}. Add as Netlify env vars instead.` }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, channel: channel.trim(), live, savedAt: new Date().toISOString() }),
    };
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method Not Allowed" }) };
};
