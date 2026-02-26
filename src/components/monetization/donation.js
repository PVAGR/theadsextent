/**
 * donation.js
 * Donation / Tip-Jar Module for the PVA Bazaar Stream Ecosystem.
 *
 * Responsibilities:
 *  - Read donation config from config.json
 *  - Render the goal progress bar inside the modal
 *  - Inject PayPal / Stripe payment buttons
 *  - Handle modal open / close (keyboard accessible)
 *  - Log donation_initiated events via StreamLogger
 *  - Never store PII or process payments directly
 *
 * @version 1.0.0
 * @author  PVA Bazaar / ricktaur
 */

(function () {
  'use strict';

  // ----------------------------------------------------------------
  // MODULE STATE
  // ----------------------------------------------------------------
  let _donationCfg = null;

  // ----------------------------------------------------------------
  // MODAL CONTROL
  // ----------------------------------------------------------------

  /**
   * Open the donation modal and trap focus inside it.
   */
  function openModal() {
    const modal = document.getElementById('donation-modal');
    if (!modal) return;
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden'; // prevent background scroll

    // Move focus to the close button for accessibility
    const closeBtn = document.getElementById('btn-close-modal');
    if (closeBtn) closeBtn.focus();

    // Log the event
    if (window.StreamLogger) {
      window.StreamLogger.log('donation_initiated', {
        currency: (_donationCfg && _donationCfg.goal_currency) || 'USD',
      });
    }
  }

  /**
   * Close the donation modal and restore page scroll.
   */
  function closeModal() {
    const modal = document.getElementById('donation-modal');
    if (!modal) return;
    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';

    // Return focus to the trigger button
    const trigger = document.getElementById('btn-support');
    if (trigger) trigger.focus();
  }

  // ----------------------------------------------------------------
  // GOAL PROGRESS BAR
  // ----------------------------------------------------------------

  /**
   * Render the donation goal progress bar.
   * @param {Object} cfg - donation section of config.json
   */
  function _renderGoal(cfg) {
    const goalWrapper = document.getElementById('donation-goal');
    if (!goalWrapper) return;

    if (!cfg.goal_label || !cfg.goal_target) return;

    const current  = Number(cfg.goal_current)  || 0;
    const target   = Number(cfg.goal_target)   || 1;
    const currency = cfg.goal_currency || 'USD';
    const pct      = Math.min(100, Math.round((current / target) * 100));

    const labelEl   = document.getElementById('donation-goal-label');
    const fillEl    = document.getElementById('progress-fill');
    const amountsEl = document.getElementById('donation-goal-amounts');
    const barEl     = document.getElementById('progress-bar');

    if (labelEl)   labelEl.textContent = cfg.goal_label;
    if (fillEl)    fillEl.style.width  = `${pct}%`;
    if (amountsEl) amountsEl.textContent =
      `${_formatCurrency(current, currency)} raised of ${_formatCurrency(target, currency)} goal (${pct}%)`;
    if (barEl) {
      barEl.setAttribute('aria-valuenow', pct);
      barEl.setAttribute('aria-valuetext', `${pct}% of goal reached`);
    }

    goalWrapper.removeAttribute('hidden');
  }

  /**
   * Format a monetary value with currency symbol.
   * @param {number} amount
   * @param {string} currency - ISO 4217 currency code
   * @returns {string}
   */
  function _formatCurrency(amount, currency) {
    try {
      return new Intl.NumberFormat('en-US', {
        style:    'currency',
        currency: currency,
        minimumFractionDigits: 0,
      }).format(amount);
    } catch (_) {
      return `${currency} ${amount}`;
    }
  }

  // ----------------------------------------------------------------
  // PAYMENT BUTTONS
  // ----------------------------------------------------------------

  /**
   * Inject PayPal and/or Stripe payment buttons into the modal.
   * Uses platform-provided hosted buttons / payment links — no custom
   * payment processing is implemented (avoids PCI scope).
   *
   * @param {Object} cfg - donation section of config.json
   */
  function _renderPaymentButtons(cfg) {
    const container = document.getElementById('donation-buttons');
    if (!container) return;

    const buttons = [];

    if (cfg.paypal_button_id && cfg.paypal_button_id !== 'YOUR_PAYPAL_BUTTON_ID_HERE') {
      // PayPal hosted button: opens PayPal.me or button link in new tab
      const paypalUrl = `https://www.paypal.com/donate/?hosted_button_id=${encodeURIComponent(cfg.paypal_button_id)}`;
      buttons.push(`
        <a href="${_sanitizeAttr(paypalUrl)}"
           class="btn btn--primary"
           target="_blank"
           rel="noopener noreferrer"
           aria-label="Donate via PayPal">
          🅿 PayPal
        </a>`);
    }

    if (cfg.stripe_payment_link && cfg.stripe_payment_link !== 'YOUR_STRIPE_PAYMENT_LINK_HERE') {
      buttons.push(`
        <a href="${_sanitizeAttr(cfg.stripe_payment_link)}"
           class="btn btn--accent"
           target="_blank"
           rel="noopener noreferrer"
           aria-label="Donate via Stripe / Card">
          💳 Card / Stripe
        </a>`);
    }

    if (!buttons.length) {
      // No payment providers configured yet
      container.innerHTML = `
        <p style="color:var(--color-text-muted);font-size:0.9rem;">
          Payment options coming soon. Follow on
          <a href="https://www.twitch.tv/ricktaur" target="_blank" rel="noopener">Twitch</a>
          to subscribe directly.
        </p>`;
      return;
    }

    container.innerHTML = buttons.join('');
  }

  // ----------------------------------------------------------------
  // UTILITY
  // ----------------------------------------------------------------

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

  // ----------------------------------------------------------------
  // EVENT LISTENERS
  // ----------------------------------------------------------------

  /**
   * Attach close listeners to the backdrop and close button.
   */
  function _attachListeners() {
    const closeBtn  = document.getElementById('btn-close-modal');
    const backdrop  = document.getElementById('modal-backdrop');
    const modal     = document.getElementById('donation-modal');

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', closeModal);

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && !modal.hasAttribute('hidden')) {
        closeModal();
      }
    });
  }

  // ----------------------------------------------------------------
  // INIT
  // ----------------------------------------------------------------

  /**
   * Initialise the donation module.
   * Fetches config, renders goal and payment buttons, attaches listeners.
   */
  async function init() {
    try {
      const res = await fetch('config.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const cfg = await res.json();

      _donationCfg = (cfg.monetization && cfg.monetization.donation) || {};

      if (!_donationCfg.enabled) return;

      _renderGoal(_donationCfg);
      _renderPaymentButtons(_donationCfg);
      _attachListeners();

    } catch (err) {
      console.error('[Donation] Failed to initialise:', err.message);
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  // Expose public API for HTML onclick handlers
  window.StreamDonation = { openModal, closeModal };

})();
