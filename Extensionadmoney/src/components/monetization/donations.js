/**
 * @file src/components/monetization/donations.js
 * @description Donation goal tracker and Tip Jar modal component.
 */

/**
 * @typedef {Object} DonationProvider
 * @property {string} id
 * @property {string} label
 * @property {string} url
 */

/**
 * @typedef {Object} DonationsConfig
 * @property {string} goalLabel
 * @property {number} goalCurrent
 * @property {number} goalTarget
 * @property {DonationProvider[]} providers
 */

/**
 * Format a number as USD currency.
 * @param {number} n
 * @returns {string}
 */
function formatUSD(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/**
 * Initialize the donation goal bar and Tip Jar modal.
 *
 * @param {{
 *   goalLabelId: string,
 *   progressId: string,
 *   amountsId: string,
 *   openBtnId: string,
 *   backdropId: string,
 *   closeBtnId: string,
 *   providersId: string,
 * }} elementIds
 * @param {DonationsConfig} donations
 * @param {function(string, Record<string, unknown>): void} onEvent - Analytics callback.
 */
export function initDonations(elementIds, donations, onEvent = () => {}) {
  if (!donations) return;

  const labelEl    = document.getElementById(elementIds.goalLabelId);
  const progressEl = document.getElementById(elementIds.progressId);
  const amountsEl  = document.getElementById(elementIds.amountsId);
  const openBtn    = document.getElementById(elementIds.openBtnId);
  const backdrop   = document.getElementById(elementIds.backdropId);
  const closeBtn   = document.getElementById(elementIds.closeBtnId);
  const provEl     = document.getElementById(elementIds.providersId);

  const pct = donations.goalTarget > 0
    ? Math.min(100, (donations.goalCurrent / donations.goalTarget) * 100)
    : 0;

  if (labelEl)    labelEl.textContent = donations.goalLabel;
  if (progressEl) progressEl.style.width = `${pct}%`;
  if (amountsEl)  amountsEl.textContent  = `${formatUSD(donations.goalCurrent)} raised of ${formatUSD(donations.goalTarget)}`;

  if (provEl) {
    provEl.replaceChildren();
    (donations.providers || []).forEach((prov) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "w-full flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 hover:bg-neutral-800 transition text-xs";
      btn.innerHTML = `<span class="font-medium">${prov.label}</span><span class="text-[10px] text-gray-400">External</span>`;
      btn.addEventListener("click", () => {
        onEvent("donation_initiated", { providerId: prov.id });
        window.open(prov.url, "_blank", "noopener,noreferrer");
      });
      provEl.appendChild(btn);
    });
  }

  function openModal() {
    if (!backdrop) return;
    backdrop.classList.remove("hidden");
    backdrop.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    if (!backdrop) return;
    backdrop.classList.add("hidden");
    backdrop.setAttribute("aria-hidden", "true");
  }

  openBtn?.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);
  backdrop?.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
}
