/**
 * @file netlify/functions/revenue.js
 * @description Revenue and activity aggregation endpoint.
 *
 * GET  /.netlify/functions/revenue          – returns aggregated stats
 * POST /.netlify/functions/revenue          – increments a counter (called from log.js)
 *
 * Uses Netlify Blobs for persistence (available in Netlify runtime v2+).
 * Falls back to in-process counters (resets on cold start) if Blobs is unavailable.
 *
 * Environment variables:
 *   REVENUE_SECRET – optional bearer token to gate the GET endpoint
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** Attempt to import Netlify Blobs – available in Netlify runtime. */
async function getStore() {
  try {
    const { getStore } = await import("@netlify/blobs");
    return getStore("pva-bazaar-revenue");
  } catch {
    return null;
  }
}

/** Read aggregate JSON from the blob store. */
async function readAggregates(store) {
  if (!store) return defaultAggregates();
  try {
    const raw = await store.get("aggregates", { type: "json" });
    return raw || defaultAggregates();
  } catch {
    return defaultAggregates();
  }
}

/** Write aggregate JSON to the blob store. */
async function writeAggregates(store, data) {
  if (!store) return false;
  try {
    await store.setJSON("aggregates", data);
    return true;
  } catch {
    return false;
  }
}

function defaultAggregates() {
  return {
    embedLoads: 0,
    affiliateClicks: 0,
    donationInitiations: 0,
    sponsorClicks: 0,
    vodPlays: 0,
    // Per-product affiliate click counts
    affiliateByProduct: {},
    // Per-provider donation counts
    donationsByProvider: {},
    lastUpdated: null,
  };
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  const store = await getStore();

  // ── GET: return current aggregates ────────────────────────────────────────
  if (event.httpMethod === "GET") {
    // Optional bearer token protection for revenue dashboard
    const secret = process.env.REVENUE_SECRET;
    if (secret) {
      const auth = event.headers["authorization"] || "";
      if (!auth.startsWith("Bearer ") || auth.slice(7) !== secret) {
        return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: "Unauthorized" }) };
      }
    }

    const agg = await readAggregates(store);
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(agg),
    };
  }

  // ── POST: increment a counter ──────────────────────────────────────────────
  if (event.httpMethod === "POST") {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid JSON" }) };
    }

    const { event: eventName, properties = {} } = body;
    if (!eventName) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Missing event name" }) };
    }

    const agg = await readAggregates(store);
    agg.lastUpdated = new Date().toISOString();

    switch (eventName) {
      case "embed_loaded":
        agg.embedLoads = (agg.embedLoads || 0) + 1;
        break;

      case "affiliate_click":
        agg.affiliateClicks = (agg.affiliateClicks || 0) + 1;
        if (properties.productId) {
          agg.affiliateByProduct[properties.productId] =
            (agg.affiliateByProduct[properties.productId] || 0) + 1;
        }
        break;

      case "donation_initiated":
        agg.donationInitiations = (agg.donationInitiations || 0) + 1;
        if (properties.providerId) {
          agg.donationsByProvider[properties.providerId] =
            (agg.donationsByProvider[properties.providerId] || 0) + 1;
        }
        break;

      case "sponsor_click":
        agg.sponsorClicks = (agg.sponsorClicks || 0) + 1;
        break;

      case "vod_played":
        agg.vodPlays = (agg.vodPlays || 0) + 1;
        break;

      default:
        // Unknown event – just update timestamp
        break;
    }

    await writeAggregates(store, agg);

    return {
      statusCode: 202,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ accepted: true }),
    };
  }

  return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method Not Allowed" }) };
};
