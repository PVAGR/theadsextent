/**
 * @file stream-status.js
 * @description Netlify Function: Twitch live/offline status proxy for the Universal Embed Engine.
 *
 * Security / compliance:
 * - Uses server-side environment variables for Twitch credentials.
 * - Does NOT expose access tokens or secrets to the client.
 * - Only returns minimal, non-identifying status data.
 */

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const TWITCH_STREAMS_URL = "https://api.twitch.tv/helix/streams";

/**
 * Fetch an app access token using the Client Credentials flow.
 * Token is not cached here; Netlify's short-lived instances will naturally limit reuse.
 *
 * @returns {Promise<string>}
 */
async function getAppAccessToken() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET environment variables.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials"
  });

  const response = await fetch(TWITCH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  if (!response.ok) {
    throw new Error(`Failed to obtain Twitch token (status: ${response.status})`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("Twitch token response missing access_token.");
  }

  return data.access_token;
}

/**
 * Query Twitch to determine if a channel is live.
 *
 * @param {string} channelLogin
 * @returns {Promise<boolean>}
 */
async function isChannelLive(channelLogin) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) {
    throw new Error("Missing TWITCH_CLIENT_ID environment variable.");
  }

  const accessToken = await getAppAccessToken();

  const url = new URL(TWITCH_STREAMS_URL);
  url.searchParams.set("user_login", channelLogin);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Twitch streams endpoint error (status: ${response.status})`);
  }

  const data = await response.json();
  return Array.isArray(data.data) && data.data.length > 0;
}

/**
 * Netlify function handler.
 */
exports.handler = async function handler(event) {
  // Basic CORS to allow use as a public embed endpoint.
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ""
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  const params = event.queryStringParameters || {};
  const channel = params.channel || process.env.TWITCH_CHANNEL || "ricktaur";

  try {
    const live = await isChannelLive(channel);
    const payload = {
      live,
      channel,
      lastCheckedAt: new Date().toISOString()
    };

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    };
  } catch (error) {
    console.error("stream-status error:", error);
    return {
      statusCode: 502,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        error: "Failed to resolve Twitch status."
      })
    };
  }
};

