/**
 * @file src/components/analytics/consent.js
 * @description Cookie consent banner component.
 * Reads/writes consent state and shows or hides the banner accordingly.
 * Works together with beacon.js for coordinated consent management.
 */

import { restoreConsent, grantConsent, denyConsent } from "./beacon.js";

/**
 * Initialize the cookie consent banner.
 *
 * @param {{
 *   bannerId: string,
 *   acceptBtnId: string,
 *   declineBtnId: string,
 * }} elementIds
 * @param {{ cookieConsentRequired: boolean }} analyticsConfig
 * @param {{ onAccept?: () => void, onDecline?: () => void }} [callbacks]
 */
export function initCookieConsent(
  elementIds,
  analyticsConfig,
  { onAccept = () => {}, onDecline = () => {} } = {}
) {
  // If consent is not required, grant silently and return.
  if (!analyticsConfig?.cookieConsentRequired) {
    grantConsent();
    return;
  }

  // Try to restore a previous decision without showing the banner.
  if (restoreConsent()) return;

  const banner    = document.getElementById(elementIds.bannerId);
  const acceptBtn = document.getElementById(elementIds.acceptBtnId);
  const declineBtn = document.getElementById(elementIds.declineBtnId);

  if (!banner || !acceptBtn || !declineBtn) return;

  // No previous decision found – show the banner.
  banner.classList.remove("hidden");

  acceptBtn.addEventListener("click", () => {
    grantConsent();
    banner.classList.add("hidden");
    onAccept();
  });

  declineBtn.addEventListener("click", () => {
    denyConsent();
    banner.classList.add("hidden");
    onDecline();
  });
}
