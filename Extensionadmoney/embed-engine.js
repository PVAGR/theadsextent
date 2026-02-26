/**
 * @file embed-engine.js
 * @description Core Universal Embed Engine for the PVA Bazaar Stream Ecosystem.
 * Handles Twitch live/offline detection and rendering of the appropriate state.
 * This file is intentionally framework-free (vanilla ES modules).
 */

/**
 * @typedef {Object} EmbedConfig
 * @property {string} channel
 * @property {boolean} autoplay
 * @property {boolean} muted
 * @property {boolean} chatEnabled
 * @property {string} themeColor
 * @property {string} offlineMessage
 * @property {boolean} showAffiliateCarousel
 */

/**
 * @typedef {Object} TwitchConfig
 * @property {string} apiBaseUrl
 * @property {string} channel
 * @property {string} clientId
 * @property {string} statusProxyEndpoint
 */

/**
 * @typedef {Object} AnalyticsConfig
 * @property {boolean} loggingEnabled
 * @property {string} beaconEndpoint
 * @property {boolean} cookieConsentRequired
 */

/**
 * @typedef {Object} MonetizationAffiliateConfig
 * @property {string} utmSource
 * @property {string} utmMedium
 * @property {string} utmCampaign
 * @property {number} rotationSeconds
 * @property {Array<{
 *   id: string;
 *   title: string;
 *   image: string;
 *   price: string;
 *   url: string;
 * }>} products
 */

/**
 * @typedef {Object} MonetizationDonationsConfig
 * @property {string} goalLabel
 * @property {number} goalCurrent
 * @property {number} goalTarget
 * @property {Array<{
 *   id: string;
 *   label: string;
 *   url: string;
 * }>} providers
 */

/**
 * @typedef {Object} MonetizationSponsorsConfig
 * @property {Array<{
 *   id: string;
 *   name: string;
 *   logo: string;
 *   url: string;
 *   active: boolean;
 * }>} slots
 */

/**
 * @typedef {Object} MonetizationConfig
 * @property {MonetizationAffiliateConfig} affiliate
 * @property {MonetizationDonationsConfig} donations
 * @property {MonetizationSponsorsConfig} sponsors
 */

/**
 * @typedef {Object} RootConfig
 * @property {string} version
 * @property {EmbedConfig} embed
 * @property {TwitchConfig} twitch
 * @property {AnalyticsConfig} analytics
 * @property {MonetizationConfig} monetization
 */

const CONFIG_PATH = "./config.json";

const ANALYTICS_CONSENT_KEY = "pva_bazaar_embed_analytics_consent";

/** @type {boolean} */
let analyticsConsentGranted = false;

/**
 * Read and parse the root configuration file.
 * @returns {Promise<RootConfig>}
 */
async function loadConfig() {
  const response = await fetch(CONFIG_PATH, {
    cache: "no-cache"
  });

  if (!response.ok) {
    throw new Error(`Failed to load config.json (status: ${response.status})`);
  }

  /** @type {RootConfig} */
  const json = await response.json();
  return json;
}

/**
 * Resolve the parent domain for the Twitch embed `parent` parameter.
 * @returns {string}
 */
function getParentDomain() {
  try {
    return window.location.hostname || "localhost";
  } catch {
    return "localhost";
  }
}

/**
 * Update status messaging region.
 * @param {string} message
 */
function setStatusMessage(message) {
  const el = document.getElementById("embed-status-message");
  if (el) {
    el.textContent = message;
  }
}

/**
 * Initialize the domain display.
 */
function initDomainDisplay() {
  const el = document.getElementById("embed-domain");
  if (!el) return;
  const parentDomain = getParentDomain();
  el.textContent = `Parent: ${parentDomain}`;
  el.classList.remove("hidden");
}

/**
 * Build the Twitch player iframe URL.
 * By default we attempt autoplay in muted mode (browser may block sound).
 *
 * @param {EmbedConfig} embedConfig
 * @returns {string}
 */
function buildTwitchPlayerUrl(embedConfig) {
  const parent = encodeURIComponent(getParentDomain());
  const base = "https://player.twitch.tv/";
  const params = new URLSearchParams({
    channel: embedConfig.channel,
    parent,
    autoplay: String(embedConfig.autoplay),
    muted: String(embedConfig.muted)
  });
  return `${base}?${params.toString()}`;
}

/**
 * Render the Twitch player iframe into the shell.
 * @param {EmbedConfig} embedConfig
 */
function renderLivePlayer(embedConfig) {
  const shell = document.getElementById("embed-player-shell");
  if (!shell) return;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("src", buildTwitchPlayerUrl(embedConfig));
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute("allowfullscreen", "true");
  iframe.setAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-popups"
  );
  iframe.className = "w-full h-full";
  iframe.title = `Twitch player for ${embedConfig.channel}`;

  shell.replaceChildren(iframe);
}

/**
 * Render the offline placeholder experience.
 * This is deliberately simple for phase 1 and will be expanded with schedule,
 * VOD links, and affiliate carousel in later modules.
 *
 * @param {EmbedConfig} embedConfig
 */
function renderOfflinePlaceholder(embedConfig) {
  const shell = document.getElementById("embed-player-shell");
  if (!shell) return;

  const container = document.createElement("div");
  container.className =
    "w-full h-full flex flex-col items-center justify-center gap-4 text-center px-4";

  const badge = document.createElement("span");
  badge.className =
    "inline-flex items-center gap-2 rounded-full bg-red-600/20 text-red-400 border border-red-600/40 px-3 py-1 text-xs font-semibold tracking-wide uppercase";
  badge.textContent = "Stream Offline";

  const heading = document.createElement("h2");
  heading.className = "text-lg sm:text-xl font-semibold";
  heading.textContent = `Follow ${embedConfig.channel} for the next live session`;

  const message = document.createElement("p");
  message.className = "text-sm sm:text-base text-gray-300 max-w-md";
  message.textContent = embedConfig.offlineMessage;

  const actions = document.createElement("div");
  actions.className = "flex flex-wrap items-center justify-center gap-3 mt-2";

  const notifyLink = document.createElement("a");
  notifyLink.href = "https://www.twitch.tv/" + encodeURIComponent(embedConfig.channel);
  notifyLink.target = "_blank";
  notifyLink.rel = "noopener noreferrer";
  notifyLink.className =
    "inline-flex items-center justify-center rounded-full bg-twitch text-white px-4 py-2 text-sm font-semibold shadow shadow-twitch/40 hover:bg-twitch/90 transition";
  notifyLink.textContent = "Notify me on Twitch";

  const vodsLink = document.createElement("a");
  vodsLink.href =
    "https://www.twitch.tv/" +
    encodeURIComponent(embedConfig.channel) +
    "/videos";
  vodsLink.target = "_blank";
  vodsLink.rel = "noopener noreferrer";
  vodsLink.className =
    "inline-flex items-center justify-center rounded-full border border-neutral-600 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-neutral-800 transition";
  vodsLink.textContent = "Watch recent VODs";

  actions.appendChild(notifyLink);
  actions.appendChild(vodsLink);

  container.appendChild(badge);
  container.appendChild(heading);
  container.appendChild(message);
  container.appendChild(actions);

  shell.replaceChildren(container);
}

/**
 * Fetch live status.
 *
 * PHASE 1 IMPLEMENTATION:
 * - Calls a future serverless proxy defined by twitch.statusProxyEndpoint.
 * - That proxy will safely use the real Client ID and OAuth token on the server side.
 *
 * For now, this endpoint is a stub; the shape is:
 *   GET /api/stream-status?channel=<channel>
 *   -> { live: boolean, lastCheckedAt: string }
 *
 * @param {TwitchConfig} twitch
 * @returns {Promise<{ live: boolean; lastCheckedAt?: string }>}
 */
async function fetchStreamStatus(twitch) {
  const url = new URL(twitch.statusProxyEndpoint, window.location.origin);
  url.searchParams.set("channel", twitch.channel);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Status proxy error (status: ${response.status})`);
  }

  return /** @type {Promise<{ live: boolean; lastCheckedAt?: string }>} */ (
    response.json()
  );
}

/**
 * Send a privacy-safe analytics beacon event, if enabled.
 *
 * @param {AnalyticsConfig} analytics
 * @param {string} eventName
 * @param {Record<string, unknown>} properties
 */
function sendAnalyticsEvent(analytics, eventName, properties) {
  if (!analytics || !analytics.loggingEnabled) return;
  if (!analytics.beaconEndpoint) return;
  if (analytics.cookieConsentRequired && !analyticsConsentGranted) return;

  /** @type {{ event: string; timestamp: string; properties: Record<string, unknown> }} */
  const payload = {
    event: eventName,
    timestamp: new Date().toISOString(),
    properties
  };

  const json = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    navigator.sendBeacon(analytics.beaconEndpoint, new Blob([json], { type: "application/json" }));
  } else {
    // Fallback for older browsers.
    fetch(analytics.beaconEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: json,
      keepalive: true
    }).catch((error) => {
      console.error("Failed to send analytics event:", error);
    });
  }
}

/**
 * Initialize the primary CTA button.
 * Future phases will open a Tip Jar / storefront; for now it links to Twitch.
 *
 * @param {EmbedConfig} embedConfig
 */
function initPrimaryCta(embedConfig) {
  const cta = document.getElementById("embed-primary-cta");
  if (!cta) return;

  cta.addEventListener("click", () => {
    window.open(
      "https://www.twitch.tv/" + encodeURIComponent(embedConfig.channel),
      "_blank",
      "noopener,noreferrer"
    );
  });
}

/**
 * Initialize affiliate carousel UI and rotation.
 *
 * @param {MonetizationAffiliateConfig} affiliate
 * @param {AnalyticsConfig} analytics
 */
function initAffiliateCarousel(affiliate, analytics) {
  if (!affiliate || !Array.isArray(affiliate.products) || affiliate.products.length === 0) {
    return;
  }

  const imgShell = document.getElementById("affiliate-image-shell");
  const titleEl = document.getElementById("affiliate-title");
  const priceEl = document.getElementById("affiliate-price");
  const ctaEl = document.getElementById("affiliate-cta");
  if (!imgShell || !titleEl || !priceEl || !ctaEl) return;

  /** @type {number} */
  let index = 0;

  /**
   * @param {number} idx
   */
  function render(idx) {
    const product = affiliate.products[idx];
    if (!product) return;

    imgShell.replaceChildren();
    const img = document.createElement("img");
    img.src = product.image;
    img.alt = product.title;
    img.loading = "lazy";
    img.className = "w-full h-full object-cover rounded-md";
    imgShell.appendChild(img);

    titleEl.textContent = product.title;
    priceEl.textContent = product.price;

    const url = new URL(product.url);
    url.searchParams.set("utm_source", affiliate.utmSource);
    url.searchParams.set("utm_medium", affiliate.utmMedium);
    url.searchParams.set("utm_campaign", affiliate.utmCampaign);

    ctaEl.onclick = () => {
      sendAnalyticsEvent(analytics, "affiliate_click", {
        productId: product.id,
        url: url.toString()
      });
      window.open(url.toString(), "_blank", "noopener,noreferrer");
    };
  }

  render(index);

  const intervalMs = Math.max(10, affiliate.rotationSeconds || 60) * 1000;
  window.setInterval(() => {
    index = (index + 1) % affiliate.products.length;
    render(index);
  }, intervalMs);
}

/**
 * Initialize donation goal UI and Tip Jar modal.
 *
 * @param {MonetizationDonationsConfig} donations
 * @param {AnalyticsConfig} analytics
 */
function initDonations(donations, analytics) {
  if (!donations) return;

  const labelEl = document.getElementById("donation-goal-label");
  const progressEl = document.getElementById("donation-goal-progress");
  const amountsEl = document.getElementById("donation-goal-amounts");
  const openBtn = document.getElementById("open-tip-jar");
  const backdrop = document.getElementById("tip-jar-backdrop");
  const closeBtn = document.getElementById("close-tip-jar");
  const providersEl = document.getElementById("tip-jar-providers");

  if (!labelEl || !progressEl || !amountsEl || !openBtn || !backdrop || !closeBtn || !providersEl) {
    return;
  }

  labelEl.textContent = donations.goalLabel;
  const percent =
    donations.goalTarget > 0 ? Math.min(100, (donations.goalCurrent / donations.goalTarget) * 100) : 0;
  progressEl.style.width = `${percent}%`;
  amountsEl.textContent = `${donations.goalCurrent.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  })} raised of ${donations.goalTarget.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  })}`;

  providersEl.replaceChildren();
  (donations.providers || []).forEach((provider) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "w-full flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 hover:bg-neutral-800 transition";
    btn.innerHTML = `<span class="font-medium">${provider.label}</span><span class="text-[10px] text-gray-400">External</span>`;
    btn.addEventListener("click", () => {
      sendAnalyticsEvent(analytics, "donation_initiated", {
        providerId: provider.id
      });
      window.open(provider.url, "_blank", "noopener,noreferrer");
    });
    providersEl.appendChild(btn);
  });

  function openModal() {
    backdrop.classList.remove("hidden");
    backdrop.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    backdrop.classList.add("hidden");
    backdrop.setAttribute("aria-hidden", "true");
  }

  openBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeModal();
    }
  });
}

/**
 * Initialize sponsor logo row.
 *
 * @param {MonetizationSponsorsConfig} sponsors
 * @param {AnalyticsConfig} analytics
 */
function initSponsors(sponsors, analytics) {
  if (!sponsors || !Array.isArray(sponsors.slots)) return;

  const row = document.getElementById("sponsor-row");
  if (!row) return;

  sponsors.slots
    .filter((slot) => slot.active)
    .forEach((slot) => {
      const link = document.createElement("a");
      link.href = slot.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer sponsored";
      link.className =
        "inline-flex items-center rounded-md bg-neutral-900 border border-neutral-800 px-2 py-1 hover:bg-neutral-800 transition";

      const img = document.createElement("img");
      img.src = slot.logo;
      img.alt = slot.name;
      img.loading = "lazy";
      img.className = "h-6 w-auto object-contain";

      link.appendChild(img);

      link.addEventListener("click", () => {
        sendAnalyticsEvent(analytics, "sponsor_click", {
          sponsorId: slot.id
        });
      });

      row.appendChild(link);
    });
}

/**
 * Initialize cookie consent banner and set analyticsConsentGranted.
 *
 * @param {AnalyticsConfig} analytics
 */
function initCookieConsent(analytics) {
  if (!analytics || !analytics.cookieConsentRequired) {
    analyticsConsentGranted = true;
    return;
  }

  const banner = document.getElementById("cookie-consent-banner");
  const acceptBtn = document.getElementById("cookie-accept");
  const declineBtn = document.getElementById("cookie-decline");
  if (!banner || !acceptBtn || !declineBtn) {
    analyticsConsentGranted = false;
    return;
  }

  const stored = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
  if (stored === "accepted") {
    analyticsConsentGranted = true;
    return;
  }
  if (stored === "declined") {
    analyticsConsentGranted = false;
    return;
  }

  analyticsConsentGranted = false;
  banner.classList.remove("hidden");

  acceptBtn.addEventListener("click", () => {
    analyticsConsentGranted = true;
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, "accepted");
    banner.classList.add("hidden");
  });

  declineBtn.addEventListener("click", () => {
    analyticsConsentGranted = false;
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, "declined");
    banner.classList.add("hidden");
  });
}

/**
 * Main bootstrap flow for the embed.
 */
async function bootstrapEmbed() {
  initDomainDisplay();
  setStatusMessage("Loading configuration…");

  try {
    const config = await loadConfig();
    const { embed, twitch, analytics, monetization } = config;

    initCookieConsent(analytics);
    initPrimaryCta(embed);
    initAffiliateCarousel(monetization.affiliate, analytics);
    initDonations(monetization.donations, analytics);
    initSponsors(monetization.sponsors, analytics);

    // Fire an embed_loaded event for research logging.
    sendAnalyticsEvent(analytics, "embed_loaded", {
      domain: getParentDomain(),
      deviceType: window.innerWidth < 768 ? "mobile" : "desktop",
      version: config.version
    });

    setStatusMessage("Checking live status via Twitch…");

    // In Phase 1 this will likely fall back to offline until the proxy is implemented.
    const status = await fetchStreamStatus(twitch);

    if (status.live) {
      setStatusMessage("Stream is live – loading player…");
      renderLivePlayer(embed);
    } else {
      setStatusMessage("Stream currently offline – showing alternate experience.");
      renderOfflinePlaceholder(embed);
    }
  } catch (error) {
    // Friendly fallback on any failure.
    console.error("Embed initialization error:", error);
    setStatusMessage("Unable to reach Twitch at the moment – showing offline experience.");
    try {
      const config = await loadConfig();
      renderOfflinePlaceholder(config.embed);
    } catch {
      // If config also fails, show a minimal hard-coded state.
      const shell = document.getElementById("embed-player-shell");
      if (shell) {
        const fallback = document.createElement("p");
        fallback.className = "text-sm text-gray-300 px-4 text-center";
        fallback.textContent =
          "Something went wrong while initializing the embed. Please try again later.";
        shell.replaceChildren(fallback);
      }
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapEmbed);
} else {
  bootstrapEmbed().catch((error) =>
    console.error("Failed to bootstrap embed:", error)
  );
}

