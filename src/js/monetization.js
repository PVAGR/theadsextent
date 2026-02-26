/**
 * @file monetization.js
 * @description Monetization Suite: Affiliate Link Rotator, Sponsor Carousel,
 *              Donation Goal Progress Bar, and Tip Jar Modal.
 *              All outbound links are tagged with UTM parameters for tracking.
 *              FTC-compliant affiliate disclosures are rendered automatically.
 * @version 1.0.0
 */

'use strict';

import { logEvent } from './analytics-logger.js';

/** @constant {string} UTM source appended to all affiliate links */
const UTM_SOURCE   = 'embed';
/** @constant {string} UTM medium appended to all affiliate links */
const UTM_MEDIUM   = 'affiliate';
/** @constant {string} UTM campaign appended to all affiliate links */
const UTM_CAMPAIGN = 'ricktaur';

/**
 * Appends UTM tracking parameters to a URL string.
 *
 * @param {string} rawUrl - The original affiliate URL.
 * @returns {string} URL with UTM parameters appended.
 */
function _appendUtm(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.searchParams.set('utm_source',   UTM_SOURCE);
    url.searchParams.set('utm_medium',   UTM_MEDIUM);
    url.searchParams.set('utm_campaign', UTM_CAMPAIGN);
    return url.toString();
  } catch (_) {
    // If parsing fails, return original URL untouched
    return rawUrl;
  }
}

/**
 * Sanitises a plain string by escaping HTML special characters.
 * Used when setting textContent is not possible (e.g. attribute values).
 *
 * @param {string} str - Input string.
 * @returns {string} Escaped string safe to insert as HTML text.
 */
function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Builds a single affiliate card DOM element.
 *
 * @param {{ id: string, title: string, image: string, link: string,
 *           price: string, alt: string }} product - Affiliate product data.
 * @returns {HTMLAnchorElement}
 */
function _buildAffiliateCard(product) {
  const a = document.createElement('a');
  a.href      = _appendUtm(product.link);
  a.rel       = 'sponsored noopener noreferrer';
  a.target    = '_blank';
  a.className = 'affiliate-card';
  // data-id is safe as an attribute value after escaping
  a.dataset.id = _escapeHtml(product.id);
  a.setAttribute('aria-label', _escapeHtml(product.title));

  const img = document.createElement('img');
  img.src    = product.image;
  img.alt    = product.alt || product.title;
  img.loading = 'lazy';

  const body  = document.createElement('div');
  body.className = 'affiliate-card__body';

  const title = document.createElement('span');
  title.className   = 'affiliate-card__title';
  title.textContent = product.title; // textContent prevents XSS

  const price = document.createElement('span');
  price.className   = 'affiliate-card__price';
  price.textContent = product.price;

  body.appendChild(title);
  body.appendChild(price);
  a.appendChild(img);
  a.appendChild(body);

  // Track affiliate clicks for analytics
  a.addEventListener('click', () => {
    logEvent('affiliate_click', { product_id: product.id });
  });

  return a;
}

/**
 * Initialises the affiliate link rotator.
 * Renders a grid of products and rotates them on a configurable interval.
 *
 * @param {object} monetizationConfig - `config.json#monetization` object.
 */
function initAffiliateRotator(monetizationConfig) {
  const container = document.getElementById('affiliate-grid');
  if (!container) return;

  const products = monetizationConfig.affiliates || [];
  if (products.length === 0) return;

  /** @type {number} Current offset into the products array */
  let offset = 0;

  /** How many cards to show at once (max 5) */
  const PAGE_SIZE = Math.min(products.length, 5);

  /**
   * Renders the current page of affiliate cards.
   */
  function _render() {
    container.innerHTML = '';
    for (let i = 0; i < PAGE_SIZE; i++) {
      const product = products[(offset + i) % products.length];
      container.appendChild(_buildAffiliateCard(product));
    }
  }

  _render();

  // Rotate products at the configured interval
  const intervalMs = monetizationConfig.affiliate_rotation_interval_ms || 60000;
  setInterval(() => {
    offset = (offset + 1) % products.length;
    _render();
  }, intervalMs);
}

/**
 * Initialises the sponsor logo carousel in the footer bar.
 *
 * @param {object} monetizationConfig - `config.json#monetization` object.
 */
function initSponsorBar(monetizationConfig) {
  const bar = document.getElementById('sponsor-bar');
  if (!bar) return;

  const sponsors = (monetizationConfig.sponsors || []).filter((s) => {
    // Remove expired sponsors automatically
    if (!s.expires) return true;
    return new Date(s.expires) >= new Date();
  });

  if (sponsors.length === 0) {
    bar.classList.add('hidden');
    return;
  }

  const container = bar.querySelector('.sponsor-logos') || bar;

  sponsors.forEach((sponsor) => {
    const a = document.createElement('a');
    a.href      = sponsor.url;
    a.rel       = 'sponsored noopener noreferrer';
    a.target    = '_blank';
    a.className = 'sponsor-logo';
    a.setAttribute('aria-label', _escapeHtml(sponsor.name));

    const img = document.createElement('img');
    img.src    = sponsor.logo;
    img.alt    = sponsor.alt || sponsor.name;
    img.loading = 'lazy';
    img.height  = 36;

    a.appendChild(img);
    container.appendChild(a);
  });
}

/**
 * Initialises the donation goal progress bar.
 *
 * @param {object} monetizationConfig - `config.json#monetization` object.
 */
function initDonationGoal(monetizationConfig) {
  const goals = monetizationConfig.donation?.goals || [];
  if (goals.length === 0) return;

  const goal      = goals[0]; // Display first goal
  const fillEl    = document.getElementById('goal-fill');
  const textEl    = document.getElementById('goal-text');
  const labelEl   = document.getElementById('goal-label');
  const goalWrap  = document.getElementById('donation-goal');

  if (!goalWrap) return;

  const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));

  if (labelEl)  labelEl.textContent  = goal.label;
  if (fillEl)   fillEl.style.width   = `${pct}%`;
  if (textEl)   textEl.textContent   =
    `$${goal.current.toLocaleString()} / $${goal.target.toLocaleString()} (${pct}%)`;
}

/**
 * Initialises the Tip Jar modal — opens on CTA button click,
 * closes on backdrop click, Escape key, or close button.
 *
 * @param {object} monetizationConfig - `config.json#monetization` object.
 */
function initTipJarModal(monetizationConfig) {
  const triggerBtns = document.querySelectorAll('[data-open-modal="tip-jar"]');
  const backdrop    = document.getElementById('tip-jar-modal');
  const closeBtn    = backdrop?.querySelector('.modal__close');
  const paypalBtn   = document.getElementById('paypal-donate-btn');
  const stripeBtn   = document.getElementById('stripe-donate-btn');
  const options     = backdrop?.querySelectorAll('.modal__option');

  if (!backdrop) return;

  const donationCfg = monetizationConfig.donation || {};

  /** Opens the modal */
  function _open() {
    backdrop.classList.add('is-open');
    closeBtn?.focus();
    logEvent('donation_initiated', { currency: 'USD' });
  }

  /** Closes the modal */
  function _close() {
    backdrop.classList.remove('is-open');
  }

  triggerBtns.forEach((btn) => btn.addEventListener('click', _open));
  if (closeBtn)  closeBtn.addEventListener('click', _close);

  // Close on backdrop click (outside modal box)
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) _close();
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop.classList.contains('is-open')) _close();
  });

  // Amount selector
  if (options) {
    options.forEach((opt) => {
      opt.addEventListener('click', () => {
        options.forEach((o) => o.classList.remove('is-selected'));
        opt.classList.add('is-selected');
      });
    });
  }

  // PayPal link
  if (paypalBtn && donationCfg.paypal_button_id) {
    paypalBtn.addEventListener('click', () => {
      window.open(
        `https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=${encodeURIComponent(donationCfg.paypal_button_id)}`,
        '_blank',
        'noopener,noreferrer'
      );
    });
  }

  // Stripe link
  if (stripeBtn && donationCfg.stripe_payment_link) {
    stripeBtn.addEventListener('click', () => {
      window.open(donationCfg.stripe_payment_link, '_blank', 'noopener,noreferrer');
    });
  }
}

/**
 * Applies the A/B test variant for the donate button colour.
 * Group assignment is random and consistent within a session.
 *
 * @param {object} abTestConfig - `config.json#ab_test` object.
 */
function applyAbTest(abTestConfig) {
  const cfg     = abTestConfig?.donate_button_color;
  if (!cfg) return;

  const BTN_KEY = 'pva_ab_donate';
  let group     = sessionStorage.getItem(BTN_KEY);

  if (!group) {
    group = Math.random() < 0.5 ? 'a' : 'b';
    try { sessionStorage.setItem(BTN_KEY, group); } catch (_) {}
  }

  const btns = document.querySelectorAll('[data-open-modal="tip-jar"]');
  btns.forEach((btn) => {
    btn.style.backgroundColor = group === 'a' ? cfg.group_a : cfg.group_b;
    btn.dataset.abGroup = group;
  });
}

export {
  initAffiliateRotator,
  initSponsorBar,
  initDonationGoal,
  initTipJarModal,
  applyAbTest,
};
