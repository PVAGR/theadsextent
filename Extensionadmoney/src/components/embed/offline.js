/**
 * @file src/components/embed/offline.js
 * @description Offline placeholder component shown when the stream is not live.
 */

import { getParentDomain } from "./player.js";

/**
 * Render an offline placeholder into a container.
 * @param {HTMLElement} container
 * @param {{ channel: string, offlineMessage?: string }} opts
 */
export function renderOffline(container, { channel, offlineMessage = "Check back soon for the next live session." } = {}) {
  if (!container) return;

  container.innerHTML = `
    <div class="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-4">
      <span class="inline-flex items-center gap-2 rounded-full bg-red-600/20 text-red-400 border border-red-600/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
        Stream Offline
      </span>
      <h2 class="text-lg sm:text-xl font-semibold text-gray-50">
        Follow ${channel} for the next live session
      </h2>
      <p class="text-sm text-gray-300 max-w-md">${offlineMessage}</p>
      <div class="flex flex-wrap gap-3 justify-center mt-2">
        <a
          href="https://www.twitch.tv/${encodeURIComponent(channel)}"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-full bg-twitch text-white px-4 py-2 text-sm font-semibold shadow shadow-twitch/40 hover:bg-twitch/90 transition"
        >
          Notify me on Twitch
        </a>
        <a
          href="https://www.twitch.tv/${encodeURIComponent(channel)}/videos"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-full border border-neutral-600 px-4 py-2 text-sm text-gray-200 hover:bg-neutral-800 transition"
        >
          Watch recent VODs
        </a>
      </div>
    </div>`;
}
