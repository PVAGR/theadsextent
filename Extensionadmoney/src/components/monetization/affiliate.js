/**
 * @file src/components/monetization/affiliate.js
 * @description Rotating affiliate product carousel component.
 */

/**
 * @typedef {Object} AffiliateProduct
 * @property {string} id
 * @property {string} title
 * @property {string} image
 * @property {string} price
 * @property {string} url
 */

/**
 * @typedef {Object} AffiliateConfig
 * @property {string} utmSource
 * @property {string} utmMedium
 * @property {string} utmCampaign
 * @property {number} rotationSeconds
 * @property {AffiliateProduct[]} products
 */

/**
 * Initialize the affiliate carousel.
 *
 * @param {{
 *   imageShellId: string,
 *   titleId: string,
 *   priceId: string,
 *   ctaId: string,
 * }} elementIds - IDs of the UI elements to update.
 * @param {AffiliateConfig} affiliate
 * @param {function(string, Record<string, unknown>): void} onClickEvent - Analytics callback.
 */
export function initAffiliateCarousel(elementIds, affiliate, onClickEvent = () => {}) {
  if (!affiliate?.products?.length) return;

  const imgShell = document.getElementById(elementIds.imageShellId);
  const titleEl = document.getElementById(elementIds.titleId);
  const priceEl = document.getElementById(elementIds.priceId);
  const ctaEl = document.getElementById(elementIds.ctaId);
  if (!imgShell || !titleEl || !priceEl || !ctaEl) return;

  let idx = 0;

  function buildUrl(product) {
    const url = new URL(product.url);
    url.searchParams.set("utm_source", affiliate.utmSource);
    url.searchParams.set("utm_medium", affiliate.utmMedium);
    url.searchParams.set("utm_campaign", affiliate.utmCampaign);
    return url.toString();
  }

  function render(i) {
    const product = affiliate.products[i];
    if (!product) return;

    imgShell.innerHTML = `<img src="${product.image}" alt="${product.title}" loading="lazy" class="w-full h-full object-cover rounded-md" />`;
    titleEl.textContent = product.title;
    priceEl.textContent = product.price;

    const url = buildUrl(product);
    ctaEl.onclick = () => {
      onClickEvent("affiliate_click", { productId: product.id, url });
      window.open(url, "_blank", "noopener,noreferrer");
    };
  }

  render(idx);

  const intervalMs = Math.max(10, affiliate.rotationSeconds || 60) * 1000;
  setInterval(() => {
    idx = (idx + 1) % affiliate.products.length;
    render(idx);
  }, intervalMs);
}
