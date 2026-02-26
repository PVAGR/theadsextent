/**
 * @file log.js
 * @description Netlify Function: privacy-conscious analytics logger for the Universal Embed Engine.
 *
 * This is an initial stub that validates payload shape and writes events to logs.
 * Storage (Supabase, S3, GitHub) can be wired in later without changing the client.
 *
 * Privacy:
 * - Does NOT store IP addresses, user agents, or any PII.
 * - Expects pre-anonymized or hashed identifiers from the client if needed.
 */

/**
 * Basic CORS headers for use as a public beacon endpoint.
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

/**
 * Validate an incoming analytics event payload.
 * This enforces the research-safe schema.
 *
 * @param {unknown} body
 * @returns {{ event: string; timestamp: string; properties: Record<string, unknown> } | null}
 */
function validateEvent(body) {
  if (!body || typeof body !== "object") return null;
  const raw = /** @type {any} */ (body);
  if (typeof raw.event !== "string") return null;
  if (typeof raw.timestamp !== "string") return null;
  const props = raw.properties && typeof raw.properties === "object" ? raw.properties : {};
  return {
    event: raw.event,
    timestamp: raw.timestamp,
    properties: props
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : null;
    const validated = validateEvent(body);
    if (!validated) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Invalid analytics payload." })
      };
    }

    // Log to Netlify function logs (always).
    console.log("Analytics event:", JSON.stringify(validated));

    // Forward to revenue aggregation function (fire-and-forget).
    // This persists counts via Netlify Blobs through the revenue function.
    try {
      const siteUrl = process.env.SITE_URL || process.env.URL || "";
      if (siteUrl) {
        const revenueUrl = `${siteUrl.replace(/\/$/, "")}/.netlify/functions/revenue`;
        fetch(revenueUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: validated.event,
            properties: validated.properties,
          }),
        }).catch((err) => console.warn("Revenue forward failed:", err.message));
      }
    } catch (fwdErr) {
      console.warn("Revenue forward error:", fwdErr.message);
    }

    return {
      statusCode: 202,
      headers: CORS_HEADERS,
      body: JSON.stringify({ received: true })
    };
  } catch (error) {
    console.error("log analytics error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Failed to log analytics event." })
    };
  }
};

