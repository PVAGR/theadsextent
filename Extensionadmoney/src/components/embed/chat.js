/**
 * @file src/components/embed/chat.js
 * @description Twitch chat embed component.
 */

import { getParentDomain } from "./player.js";

/**
 * Build a Twitch chat embed URL.
 * @param {string} channel
 * @returns {string}
 */
export function buildChatUrl(channel) {
  const parent = encodeURIComponent(getParentDomain());
  return `https://www.twitch.tv/embed/${encodeURIComponent(channel)}/chat?darkpopout&parent=${parent}`;
}

/**
 * Inject the Twitch chat iframe into a container element.
 * @param {HTMLElement} container
 * @param {string} channel
 */
export function renderChat(container, channel) {
  if (!container) return;
  const iframe = document.createElement("iframe");
  iframe.src = buildChatUrl(channel);
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute("scrolling", "no");
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-forms");
  iframe.className = "w-full h-full";
  iframe.style.height = "100%";
  iframe.title = `Twitch chat – ${channel}`;
  container.replaceChildren(iframe);
}
