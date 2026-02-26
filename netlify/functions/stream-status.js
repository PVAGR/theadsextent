/**
 * @file netlify/functions/stream-status.js
 * @description Serverless proxy for Twitch stream status checks.
 *              Holds the Twitch Client ID and OAuth token in environment
 *              variables so they are never exposed to the client.
 *
 *              Environment variables required:
 *              - TWITCH_CLIENT_ID   : Your Twitch application client ID.
 *              - TWITCH_CLIENT_SECRET: Your Twitch application client secret.
 *
 * @version 1.0.0
 */

'use strict';

/** @constant {string} Twitch Helix API base URL */
const TWITCH_API_BASE = 'https://api.twitch.tv/helix';

/** @constant {string} Twitch OAuth2 token endpoint */
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';

/**
 * Cached OAuth token to avoid requesting a new one on every invocation.
 * Netlify functions may share state between warm invocations.
 * @type {{ token: string | null, expiresAt: number }}
 */
const _tokenCache = { token: null, expiresAt: 0 };

/**
 * Fetches (or returns cached) an App Access Token from Twitch OAuth2.
 *
 * @returns {Promise<string>} A valid Bearer token.
 * @throws {Error} If credentials are missing or the request fails.
 */
async function _getAccessToken() {
  const clientId     = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set in environment variables.'
    );
  }

  // Return cached token if still valid (with 60-second buffer)
  if (_tokenCache.token && Date.now() < _tokenCache.expiresAt - 60_000) {
    return _tokenCache.token;
  }

  const body = new URLSearchParams({
    client_id:     clientId,
    client_secret: clientSecret,
    grant_type:    'client_credentials',
  });

  const response = await fetch(TWITCH_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Twitch token request failed: HTTP ${response.status}`);
  }

  const data = await response.json();
  _tokenCache.token     = data.access_token;
  _tokenCache.expiresAt = Date.now() + (data.expires_in * 1000);

  return _tokenCache.token;
}

/**
 * Netlify serverless function handler.
 * Accepts GET requests with a `?channel=<login>` query parameter.
 * Returns `{ live: boolean }`.
 *
 * @param {import('@netlify/functions').HandlerEvent}   event
 * @returns {Promise<import('@netlify/functions').HandlerResponse>}
 */
exports.handler = async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const channel = (event.queryStringParameters?.channel || '').trim().toLowerCase();
  if (!channel || !/^[a-z0-9_]{1,25}$/.test(channel)) {
    return { statusCode: 400, body: 'Invalid or missing "channel" parameter.' };
  }

  let token;
  try {
    token = await _getAccessToken();
  } catch (err) {
    console.error('[stream-status] Token error:', err.message);
    return { statusCode: 503, body: 'Twitch credentials not configured.' };
  }

  let streamData;
  try {
    const response = await fetch(
      `${TWITCH_API_BASE}/streams?user_login=${encodeURIComponent(channel)}`,
      {
        headers: {
          'Client-ID':     process.env.TWITCH_CLIENT_ID,
          Authorization:   `Bearer ${token}`,
          Accept:          'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Twitch API returned HTTP ${response.status}`);
    }
    streamData = await response.json();
  } catch (err) {
    console.error('[stream-status] Twitch API error:', err.message);
    return { statusCode: 502, body: 'Upstream Twitch API error.' };
  }

  const isLive = Array.isArray(streamData.data) && streamData.data.length > 0;

  return {
    statusCode: 200,
    headers: {
      'Content-Type':  'application/json',
      'Cache-Control': 'public, max-age=60', // Cache for 60 seconds at CDN
    },
    body: JSON.stringify({ live: isLive }),
  };
};
