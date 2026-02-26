/**
 * @file main.js
 * @description Application bootstrap. Loads config.json then initialises
 *              the Embed Engine, Monetization Suite, and Analytics Logger.
 * @version 1.0.0
 */

'use strict';

import { initEmbedEngine }   from './embed-engine.js';
import { initAffiliateRotator, initSponsorBar, initDonationGoal, initTipJarModal, applyAbTest } from './monetization.js';
import { initConsentBanner } from './analytics-logger.js';

/**
 * Fetches and parses config.json.
 * @returns {Promise<object>} Parsed configuration object.
 * @throws {Error} If the file cannot be loaded or parsed.
 */
async function _loadConfig() {
  const response = await fetch('/config.json');
  if (!response.ok) {
    throw new Error(`Failed to load config.json: HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Main application initialisation.
 */
async function main() {
  // Initialise consent banner first (before any logging occurs)
  initConsentBanner();

  let config;
  try {
    config = await _loadConfig();
  } catch (err) {
    console.error('[main] Could not load configuration:', err.message);
    // Show user-friendly fallback
    const body = document.body;
    if (body) {
      body.innerHTML =
        '<div style="color:#efeff1;padding:2rem;text-align:center;">' +
        '<h1>Stream temporarily unavailable</h1>' +
        '<p>Please try refreshing the page.</p>' +
        '</div>';
    }
    return;
  }

  // Embed Engine (live/offline detection, player, chat)
  await initEmbedEngine(config);

  // Monetization Suite
  initAffiliateRotator(config.monetization);
  initSponsorBar(config.monetization);
  initDonationGoal(config.monetization);
  initTipJarModal(config.monetization);
  applyAbTest(config.ab_test);
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
