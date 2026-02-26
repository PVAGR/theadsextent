/**
 * @file embed-engine.js
 * @description Core Universal Embed Engine. Handles live/offline detection,
 *              dynamic Twitch parent-domain injection, chat integration,
 *              CTA overlay, and interstitial pre-roll display.
 * @version 1.0.0
 */

'use strict';

import { checkStreamStatus } from './api-handler.js';
import { logEvent } from './analytics-logger.js';

/** @constant {number} Interstitial display duration in seconds (offline only) */
const INTERSTITIAL_DURATION_S = 5;

/** @constant {number} Sessions shorter than this (in seconds) are classified as bounces */
const BOUNCE_THRESHOLD_SECONDS = 10;

/**
 * Resolves the parent domain required by the Twitch embed API.
 * Falls back to a safe placeholder if the hostname cannot be determined.
 *
 * @returns {string} The current hostname (e.g. "example.com" or "localhost").
 */
function _getParentDomain() {
  try {
    return window.location.hostname || 'localhost';
  } catch (_) {
    return 'localhost';
  }
}

/**
 * Builds the Twitch player iframe src URL with all required parameters.
 *
 * @param {string}  channel  - Twitch channel login.
 * @param {boolean} muted    - Whether the player starts muted.
 * @param {string}  parent   - The parent domain required by Twitch.
 * @returns {string} Full iframe src URL.
 */
function _buildPlayerSrc(channel, muted, parent) {
  const params = new URLSearchParams({
    channel,
    parent,
    muted: muted ? 'true' : 'false',
    autoplay: 'true',
  });
  return `https://player.twitch.tv/?${params.toString()}`;
}

/**
 * Builds the Twitch chat iframe src URL.
 *
 * @param {string} channel - Twitch channel login.
 * @param {string} parent  - The parent domain required by Twitch.
 * @returns {string} Full iframe src URL.
 */
function _buildChatSrc(channel, parent) {
  const params = new URLSearchParams({ channel, parent, darkpopout: '' });
  return `https://www.twitch.tv/embed/${encodeURIComponent(channel)}/chat?${params.toString()}`;
}

/**
 * Shows the Twitch player iframe and hides all other states.
 *
 * @param {object} cfg - Embed configuration from config.json.
 */
function _showPlayer(cfg) {
  const loading  = document.getElementById('embed-loading');
  const offline  = document.getElementById('embed-offline');
  const error    = document.getElementById('embed-error');
  const playerEl = document.getElementById('twitch-player');
  const ctaEl    = document.getElementById('cta-overlay');
  const chatEl   = document.getElementById('chat-panel');

  if (loading)  loading.classList.add('hidden');
  if (offline)  { offline.classList.remove('is-visible'); offline.classList.add('hidden'); }
  if (error)    { error.classList.remove('is-visible');   error.classList.add('hidden'); }

  if (playerEl) {
    const parent = _getParentDomain();
    playerEl.src = _buildPlayerSrc(cfg.channel, cfg.muted, parent);

    // Warn in console if parent domain might not be whitelisted
    if (parent === 'localhost') {
      console.warn(
        '[embed-engine] Parent domain is "localhost". Ensure the production ' +
        'domain is registered in the Twitch Developer Console.'
      );
    }
    playerEl.classList.remove('hidden');
  }

  if (ctaEl) ctaEl.classList.remove('hidden');

  if (chatEl && cfg.chat_enabled) {
    const chatFrame = chatEl.querySelector('iframe');
    if (chatFrame) {
      chatFrame.src = _buildChatSrc(cfg.channel, _getParentDomain());
    }
    chatEl.classList.remove('hidden');
  }
}

/**
 * Shows the offline placeholder (schedule, VOD links, affiliate showcase).
 * Also triggers a short interstitial before the placeholder if one is present.
 */
function _showOffline() {
  const loading  = document.getElementById('embed-loading');
  const playerEl = document.getElementById('twitch-player');
  const ctaEl    = document.getElementById('cta-overlay');
  const chatEl   = document.getElementById('chat-panel');
  const interstitialEl = document.getElementById('embed-interstitial');
  const offlineEl = document.getElementById('embed-offline');

  if (loading)  loading.classList.add('hidden');
  if (playerEl) { playerEl.src = ''; playerEl.classList.add('hidden'); }
  if (ctaEl)    ctaEl.classList.add('hidden');
  if (chatEl)   chatEl.classList.add('hidden');

  // Show interstitial first if it exists, then reveal offline panel after delay
  if (interstitialEl) {
    _runInterstitial(interstitialEl, INTERSTITIAL_DURATION_S, () => {
      if (offlineEl) { offlineEl.classList.remove('hidden'); offlineEl.classList.add('is-visible'); }
    });
  } else if (offlineEl) {
    offlineEl.classList.remove('hidden');
    offlineEl.classList.add('is-visible');
  }
}

/**
 * Shows the error state (e.g. Twitch domain not whitelisted or API unavailable).
 *
 * @param {string} message - Human-readable error description.
 */
function _showError(message) {
  const loading  = document.getElementById('embed-loading');
  const playerEl = document.getElementById('twitch-player');
  const errorEl  = document.getElementById('embed-error');
  const errorMsg = document.getElementById('embed-error-message');

  if (loading)  loading.classList.add('hidden');
  if (playerEl) { playerEl.src = ''; playerEl.classList.add('hidden'); }
  if (errorMsg) errorMsg.textContent = message;
  if (errorEl)  { errorEl.classList.remove('hidden'); errorEl.classList.add('is-visible'); }
}

/**
 * Runs a countdown interstitial for a fixed duration, then fires a callback.
 *
 * @param {HTMLElement} el       - The interstitial container element.
 * @param {number}      duration - Countdown duration in seconds.
 * @param {Function}    onEnd    - Callback invoked when countdown reaches 0.
 */
function _runInterstitial(el, duration, onEnd) {
  const countdownEl = el.querySelector('.interstitial__countdown');
  const skipBtn     = el.querySelector('.interstitial__skip');
  el.classList.add('is-visible');

  let remaining = duration;

  /** Updates the countdown label */
  function _tick() {
    if (countdownEl) countdownEl.textContent = `Continuing in ${remaining}s…`;
    if (remaining <= 0) {
      _finish();
    } else {
      remaining -= 1;
      setTimeout(_tick, 1000);
    }
  }

  /** Ends the interstitial immediately */
  function _finish() {
    el.classList.remove('is-visible');
    el.classList.add('hidden');
    if (skipBtn) skipBtn.removeEventListener('click', _finish);
    onEnd();
  }

  if (skipBtn) skipBtn.addEventListener('click', _finish);
  _tick();
}

/**
 * Populates the schedule list in the offline placeholder from config data.
 *
 * @param {Array<{day: string, time: string}>} schedule - Stream schedule entries.
 */
function _renderSchedule(schedule) {
  const listEl = document.getElementById('schedule-list');
  if (!listEl || !Array.isArray(schedule)) return;

  listEl.innerHTML = '';
  schedule.forEach(({ day, time }) => {
    const li = document.createElement('li');
    // Use textContent to avoid XSS
    li.textContent = `${day} @ ${time}`;
    listEl.appendChild(li);
  });
}

/**
 * Populates the VOD/highlight links in the offline placeholder.
 *
 * @param {Array<{title: string, url: string}>} links - VOD link entries.
 */
function _renderVodLinks(links) {
  const container = document.getElementById('vod-links');
  if (!container || !Array.isArray(links)) return;

  container.innerHTML = '';
  links.forEach(({ title, url }) => {
    const a = document.createElement('a');
    a.href        = url;
    a.rel         = 'noopener noreferrer';
    a.target      = '_blank';
    a.className   = 'btn btn-secondary';
    a.textContent = title; // textContent prevents XSS
    container.appendChild(a);
  });
}

/**
 * Initialises the embed engine. This is the primary entry point.
 * Reads configuration, checks stream status, and renders the appropriate view.
 *
 * @param {object} config - Full parsed config.json object.
 * @returns {Promise<void>}
 */
async function initEmbedEngine(config) {
  const cfg = config.embed;
  const startTime = Date.now();

  // Populate static offline UI elements from config
  _renderSchedule(cfg.schedule);
  _renderVodLinks(cfg.vod_links);

  // Set offline message text
  const msgEl = document.getElementById('offline-message');
  if (msgEl) msgEl.textContent = cfg.offline_message || '';

  // Set notify-me link
  const notifyBtn = document.getElementById('notify-me-btn');
  if (notifyBtn && cfg.notify_url) {
    notifyBtn.href = cfg.notify_url;
  }

  // Log embed load event (non-blocking)
  logEvent('embed_loaded', { domain: _getParentDomain() });

  let isLive;
  try {
    isLive = await checkStreamStatus(cfg.channel);
  } catch (err) {
    console.error('[embed-engine] Stream status check threw unexpectedly:', err);
    _showError(
      'Unable to load the stream. Please refresh the page or check your connection.'
    );
    return;
  }

  if (isLive) {
    _showPlayer(cfg);
  } else {
    _showOffline();
  }

  // Log stream status (non-blocking)
  logEvent('stream_status_change', { live: isLive });

  // Track approximate watch time on page unload (only when live)
  if (isLive) {
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        const secondsWatched = Math.round((Date.now() - startTime) / 1000);
        logEvent('time_watched', { seconds: secondsWatched });

        // Log bounce if user left within 10 seconds
        if (secondsWatched < BOUNCE_THRESHOLD_SECONDS) {
          logEvent('bounce', { seconds: secondsWatched });
        }
      }
    });
  }
}

export { initEmbedEngine };
