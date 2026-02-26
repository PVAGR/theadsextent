/**
 * logger.js
 * Privacy-compliant Analytics Logger for the PVA Bazaar Stream Ecosystem.
 *
 * Responsibilities:
 *  - Provide a `StreamLogger.log(event, data)` API for all other modules
 *  - Respect cookie consent (opt-in only; reads localStorage flag)
 *  - Transmit events via navigator.sendBeacon to the /api/log endpoint
 *  - Assign and persist a hashed anonymous session ID (no PII)
 *  - Handle the GDPR/CCPA consent banner
 *  - Track: embed_loaded, stream_status_change, affiliate_click,
 *            donation_initiated, time_watched, bounce_rate
 *
 * Data collected:
 *  - Event name, timestamp, anonymous session hash, device type, domain
 *  - NO IP addresses, names, emails, or exact geolocation
 *
 * @version 1.0.0
 * @author  PVA Bazaar / ricktaur
 */

(function () {
  'use strict';

  // ----------------------------------------------------------------
  // CONSTANTS
  // ----------------------------------------------------------------
  /** @constant {string} CONSENT_KEY - localStorage key for analytics consent */
  const CONSENT_KEY    = 'pvabazaar_analytics_consent';

  /** @constant {string} SESSION_KEY - localStorage key for anonymous session ID */
  const SESSION_KEY    = 'pvabazaar_session_id';

  /** @constant {number} BOUNCE_THRESHOLD_MS - Time before page is not considered a bounce */
  const BOUNCE_THRESHOLD_MS = 10_000;

  /** @constant {string} LOG_ENDPOINT - Serverless function endpoint for log ingestion */
  const LOG_ENDPOINT = '/api/log';

  // ----------------------------------------------------------------
  // MODULE STATE
  // ----------------------------------------------------------------
  let _consentGiven   = false;
  let _sessionId      = null;
  let _loadTimestamp  = Date.now();
  let _hasBounced     = true; // assume bounce until threshold is exceeded
  let _analyticsEnabled = true;

  // ----------------------------------------------------------------
  // CONSENT MANAGEMENT
  // ----------------------------------------------------------------

  /**
   * Read stored consent from localStorage.
   * @returns {boolean|null} true = accepted, false = declined, null = not yet set
   */
  function _readConsent() {
    try {
      const val = localStorage.getItem(CONSENT_KEY);
      if (val === 'true')  return true;
      if (val === 'false') return false;
      return null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Persist the user's consent decision.
   * @param {boolean} accepted
   */
  function _storeConsent(accepted) {
    try {
      localStorage.setItem(CONSENT_KEY, String(accepted));
    } catch (_) { /* localStorage unavailable */ }
  }

  /**
   * Show or hide the cookie consent banner depending on prior consent.
   */
  function _handleConsentBanner() {
    const banner     = document.getElementById('cookie-banner');
    const acceptBtn  = document.getElementById('cookie-accept');
    const declineBtn = document.getElementById('cookie-decline');

    const stored = _readConsent();

    if (stored !== null) {
      // User has already decided
      _consentGiven = stored;
      if (banner) banner.setAttribute('hidden', '');
      return;
    }

    // Show the banner
    if (banner) {
      banner.removeAttribute('hidden');

      if (acceptBtn) {
        acceptBtn.addEventListener('click', function () {
          _consentGiven = true;
          _storeConsent(true);
          banner.setAttribute('hidden', '');
          // Log the load event now that we have consent
          _logEmbedLoaded();
        });
      }

      if (declineBtn) {
        declineBtn.addEventListener('click', function () {
          _consentGiven = false;
          _storeConsent(false);
          banner.setAttribute('hidden', '');
        });
      }
    }
  }

  // ----------------------------------------------------------------
  // SESSION ID (ANONYMOUS)
  // ----------------------------------------------------------------

  /**
   * Retrieve or generate an anonymous session ID.
   * The ID is a SHA-256-like hash of a random UUID — no PII involved.
   * Persists across page reloads to enable longitudinal tracking (with consent).
   *
   * @returns {Promise<string>} Hex-encoded session hash
   */
  async function _getSessionId() {
    if (_sessionId) return _sessionId;

    try {
      let raw = localStorage.getItem(SESSION_KEY);
      if (!raw) {
        // Generate a random identifier
        raw = _generateUUID();
        localStorage.setItem(SESSION_KEY, raw);
      }
      // Hash it so the stored value is opaque
      _sessionId = await _sha256(raw);
    } catch (_) {
      // Fallback: use a tab-scoped random value
      _sessionId = _generateUUID();
    }

    return _sessionId;
  }

  /**
   * Generate a version-4 UUID using the Web Crypto API where available,
   * falling back to Math.random().
   * @returns {string}
   */
  function _generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback (non-cryptographic, acceptable for anonymous IDs)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Compute a SHA-256 hash of a string using the SubtleCrypto API.
   * @param {string} message
   * @returns {Promise<string>} Hex-encoded digest
   */
  async function _sha256(message) {
    const encoder = new TextEncoder();
    const data    = encoder.encode(message);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ----------------------------------------------------------------
  // DEVICE DETECTION
  // ----------------------------------------------------------------

  /**
   * Classify the device type from the user agent.
   * Returns 'mobile', 'tablet', or 'desktop'.
   * @returns {string}
   */
  function _getDeviceType() {
    const ua = navigator.userAgent || '';
    if (/Mobi|Android|iPhone/i.test(ua))   return 'mobile';
    if (/Tablet|iPad/i.test(ua))           return 'tablet';
    return 'desktop';
  }

  // ----------------------------------------------------------------
  // BEACON TRANSMISSION
  // ----------------------------------------------------------------

  /**
   * Send an analytics event to the logging endpoint.
   * Uses navigator.sendBeacon when available (survives page close).
   * Falls back to a fire-and-forget fetch.
   *
   * All data is anonymised — no PII is included.
   *
   * @param {string} eventName - Event identifier (e.g., 'embed_loaded')
   * @param {Object} [payload] - Additional event-specific data
   */
  async function log(eventName, payload) {
    if (!_analyticsEnabled || !_consentGiven) return;

    const sessionId = await _getSessionId();

    const body = JSON.stringify({
      event:       eventName,
      session_id:  sessionId,
      timestamp:   Date.now(),
      domain:      window.location.hostname,
      device_type: _getDeviceType(),
      ab_group:    _abGroup,
      ...payload,
    });

    const blob = new Blob([body], { type: 'application/json' });

    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(LOG_ENDPOINT, blob);
    } else {
      // Fallback for browsers without sendBeacon
      fetch(LOG_ENDPOINT, {
        method:      'POST',
        body:        blob,
        keepalive:   true,
        credentials: 'omit',
      }).catch(err => {
        console.warn('[Logger] Beacon fallback failed:', err.message);
      });
    }
  }

  // ----------------------------------------------------------------
  // BUILT-IN EVENTS
  // ----------------------------------------------------------------

  /**
   * Log the `embed_loaded` event (fires once on page load).
   */
  function _logEmbedLoaded() {
    log('embed_loaded', {
      domain:      window.location.hostname,
      device_type: _getDeviceType(),
    });
  }

  /**
   * Set up a listener to log `time_watched` and `bounce_rate`
   * when the user leaves the page.
   */
  function _attachPageExitTracking() {
    window.addEventListener('beforeunload', () => {
      const duration = Date.now() - _loadTimestamp;
      const bounced  = duration < BOUNCE_THRESHOLD_MS;

      // Use sendBeacon directly — cannot await inside beforeunload
      if (_consentGiven) {
        const body = JSON.stringify({
          event:        'time_watched',
          session_id:   _sessionId || 'unknown',
          timestamp:    Date.now(),
          duration_ms:  duration,
          bounced:      bounced,
        });
        navigator.sendBeacon(LOG_ENDPOINT, new Blob([body], { type: 'application/json' }));
      }
    });
  }

  // ----------------------------------------------------------------
  // A/B TEST GROUP
  // ----------------------------------------------------------------
  /** @type {string} Current A/B test group, read from config */
  let _abGroup = 'A';

  /**
   * Load the A/B group from config.json and apply it to the UI.
   * Example: Group B sees a green donate button instead of purple.
   */
  async function _loadAbGroup() {
    try {
      const res = await fetch('config.json');
      if (!res.ok) return;
      const cfg = await res.json();
      _abGroup = (cfg.analytics && cfg.analytics.ab_test_group) || 'A';
      _analyticsEnabled = (cfg.analytics && cfg.analytics.enabled !== false);

      // Apply A/B variant to the support button colour
      if (_abGroup === 'B') {
        const ctaBtn = document.getElementById('btn-support');
        if (ctaBtn) {
          ctaBtn.style.background = '#00b894'; // green for group B
        }
      }
    } catch (_) { /* config unavailable */ }
  }

  // ----------------------------------------------------------------
  // INIT
  // ----------------------------------------------------------------

  /**
   * Initialise the analytics logger.
   */
  async function init() {
    await _loadAbGroup();
    _handleConsentBanner();
    _attachPageExitTracking();

    // If consent was already given from a previous visit, log immediately
    if (_consentGiven) {
      _logEmbedLoaded();
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  // Expose public API
  window.StreamLogger = { log };

})();
