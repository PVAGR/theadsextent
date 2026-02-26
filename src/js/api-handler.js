/**
 * @file api-handler.js
 * @description Twitch API integration with OAuth2 Client Credentials Flow,
 *              retry logic, and exponential backoff. All API keys are read
 *              from environment variables via a serverless proxy — never
 *              from client-side code.
 * @version 1.0.0
 */

'use strict';

/** @constant {string} Base URL for the serverless proxy that holds secrets */
const API_BASE_URL = '/api';

/** @constant {number} Max retry attempts for failed requests */
const MAX_RETRIES = 3;

/** @constant {number} Initial backoff delay in milliseconds */
const BACKOFF_BASE_MS = 1000;

/**
 * Cached stream status to serve on Twitch API failure (graceful degradation).
 * @type {{ live: boolean | null, updatedAt: number | null }}
 */
const _internalCache = {
  live: null,
  updatedAt: null,
};

/**
 * Sleeps for a given number of milliseconds.
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>}
 */
function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Performs a fetch with exponential backoff on network or 5xx errors.
 *
 * @param {string} url        - URL to fetch.
 * @param {RequestInit} [opts] - Standard fetch options.
 * @param {number} [attempt]   - Current attempt number (used internally).
 * @returns {Promise<Response>}
 * @throws {Error} After MAX_RETRIES unsuccessful attempts.
 */
async function _fetchWithBackoff(url, opts = {}, attempt = 0) {
  try {
    const response = await fetch(url, opts);
    if (response.status >= 500 && attempt < MAX_RETRIES) {
      await _sleep(BACKOFF_BASE_MS * Math.pow(2, attempt));
      return _fetchWithBackoff(url, opts, attempt + 1);
    }
    return response;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await _sleep(BACKOFF_BASE_MS * Math.pow(2, attempt));
      return _fetchWithBackoff(url, opts, attempt + 1);
    }
    throw err;
  }
}

/**
 * Checks whether the configured Twitch channel is currently live by calling
 * the serverless proxy endpoint. The proxy holds the Twitch Client ID and
 * OAuth token so no secrets are exposed to the client.
 *
 * @param {string} channel - Twitch channel login name (e.g. "ricktaur").
 * @returns {Promise<boolean>} Resolves to `true` if live, `false` if offline.
 */
async function checkStreamStatus(channel) {
  try {
    const response = await _fetchWithBackoff(
      `${API_BASE_URL}/stream-status?channel=${encodeURIComponent(channel)}`,
      { headers: { Accept: 'application/json' } }
    );

    if (!response.ok) {
      throw new Error(`Proxy returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const isLive = Boolean(data.live);

    // Update cache on success
    _internalCache.live = isLive;
    _internalCache.updatedAt = Date.now();

    return isLive;
  } catch (err) {
    console.error('[api-handler] checkStreamStatus failed:', err.message);

    // Return cached value if available for graceful degradation
    if (_internalCache.live !== null) {
      console.warn('[api-handler] Using cached stream status (Last Known Status).');
      return _internalCache.live;
    }

    // Default to offline on total failure
    return false;
  }
}

/**
 * Returns the last cached stream status without hitting the API.
 * @returns {{ live: boolean | null, updatedAt: number | null }}
 */
function getCachedStatus() {
  return { ..._internalCache };
}

export { checkStreamStatus, getCachedStatus };
