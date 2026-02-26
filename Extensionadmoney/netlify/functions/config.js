/**
 * config.js – Dynamic config endpoint
 *
 * GET /.netlify/functions/config
 *
 * Returns the site's config.json merged with any user overrides saved via
 * the /setup page (stored in Netlify Blobs under "site-config").
 * Blobs values always win over the static file defaults.
 */

"use strict";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** Recursively merge – override values win; null/undefined skip */
function deepMerge(base, override) {
  const result = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v !== null && v !== undefined &&
        typeof v === "object" && !Array.isArray(v) &&
        typeof base[k] === "object" && !Array.isArray(base[k])) {
      result[k] = deepMerge(base[k], v);
    } else if (v !== null && v !== undefined) {
      result[k] = v;
    }
  }
  return result;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  // 1. Load static config.json from this site (the base / defaults)
  let staticConfig = {};
  try {
    const siteUrl = (
      process.env.DEPLOY_URL ||
      process.env.URL ||
      process.env.SITE_URL ||
      "https://extensionadmoney.netlify.app"
    ).replace(/\/$/, "");
    const r = await fetch(`${siteUrl}/config.json`, { cache: "no-store" });
    if (r.ok) staticConfig = await r.json();
  } catch { /* use empty base on network failure */ }

  // 2. Load user overrides saved via the /setup page
  let siteOverrides = {};
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("pva-bazaar-config");
    siteOverrides = (await store.get("site-config", { type: "json" })) || {};
  } catch { /* Blobs unavailable in local dev */ }

  return {
    statusCode: 200,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(deepMerge(staticConfig, siteOverrides)),
  };
};
