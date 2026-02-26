/**
 * stream-status.js – Twitch live/offline status proxy
 *
 * Credentials priority:
 *   1. Netlify env vars (TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET)
 *   2. Netlify Blobs config saved via the /setup page
 *
 * This means you can configure everything from the /setup page without
 * touching Netlify dashboard environment variables.
 */

"use strict";

const TWITCH_TOKEN_URL   = "https://id.twitch.tv/oauth2/token";
const TWITCH_STREAMS_URL = "https://api.twitch.tv/helix/streams";
const BLOB_STORE         = "pva-bazaar-config";
const BLOB_KEY           = "twitch-config";

// In-memory token cache — avoids fetching a new token on every poll cycle
let _tokenCache = null; // { token: string, clientId: string, expiresAt: number }

/**
 * Returns { clientId, clientSecret } from env vars or Netlify Blobs.
 * Throws "TWITCH_CREDENTIALS_MISSING" if neither source has credentials.
 */
async function getCredentials() {
  // 1. Prefer Netlify dashboard env vars
  const envId     = process.env.TWITCH_CLIENT_ID;
  const envSecret = process.env.TWITCH_CLIENT_SECRET;
  if (envId && envSecret) return { clientId: envId, clientSecret: envSecret };

  // 2. Fall back to Blobs-stored config (set via /setup)
  try {
    const { getStore } = await import("@netlify/blobs");
    const store  = getStore(BLOB_STORE);
    const config = await store.get(BLOB_KEY, { type: "json" });
    if (config?.clientId && config?.clientSecret) {
      return { clientId: config.clientId, clientSecret: config.clientSecret };
    }
  } catch { /* Blobs unavailable locally */ }

  throw new Error("TWITCH_CREDENTIALS_MISSING");
}

/**
 * Returns a valid app access token, using the in-memory cache when possible.
 */
async function getAppAccessToken() {
  // Check cache first (keyed by clientId so rotated creds invalidate it)
  const creds = await getCredentials();

  if (_tokenCache && Date.now() < _tokenCache.expiresAt && _tokenCache.clientId === creds.clientId) {
    return { token: _tokenCache.token, clientId: creds.clientId };
  }

  const params = new URLSearchParams({
    client_id:     creds.clientId,
    client_secret: creds.clientSecret,
    grant_type:    "client_credentials",
  });

  const response = await fetch(TWITCH_TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    params.toString(),
  });

  if (!response.ok) throw new Error(`Failed to obtain Twitch token (${response.status})`);

  const data = await response.json();
  if (!data.access_token) throw new Error("Twitch token response missing access_token.");

  // Cache for 55 min (tokens live 60 min; 5-min buffer)
  _tokenCache = { token: data.access_token, clientId: creds.clientId, expiresAt: Date.now() + 55 * 60 * 1000 };
  return { token: _tokenCache.token, clientId: creds.clientId };
}

async function isChannelLive(channelLogin) {
  const { token, clientId } = await getAppAccessToken();

  const url = new URL(TWITCH_STREAMS_URL);
  url.searchParams.set("user_login", channelLogin);

  const response = await fetch(url.toString(), {
    headers: { "Client-ID": clientId, Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error(`Twitch streams endpoint error (${response.status})`);

  const data = await response.json();
  return Array.isArray(data.data) && data.data.length > 0;
}

exports.handler = async function handler(event) {
  const corsHeaders = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const params  = event.queryStringParameters || {};
  const channel = params.channel || process.env.TWITCH_CHANNEL || "ricktaur";

  try {
    const live = await isChannelLive(channel);
    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ live, channel, lastCheckedAt: new Date().toISOString() }),
    };
  } catch (error) {
    console.error("stream-status error:", error.message);

    if (error.message === "TWITCH_CREDENTIALS_MISSING") {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ live: false, channel, unconfigured: true, lastCheckedAt: new Date().toISOString() }),
      };
    }

    return {
      statusCode: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to resolve Twitch status." }),
    };
  }
};
