/**
 * @file analytics-logger.js
 * @description Privacy-compliant analytics logger for the PVA Bazaar Stream
 *              Ecosystem. Sends anonymised events via `navigator.sendBeacon`
 *              to the serverless logging endpoint.
 *
 *              Privacy guarantees:
 *              - No IP addresses, names, emails, or precise locations collected.
 *              - All user identifiers are hashed (SHA-256 via SubtleCrypto).
 *              - Consent is checked before any data is sent (GDPR/CCPA).
 *              - Data is only sent if the user has accepted cookies.
 *
 * @version 1.0.0
 */

'use strict';

/** @constant {string} Serverless log endpoint */
const LOG_ENDPOINT = '/api/log';

/** @constant {string} localStorage key for analytics consent */
const CONSENT_KEY = 'pva_analytics_consent';

/** @constant {string} localStorage key for the hashed session ID */
const SESSION_ID_KEY = 'pva_session_id';

/**
 * Returns `true` if the user has granted analytics consent.
 * @returns {boolean}
 */
function _hasConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'granted';
  } catch (_) {
    return false;
  }
}

/**
 * Saves the user's consent choice to localStorage.
 * @param {'granted'|'denied'} choice
 */
function saveConsent(choice) {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch (err) {
    console.warn('[analytics] Could not save consent:', err.message);
  }
}

/**
 * Generates a cryptographically random session ID as a hex string.
 * @returns {string}
 */
function _generateSessionId() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hashes a string using SHA-256 via the Web Crypto API.
 * Returns a hex string. Returns an empty string if hashing fails.
 *
 * @param {string} input - The value to hash.
 * @returns {Promise<string>}
 */
async function _hashValue(input) {
  try {
    const encoder = new TextEncoder();
    const data    = encoder.encode(input);
    const digest  = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.warn('[analytics] Hash failed:', err.message);
    return '';
  }
}

/**
 * Returns a persistent, hashed session ID for this user.
 * Creates a new one if none exists. Requires user consent to persist.
 *
 * @returns {Promise<string>} Hashed session identifier.
 */
async function _getSessionId() {
  try {
    let raw = sessionStorage.getItem(SESSION_ID_KEY);
    if (!raw) {
      raw = _generateSessionId();
      sessionStorage.setItem(SESSION_ID_KEY, raw);
    }
    return await _hashValue(raw);
  } catch (_) {
    return '';
  }
}

/**
 * Determines the user's device type without collecting PII.
 * @returns {'mobile'|'tablet'|'desktop'}
 */
function _getDeviceType() {
  const ua = navigator.userAgent || '';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  if (/Tablet|iPad/i.test(ua)) return 'tablet';
  return 'desktop';
}

/**
 * Sends an analytics event beacon to the serverless log endpoint.
 *
 * The function is intentionally non-blocking — it uses `navigator.sendBeacon`
 * so events are delivered even if the user navigates away.
 *
 * @param {string} eventName - The name of the event (e.g. "embed_loaded").
 * @param {object} [payload] - Optional additional event data.
 * @returns {Promise<void>} Resolves immediately; delivery is best-effort.
 */
async function logEvent(eventName, payload = {}) {
  if (!_hasConsent()) return;

  try {
    const sessionId = await _getSessionId();

    const body = JSON.stringify({
      event:      eventName,
      timestamp:  new Date().toISOString(),
      session_id: sessionId,          // hashed — no PII
      device:     _getDeviceType(),
      domain:     window.location.hostname,
      ...payload,
    });

    const blob = new Blob([body], { type: 'application/json' });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(LOG_ENDPOINT, blob);
    } else {
      // Fallback: fire-and-forget fetch (best effort)
      fetch(LOG_ENDPOINT, { method: 'POST', body: blob, keepalive: true }).catch(() => {});
    }
  } catch (err) {
    // Never crash the application due to analytics failure
    console.warn('[analytics] logEvent failed:', err.message);
  }
}

/**
 * Initialises the cookie consent banner.
 * Hides the banner if consent has already been recorded; shows it otherwise.
 */
function initConsentBanner() {
  const banner    = document.getElementById('cookie-banner');
  const acceptBtn = document.getElementById('cookie-accept');
  const denyBtn   = document.getElementById('cookie-deny');

  if (!banner) return;

  // Show banner only if no decision has been made yet
  const existing = localStorage.getItem(CONSENT_KEY);
  if (!existing) {
    banner.classList.add('is-visible');
  }

  if (acceptBtn) {
    acceptBtn.addEventListener('click', () => {
      saveConsent('granted');
      banner.classList.remove('is-visible');
    });
  }

  if (denyBtn) {
    denyBtn.addEventListener('click', () => {
      saveConsent('denied');
      banner.classList.remove('is-visible');
    });
  }
}

export { logEvent, initConsentBanner, saveConsent };
