/**
 * @file netlify/functions/notify.js
 * @description Go-live notification dispatcher.
 *
 * POST /.netlify/functions/notify
 * Body: { secret: string, channel?: string, title?: string }
 *
 * Credentials priority: Netlify env vars → Blobs config (set via /setup page)
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** Load stored Blobs config (set via /setup page) as a fallback. */
async function loadBlobsConfig() {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("pva-bazaar-config");
    return (await store.get("twitch-config", { type: "json" })) || {};
  } catch { return {}; }
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  // Load Blobs config as fallback for any missing env vars
  const blobsCfg = await loadBlobsConfig();

  // Resolve each secret: env var wins, then Blobs, then null
  const notifySecret   = process.env.NOTIFY_SECRET        || blobsCfg.notifySecret   || null;
  const discordWebhook = process.env.DISCORD_WEBHOOK_URL  || blobsCfg.discordWebhook || null;
  const channel        = process.env.TWITCH_CHANNEL       || blobsCfg.channel        || "ricktaur";
  const siteUrl        = (process.env.SITE_URL || "https://extensionadmoney.netlify.app").replace(/\/$/, "");

  // Authorization
  if (notifySecret && body.secret !== notifySecret) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const liveUrl   = `${siteUrl}/live-now.html`;
  const streamUrl = `https://www.twitch.tv/${channel}`;
  const results   = [];

  // ── Discord ───────────────────────────────────────────────────────────────
  if (discordWebhook) {
    try {
      const discordPayload = {
        username:   `${channel} Stream Bot`,
        avatar_url: `https://static-cdn.jtvnw.net/jtv_user_pictures/${channel}-profile_image-300x300.png`,
        content:    `@everyone 🔴 **${channel} is LIVE!**`,
        embeds: [{
          title:       `${channel} is live on Twitch!`,
          url:         streamUrl,
          color:       0x9146ff,
          description: body.title ? `🎮 **${body.title}**\n\nJoin the stream now!` : "Join the stream now!",
          fields: [
            { name: "Watch Live",  value: `[Open Twitch](${streamUrl})`,  inline: true },
            { name: "Embed Page",  value: `[Live Now Page](${liveUrl})`,  inline: true },
          ],
          footer:    { text: "PVA Bazaar Stream System" },
          timestamp: new Date().toISOString(),
        }],
      };

      const res = await fetch(discordWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordPayload),
      });
      results.push({ destination: "discord", status: res.ok ? "sent" : "error", httpStatus: res.status });
    } catch (err) {
      results.push({ destination: "discord", status: "error", message: err.message });
    }
  } else {
    results.push({ destination: "discord", status: "skipped", reason: "Discord webhook not configured. Add via /setup." });
  }

  // ── Ping all embedded widgets to refresh instantly ────────────────────────
  try {
    await fetch(`${siteUrl}/.netlify/functions/ping`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ secret: body.secret }),
    });
    results.push({ destination: "widget-ping", status: "sent" });
  } catch (err) {
    results.push({ destination: "widget-ping", status: "error", message: err.message });
  }

  return {
    statusCode: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ fired: true, channel, liveUrl, notifications: results, firedAt: new Date().toISOString() }),
  };
};
