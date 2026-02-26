/**
 * @file src/components/embed/player.js
 * @description Twitch live player component.
 */

/**
 * Resolve the parent domain for Twitch embed `parent` param.
 * @returns {string}
 */
export function getParentDomain() {
  try { return window.location.hostname || "localhost"; }
  catch { return "localhost"; }
}

/**
 * Build a Twitch player URL.
 * @param {string} channel
 * @param {{ autoplay?: boolean, muted?: boolean }} [opts]
 * @returns {string}
 */
export function buildPlayerUrl(channel, { autoplay = true, muted = true } = {}) {
  const parent = encodeURIComponent(getParentDomain());
  return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${parent}&autoplay=${autoplay}&muted=${muted}`;
}

/**
 * Inject the Twitch player iframe into a container element.
 * @param {HTMLElement} container - The element to render into.
 * @param {string} channel
 * @param {{ autoplay?: boolean, muted?: boolean }} [opts]
 */
export function renderPlayer(container, channel, opts = {}) {
  if (!container) return;
  const iframe = document.createElement("iframe");
  iframe.src = buildPlayerUrl(channel, opts);
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute("allowfullscreen", "true");
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups");
  iframe.className = "absolute inset-0 w-full h-full";
  iframe.title = `Twitch player – ${channel}`;
  container.replaceChildren(iframe);
}
