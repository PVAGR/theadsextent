/**
 * embed-engine.js
 * Universal Embed Engine for the PVA Bazaar Stream Ecosystem.
 *
 * Responsibilities:
 *  - Load config.json
 *  - Query the Twitch Helix API to detect live/offline status
 *  - Render the Twitch iframe (with correct `parent` param) when live
 *  - Render the offline placeholder when offline
 *  - Populate the stream schedule from config
 *  - Show a pre-roll interstitial (5 s) before the affiliate rotator
 *  - Handle API failures with exponential backoff and cached status
 *
 * @version 1.0.0
 * @author  PVA Bazaar / ricktaur
 */

(function () {
  'use strict';

  // ----------------------------------------------------------------
  // CONSTANTS
  // ----------------------------------------------------------------
  /** @constant {string} CONFIG_PATH - Path to the centralized config file */
  const CONFIG_PATH = 'config.json';

  /** @constant {number} MAX_RETRIES - Maximum Twitch API retry attempts */
  const MAX_RETRIES = 5;

  /** @constant {string} CACHE_KEY - localStorage key for last known stream status */
  const CACHE_KEY = 'pvabazaar_stream_status';

  /** @constant {number} INTERSTITIAL_SECONDS - Pre-roll display duration */
  const INTERSTITIAL_SECONDS = 5;

  // ----------------------------------------------------------------
  // MODULE STATE
  // ----------------------------------------------------------------
  let _config = null;
  let _retryCount = 0;

  // ----------------------------------------------------------------
  // DOM HELPERS
  // ----------------------------------------------------------------

  /**
   * Show an element by removing the `hidden` attribute.
   * @param {HTMLElement} el
   */
  function show(el) {
    if (el) el.removeAttribute('hidden');
  }

  /**
   * Hide an element by setting the `hidden` attribute.
   * @param {HTMLElement} el
   */
  function hide(el) {
    if (el) el.setAttribute('hidden', '');
  }

  // ----------------------------------------------------------------
  // CONFIG LOADER
  // ----------------------------------------------------------------

  /**
   * Fetch and parse config.json.
   * @returns {Promise<Object>} Parsed configuration object
   */
  async function loadConfig() {
    const res = await fetch(CONFIG_PATH);
    if (!res.ok) throw new Error(`Failed to load config.json (HTTP ${res.status})`);
    return res.json();
  }

  // ----------------------------------------------------------------
  // TWITCH API
  // ----------------------------------------------------------------

  /**
   * Query the Twitch Helix API to determine if the channel is currently live.
   * Uses exponential backoff on failure up to MAX_RETRIES.
   *
   * @param {string} channel     - Twitch login name
   * @param {string} clientId    - Twitch application Client ID
   * @param {string} apiBase     - Twitch API base URL
   * @returns {Promise<boolean>} true if the stream is live
   */
  async function checkStreamStatus(channel, clientId, apiBase) {
    const url = `${apiBase}/streams?user_login=${encodeURIComponent(channel)}`;

    try {
      const res = await fetch(url, {
        headers: {
          'Client-ID': clientId,
          // NOTE: For production, include a valid Bearer token obtained via
          // Client Credentials OAuth flow in a serverless function.
          // 'Authorization': 'Bearer <token>'
        }
      });

      if (!res.ok) throw new Error(`Twitch API error (HTTP ${res.status})`);

      const data = await res.json();
      const isLive = Array.isArray(data.data) && data.data.length > 0;

      // Cache the last known status
      _cacheStatus(isLive);
      _retryCount = 0;
      return isLive;

    } catch (err) {
      console.error('[EmbedEngine] API call failed:', err.message);
      _retryCount++;

      if (_retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, _retryCount) * 1000; // exponential backoff
        console.warn(`[EmbedEngine] Retrying in ${delay / 1000}s… (attempt ${_retryCount}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return checkStreamStatus(channel, clientId, apiBase);
      }

      // All retries exhausted — fall back to cached status
      console.error('[EmbedEngine] Max retries reached. Falling back to cached status.');
      _showApiError();
      return _getCachedStatus();
    }
  }

  // ----------------------------------------------------------------
  // STATUS CACHE
  // ----------------------------------------------------------------

  /**
   * Persist the current stream status in localStorage.
   * @param {boolean} isLive
   */
  function _cacheStatus(isLive) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ isLive, ts: Date.now() }));
    } catch (_) { /* localStorage unavailable (e.g., private mode) */ }
  }

  /**
   * Retrieve the last cached stream status.
   * @returns {boolean} Last known live status, defaults to false
   */
  function _getCachedStatus() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return false;
      const { isLive } = JSON.parse(raw);
      return Boolean(isLive);
    } catch (_) {
      return false;
    }
  }

  // ----------------------------------------------------------------
  // RENDER HELPERS
  // ----------------------------------------------------------------

  /**
   * Build and inject the Twitch Player iframe.
   * Dynamically detects window.location.hostname for the `parent` param
   * as required by the Twitch Embed API.
   *
   * @param {Object} embedCfg - embed section from config.json
   */
  function renderLivePlayer(embedCfg) {
    const spinner   = document.getElementById('loading-spinner');
    const wrapper   = document.getElementById('player-wrapper');

    if (!wrapper) return;

    // Detect parent hostname; fallback to localhost for development
    const parent = window.location.hostname || 'localhost';

    const params = new URLSearchParams({
      channel:  embedCfg.channel,
      parent:   parent,
      autoplay: embedCfg.autoplay ? 'true' : 'false',
      muted:    embedCfg.muted    ? 'true' : 'false',
    });

    const iframe = document.createElement('iframe');
    iframe.src         = `https://player.twitch.tv/?${params.toString()}`;
    iframe.title       = `${embedCfg.channel} live on Twitch`;
    iframe.allowFullscreen = true;
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');
    iframe.setAttribute('loading', 'lazy');

    // Insert iframe as first child so the overlay remains on top
    wrapper.insertBefore(iframe, wrapper.firstChild);

    hide(spinner);
    show(wrapper);

    // Log stream-loaded event for analytics
    if (window.StreamLogger) {
      window.StreamLogger.log('stream_status_change', { status: 'live' });
    }
  }

  /**
   * Populate and display the offline placeholder.
   * @param {Object} cfg - full config object
   */
  function renderOfflinePlaceholder(cfg) {
    const spinner     = document.getElementById('loading-spinner');
    const placeholder = document.getElementById('offline-placeholder');

    if (!placeholder) return;

    const embed = cfg.embed;

    // Offline message
    const msgEl = document.getElementById('offline-message');
    if (msgEl) msgEl.textContent = embed.offline_message || '';

    // Schedule
    const scheduleList = document.getElementById('schedule-list');
    if (scheduleList && Array.isArray(embed.schedule)) {
      scheduleList.innerHTML = embed.schedule
        .map(s => `<li>📅 <strong>${_sanitizeText(s.day)}</strong> – ${_sanitizeText(s.time)}</li>`)
        .join('');
    }

    // Action links
    _setHref('btn-follow',  embed.follow_url  || '#');
    _setHref('btn-vods',    embed.vod_url     || '#');
    _setHref('btn-youtube', embed.youtube_url || '#');
    _setHref('btn-store',   (cfg.monetization && cfg.monetization.store_url) || '#');

    hide(spinner);
    show(placeholder);

    // Show pre-roll interstitial before affiliate rotator
    _showInterstitial(cfg);

    // Log offline event
    if (window.StreamLogger) {
      window.StreamLogger.log('stream_status_change', { status: 'offline' });
    }
  }

  /**
   * Set the href of an anchor element by ID.
   * @param {string}  id
   * @param {string}  href
   */
  function _setHref(id, href) {
    const el = document.getElementById(id);
    if (el) el.href = href;
  }

  /**
   * Basic text sanitiser to prevent XSS when inserting dynamic text.
   * @param {string} str
   * @returns {string}
   */
  function _sanitizeText(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
  }

  /**
   * Show the API error banner.
   */
  function _showApiError() {
    const errEl = document.getElementById('api-error');
    show(errEl);
  }

  // ----------------------------------------------------------------
  // PRE-ROLL INTERSTITIAL
  // ----------------------------------------------------------------

  /**
   * Display a 5-second sponsored interstitial before affiliate content.
   * Uses the first sponsor or affiliate item from config as the featured product.
   *
   * @param {Object} cfg - full config object
   */
  function _showInterstitial(cfg) {
    const interstitial = document.getElementById('interstitial');
    const contentEl    = document.getElementById('interstitial-content');
    const timerEl      = document.getElementById('interstitial-timer');

    if (!interstitial || !contentEl || !timerEl) return;

    // Pick the first sponsor, or fall back to the first affiliate
    const mon      = cfg.monetization || {};
    const sponsors = mon.sponsors    || [];
    const items    = mon.affiliates  || [];

    let featured = null;
    if (sponsors.length) {
      featured = {
        title: sponsors[0].name,
        image: sponsors[0].logo,
        link:  sponsors[0].url,
        alt:   sponsors[0].alt || sponsors[0].name,
      };
    } else if (items.length) {
      featured = {
        title: items[0].title,
        image: items[0].image,
        link:  items[0].link,
        alt:   items[0].title,
      };
    }

    if (!featured) return;

    const utmLink = `${featured.link}?utm_source=embed&utm_medium=preroll&utm_campaign=${encodeURIComponent(cfg.embed.channel)}`;

    contentEl.innerHTML = `
      <a href="${_sanitizeAttr(utmLink)}" target="_blank" rel="noopener sponsored" aria-label="${_sanitizeAttr(featured.alt)}">
        <img src="${_sanitizeAttr(featured.image)}" alt="${_sanitizeAttr(featured.alt)}" width="200" height="150" loading="lazy" />
        <p>${_sanitizeText(featured.title)}</p>
      </a>`;

    show(interstitial);

    let remaining = INTERSTITIAL_SECONDS;
    timerEl.textContent = `Continuing in ${remaining}s…`;

    const interval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(interval);
        timerEl.textContent = '';
      } else {
        timerEl.textContent = `Continuing in ${remaining}s…`;
      }
    }, 1000);
  }

  /**
   * Sanitise a string for use in HTML attributes.
   * @param {string} str
   * @returns {string}
   */
  function _sanitizeAttr(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ----------------------------------------------------------------
  // SPONSOR CAROUSEL (FOOTER)
  // ----------------------------------------------------------------

  /**
   * Populate the sponsor carousel in the footer.
   * @param {Array}  sponsors
   * @param {string} channel  - used for UTM params
   */
  function renderSponsorCarousel(sponsors, channel) {
    const container = document.getElementById('sponsor-carousel');
    if (!container || !Array.isArray(sponsors) || !sponsors.length) return;

    const now = new Date();

    const activeSponsors = sponsors.filter(s => {
      if (!s.expires) return true;
      return new Date(s.expires) >= now;
    });

    container.innerHTML = activeSponsors.map(s => {
      const utmLink = `${s.url}?utm_source=embed&utm_medium=sponsor&utm_campaign=${encodeURIComponent(channel)}`;
      return `
        <a class="sponsor-logo"
           href="${_sanitizeAttr(utmLink)}"
           target="_blank"
           rel="noopener sponsored"
           aria-label="${_sanitizeAttr(s.alt || s.name)}">
          <img src="${_sanitizeAttr(s.logo)}"
               alt="${_sanitizeAttr(s.alt || s.name)}"
               width="120"
               height="40"
               loading="lazy" />
        </a>`;
    }).join('');
  }

  // ----------------------------------------------------------------
  // FOOTER DISCLOSURE
  // ----------------------------------------------------------------

  /**
   * Inject the affiliate disclosure text into the footer.
   * @param {string} text
   */
  function renderFooterDisclosure(text) {
    const el = document.getElementById('footer-affiliate-disclosure');
    if (el && text) el.textContent = text;
  }

  // ----------------------------------------------------------------
  // INIT
  // ----------------------------------------------------------------

  /**
   * Bootstrap the embed engine.
   * Loads config → checks stream status → renders appropriate state.
   */
  async function init() {
    try {
      _config = await loadConfig();
    } catch (err) {
      console.error('[EmbedEngine] Could not load config.json:', err.message);
      // Show a minimal offline state without crashing
      hide(document.getElementById('loading-spinner'));
      show(document.getElementById('offline-placeholder'));
      return;
    }

    const embed = _config.embed;
    const api   = _config.api || {};

    // Populate footer elements from config
    renderSponsorCarousel(
      (_config.monetization || {}).sponsors || [],
      embed.channel
    );
    renderFooterDisclosure((_config.monetization || {}).affiliate_disclosure || '');

    // Check live status
    let isLive = false;
    const clientId = api.twitch_client_id;

    if (!clientId || clientId === 'YOUR_TWITCH_CLIENT_ID_HERE') {
      console.warn('[EmbedEngine] Twitch Client ID not configured. Showing offline state.');
      isLive = false;
      _showApiError();
    } else {
      isLive = await checkStreamStatus(embed.channel, clientId, api.twitch_api_base);
    }

    if (isLive) {
      renderLivePlayer(embed);
    } else {
      renderOfflinePlaceholder(_config);
    }
  }

  // Run after DOM is ready (script has `defer` in HTML)
  document.addEventListener('DOMContentLoaded', init);

  // Expose minimal public API for other modules
  window.StreamEmbed = { init };

})();
