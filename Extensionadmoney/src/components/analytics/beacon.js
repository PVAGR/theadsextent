/**
 * @file src/components/analytics/beacon.js
 * @description Privacy-safe analytics beacon sender.
 * Uses navigator.sendBeacon when available, with a fetch fallback.
 */

const CONSENT_KEY = "pva_bazaar_embed_analytics_consent";

/** @type {boolean} */
let _consentGranted = false;

/**
 * Returns whether analytics consent has been granted.
 * @returns {boolean}
 */
export function hasConsent() {
  return _consentGranted;
}

/**
 * Restore consent state from localStorage without showing the banner.
 * Returns true if a stored decision exists.
 * @returns {boolean}
 */
export function restoreConsent() {
  const stored = localStorage.getItem(CONSENT_KEY);
  if (stored === "accepted") { _consentGranted = true; return true; }
  if (stored === "declined") { _consentGranted = false; return true; }
  return false;
}

/**
 * Grant consent programmatically and persist the decision.
 */
export function grantConsent() {
  _consentGranted = true;
  localStorage.setItem(CONSENT_KEY, "accepted");
}

/**
 * Deny consent programmatically and persist the decision.
 */
export function denyConsent() {
  _consentGranted = false;
  localStorage.setItem(CONSENT_KEY, "declined");
}

/**
 * Send a privacy-safe analytics event beacon.
 *
 * @param {{
 *   loggingEnabled: boolean,
 *   beaconEndpoint: string,
 *   cookieConsentRequired: boolean,
 * }} analyticsConfig
 * @param {string} eventName
 * @param {Record<string, unknown>} properties
 */
export function sendBeacon(analyticsConfig, eventName, properties) {
  if (!analyticsConfig?.loggingEnabled) return;
  if (!analyticsConfig?.beaconEndpoint) return;
  if (analyticsConfig.cookieConsentRequired && !_consentGranted) return;

  const payload = JSON.stringify({
    event: eventName,
    timestamp: new Date().toISOString(),
    properties,
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      analyticsConfig.beaconEndpoint,
      new Blob([payload], { type: "application/json" })
    );
  } else {
    fetch(analyticsConfig.beaconEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }
}
