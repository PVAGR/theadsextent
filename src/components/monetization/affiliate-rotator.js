/**
 * affiliate-rotator.js
 * Affiliate Link Rotator for the PVA Bazaar Stream Ecosystem.
 *
 * Responsibilities:
 *  - Read affiliate products from config.json
 *  - Render product cards inside #affiliate-rotator
 *  - Rotate the featured/highlighted card every 60 seconds
 *  - Append UTM parameters to all outbound links
 *  - Display the FTC affiliate disclosure from config
 *  - Track click events via the analytics logger
 *
 * @version 1.0.0
 * @author  PVA Bazaar / ricktaur
 */

(function () {
  'use strict';

  // ----------------------------------------------------------------
  // CONSTANTS
  // ----------------------------------------------------------------
  /** @constant {number} ROTATION_INTERVAL_MS - Product highlight rotation period */
  const ROTATION_INTERVAL_MS = 60_000;

  /** @constant {string} UTM_SOURCE */
  const UTM_SOURCE   = 'embed';
  /** @constant {string} UTM_MEDIUM */
  const UTM_MEDIUM   = 'affiliate';

  // ----------------------------------------------------------------
  // MODULE STATE
  // ----------------------------------------------------------------
  let _products     = [];
  let _channel      = 'ricktaur';
  let _currentIndex = 0;
  let _rotationTimer = null;

  // ----------------------------------------------------------------
  // URL HELPERS
  // ----------------------------------------------------------------

  /**
   * Append UTM parameters to a URL for affiliate tracking.
   * @param {string} baseUrl  - Original affiliate URL
   * @param {string} channel  - Twitch channel name (used as campaign)
   * @returns {string}        - URL with UTM params appended
   */
  function _appendUtm(baseUrl, channel) {
    try {
      const url = new URL(baseUrl);
      url.searchParams.set('utm_source',   UTM_SOURCE);
      url.searchParams.set('utm_medium',   UTM_MEDIUM);
      url.searchParams.set('utm_campaign', channel);
      return url.toString();
    } catch (_) {
      // If URL parsing fails, append as query string fallback
      const sep = baseUrl.includes('?') ? '&' : '?';
      return `${baseUrl}${sep}utm_source=${UTM_SOURCE}&utm_medium=${UTM_MEDIUM}&utm_campaign=${encodeURIComponent(channel)}`;
    }
  }

  /**
   * Sanitise a string for safe use in HTML attribute values.
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

  /**
   * Sanitise a string for safe insertion as text content.
   * @param {string} str
   * @returns {string}
   */
  function _sanitizeText(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
  }

  // ----------------------------------------------------------------
  // RENDERING
  // ----------------------------------------------------------------

  /**
   * Render all product cards into the #affiliate-rotator container.
   * Each card is a link with UTM-tagged href, image, title, and price.
   */
  function _renderCards() {
    const container = document.getElementById('affiliate-rotator');
    if (!container || !_products.length) return;

    container.innerHTML = _products.map((product, index) => {
      const trackedUrl = _appendUtm(product.link, _channel);
      return `
        <article class="affiliate-card${index === _currentIndex ? ' affiliate-card--featured' : ''}"
                 data-product-id="${_sanitizeAttr(product.id)}"
                 id="affiliate-card-${_sanitizeAttr(product.id)}">
          <a href="${_sanitizeAttr(trackedUrl)}"
             target="_blank"
             rel="noopener sponsored"
             aria-label="${_sanitizeAttr(product.title)} – ${_sanitizeAttr(product.price)}"
             class="affiliate-card__link"
             data-product-id="${_sanitizeAttr(product.id)}"
             data-event="affiliate_click">
            <img class="affiliate-card__img"
                 src="${_sanitizeAttr(product.image)}"
                 alt="${_sanitizeAttr(product.title)}"
                 width="200"
                 height="150"
                 loading="lazy" />
            <div class="affiliate-card__body">
              <p class="affiliate-card__title">${_sanitizeText(product.title)}</p>
              <p class="affiliate-card__price">${_sanitizeText(product.price)}</p>
            </div>
          </a>
        </article>`;
    }).join('');

    _attachClickTracking(container);
  }

  /**
   * Highlight the card at the current rotation index.
   * Adds/removes the `affiliate-card--featured` CSS class.
   */
  function _highlightCurrentCard() {
    const cards = document.querySelectorAll('.affiliate-card');
    cards.forEach((card, i) => {
      card.classList.toggle('affiliate-card--featured', i === _currentIndex);
    });
  }

  // ----------------------------------------------------------------
  // DISCLOSURE
  // ----------------------------------------------------------------

  /**
   * Render the FTC affiliate disclosure text.
   * @param {string} text
   */
  function _renderDisclosure(text) {
    const el = document.getElementById('affiliate-disclosure');
    if (el && text) el.textContent = text;
  }

  // ----------------------------------------------------------------
  // ROTATION TIMER
  // ----------------------------------------------------------------

  /**
   * Advance the featured card index and update the DOM.
   * Wraps around to index 0 after the last product.
   */
  function _rotate() {
    if (!_products.length) return;
    _currentIndex = (_currentIndex + 1) % _products.length;
    _highlightCurrentCard();
  }

  /**
   * Start the auto-rotation interval.
   */
  function _startRotation() {
    if (_rotationTimer) clearInterval(_rotationTimer);
    _rotationTimer = setInterval(_rotate, ROTATION_INTERVAL_MS);
  }

  // ----------------------------------------------------------------
  // CLICK TRACKING
  // ----------------------------------------------------------------

  /**
   * Attach click event listeners to all affiliate card links.
   * Fires an analytics event via StreamLogger if available.
   *
   * @param {HTMLElement} container - Parent container element
   */
  function _attachClickTracking(container) {
    const links = container.querySelectorAll('[data-event="affiliate_click"]');
    links.forEach(link => {
      link.addEventListener('click', function () {
        const productId = this.getAttribute('data-product-id');
        if (window.StreamLogger) {
          window.StreamLogger.log('affiliate_click', {
            product_id: productId,
            timestamp:  Date.now(),
          });
        }
      });
    });
  }

  // ----------------------------------------------------------------
  // INIT
  // ----------------------------------------------------------------

  /**
   * Initialise the affiliate rotator.
   * Reads configuration from config.json, renders cards, and starts rotation.
   */
  async function init() {
    try {
      const res = await fetch('config.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const cfg = await res.json();

      _channel  = (cfg.embed && cfg.embed.channel) || 'ricktaur';
      _products = (cfg.monetization && cfg.monetization.affiliates) || [];

      const disclosure = (cfg.monetization && cfg.monetization.affiliate_disclosure) || '';

      _renderDisclosure(disclosure);
      _renderCards();

      if (_products.length > 1) {
        _startRotation();
      }

    } catch (err) {
      console.error('[AffiliateRotator] Failed to initialise:', err.message);
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  // Expose for external use
  window.AffiliateRotator = { init };

})();
