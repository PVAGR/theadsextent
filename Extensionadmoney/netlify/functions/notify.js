/**
 * @file netlify/functions/notify.js
 * @description Go-live notification dispatcher.
 *
 * POST /.netlify/functions/notify
 * Body: { secret: string, channel?: string }
 *
 * Fires notifications to all configured destinations:
 *  - Discord webhook
 *  - (extensible: Twitter/X, Slack, email)
 *
 * Environment variables required:
 *  NOTIFY_SECRET      – shared secret to authorize trigger calls (set from go-live.html)
 *  DISCORD_WEBHOOK_URL – Discord incoming webhook URL
 *  TWITCH_CHANNEL      – channel name (defaults to "ricktaur")
 *  SITE_URL            – public base URL of the embed site (e.g. https://yoursite.netlify.app)
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async function (event) {
  // Handle preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  // Parse body
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  // Authorization: require NOTIFY_SECRET to match
  const secret = process.env.NOTIFY_SECRET;
  if (secret && body.secret !== secret) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const channel  = process.env.TWITCH_CHANNEL || "ricktaur";
  const siteUrl  = (process.env.SITE_URL || "").replace(/\/$/, "");
  const liveUrl  = `${siteUrl}/live-now.html`;
  const embedUrl = `${siteUrl}/index.html`;
  const streamUrl = `https://www.twitch.tv/${channel}`;

  const results = [];

  // ── Discord ───────────────────────────────────────────────────────────────
  const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
  if (discordWebhook) {
    try {
      const discordPayload = {
        username: `${channel} Stream Bot`,
        avatar_url: `https://static-cdn.jtvnw.net/jtv_user_pictures/${channel}-profile_image-300x300.png`,
        content: `@everyone 🔴 **${channel} is LIVE!**`,
        embeds: [
          {
            title: `${channel} is live on Twitch!`,
            url: streamUrl,
            color: 0x9146ff, // Twitch purple
            description: body.title
              ? `🎮 **${body.title}**\n\nJoin the stream now!`
              : "Join the stream now!",
            fields: [
              {
                name: "Watch Live",
                value: `[Open Twitch](${streamUrl})`,
                inline: true,
              },
              {
                name: "Embed Page",
                value: `[Live Now Page](${liveUrl})`,
                inline: true,
              },
            ],
            image: body.thumbnailUrl
              ? { url: body.thumbnailUrl }
              : undefined,
            footer: {
              text: "PVA Bazaar Stream System",
            },
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const discordRes = await fetch(discordWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordPayload),
      });

      results.push({
        destination: "discord",
        status: discordRes.ok ? "sent" : "error",
        httpStatus: discordRes.status,
      });
    } catch (err) {
      results.push({ destination: "discord", status: "error", message: err.message });
    }
  } else {
    results.push({ destination: "discord", status: "skipped", reason: "DISCORD_WEBHOOK_URL not set" });
  }

  // ── Extensibility placeholder: add Slack, email, etc. here ───────────────

  return {
    statusCode: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({
      fired: true,
      channel,
      liveUrl,
      notifications: results,
      firedAt: new Date().toISOString(),
    }),
  };
};
