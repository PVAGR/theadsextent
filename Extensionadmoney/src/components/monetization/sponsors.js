/**
 * @file src/components/monetization/sponsors.js
 * @description Sponsor logo row component.
 */

/**
 * @typedef {Object} SponsorSlot
 * @property {string} id
 * @property {string} name
 * @property {string} logo
 * @property {string} url
 * @property {boolean} active
 */

/**
 * @typedef {Object} SponsorsConfig
 * @property {SponsorSlot[]} slots
 */

/**
 * Inject active sponsor logos into a container element.
 *
 * @param {HTMLElement | null} container - The element to append logos to.
 * @param {SponsorsConfig} sponsors
 * @param {function(string, Record<string, unknown>): void} onEvent - Analytics callback.
 */
export function initSponsors(container, sponsors, onEvent = () => {}) {
  if (!container || !sponsors?.slots?.length) return;

  sponsors.slots
    .filter((slot) => slot.active)
    .forEach((slot) => {
      const link = document.createElement("a");
      link.href = slot.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer sponsored";
      link.className = "inline-flex items-center rounded-md bg-neutral-900 border border-neutral-800 px-2 py-1 hover:bg-neutral-800 transition";

      const img = document.createElement("img");
      img.src = slot.logo;
      img.alt = slot.name;
      img.loading = "lazy";
      img.className = "h-6 w-auto object-contain";

      link.appendChild(img);
      link.addEventListener("click", () => onEvent("sponsor_click", { sponsorId: slot.id }));
      container.appendChild(link);
    });
}
