/**
 * @file netlify/functions/log.js
 * @description Serverless analytics logging endpoint.
 *              Receives anonymised event beacons from the frontend and stores
 *              them in a structured JSON Lines format.
 *
 *              Privacy guarantees:
 *              - IP addresses are never logged.
 *              - Only the fields present in the incoming JSON are stored.
 *              - Rate-limited to prevent abuse (max 100 requests per IP per hour).
 *
 * @version 1.0.0
 */

'use strict';

/**
 * In-memory rate-limit store.
 * Maps hashed IP -> { count: number, resetAt: number }
 * Note: This resets on cold-starts. For persistent rate-limiting use a database.
 * @type {Map<string, {count: number, resetAt: number}>}
 */
const _rateLimitStore = new Map();

/** @constant {number} Max requests allowed per window per IP */
const RATE_LIMIT_MAX = 100;

/** @constant {number} Rate-limit window size in milliseconds (1 hour) */
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/** @constant {number} Max accepted payload size in bytes */
const MAX_BODY_BYTES = 4096;

/**
 * Simple hash function to anonymise IP addresses.
 * We use a one-way transform so we can rate-limit without storing the raw IP.
 *
 * @param {string} ip - Raw IP address string.
 * @returns {string} Deterministic but non-reversible token.
 */
function _hashIp(ip) {
  // Simple djb2-style hash — not cryptographic, but sufficient for rate-limiting
  let hash = 5381;
  for (let i = 0; i < ip.length; i++) {
    hash = (hash * 33) ^ ip.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Returns `true` if the request from the given IP is within the rate limit.
 * Updates the counter as a side-effect.
 *
 * @param {string} ip - Client IP address.
 * @returns {boolean}
 */
function _checkRateLimit(ip) {
  const key  = _hashIp(ip);
  const now  = Date.now();
  const entry = _rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    _rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;

  entry.count += 1;
  return true;
}

/**
 * Validates that the event payload has the minimum required fields and no
 * unexpected large values that could indicate an injection attempt.
 *
 * @param {unknown} body - Parsed JSON body.
 * @returns {{ valid: boolean, reason?: string }}
 */
function _validatePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, reason: 'Body must be a JSON object.' };
  }
  if (typeof body.event !== 'string' || body.event.length > 64) {
    return { valid: false, reason: 'Missing or invalid "event" field.' };
  }
  if (typeof body.timestamp !== 'string') {
    return { valid: false, reason: 'Missing "timestamp" field.' };
  }
  return { valid: true };
}

/**
 * Sanitises log fields by removing any key whose value is not a primitive.
 * This prevents storing nested objects or arrays that could bloat the log.
 *
 * @param {object} payload - Raw event payload.
 * @returns {object} Sanitised flat object.
 */
function _sanitisePayload(payload) {
  const safe = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== null && typeof value !== 'object' && typeof value !== 'function') {
      safe[key] = value;
    }
  }
  return safe;
}

/**
 * Netlify serverless function handler.
 *
 * @param {import('@netlify/functions').HandlerEvent}   event
 * @param {import('@netlify/functions').HandlerContext} _context
 * @returns {Promise<import('@netlify/functions').HandlerResponse>}
 */
exports.handler = async function handler(event) {
  // Only accept POST (or beacon — which is also POST)
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Enforce payload size limit
  const rawBody = event.body || '';
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return { statusCode: 413, body: 'Payload Too Large' };
  }

  // Rate limiting (anonymised — IP is never stored)
  const clientIp =
    event.headers['x-forwarded-for']?.split(',')[0].trim() ||
    event.headers['client-ip'] ||
    '0.0.0.0';

  if (!_checkRateLimit(clientIp)) {
    return { statusCode: 429, body: 'Too Many Requests' };
  }

  // Parse JSON body
  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch (_) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  // Validate required fields
  const { valid, reason } = _validatePayload(parsed);
  if (!valid) {
    return { statusCode: 400, body: reason };
  }

  // Sanitise and build the log entry (no PII)
  const entry = {
    ..._sanitisePayload(parsed),
    received_at: new Date().toISOString(),
    // Explicitly strip any PII that should never appear
    ip: undefined,
    email: undefined,
    name: undefined,
  };

  // Remove undefined fields from the final entry
  Object.keys(entry).forEach((k) => entry[k] === undefined && delete entry[k]);

  // TODO: In production, persist `entry` to Supabase or a private GitHub repo
  // using the storage adapter of your choice. Example:
  //   await supabase.from('events').insert(entry);
  // For now, log to the function's stdout (visible in Netlify function logs).
  console.log('[log-event]', JSON.stringify(entry));

  return {
    statusCode: 204,
    body: '',
    headers: {
      'Cache-Control': 'no-store',
    },
  };
};
