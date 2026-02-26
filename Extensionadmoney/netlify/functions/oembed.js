/**
 * oembed.js – oEmbed endpoint
 *
 * When you paste your /live link into Discord, Slack, Reddit, forums,
 * or any oEmbed-aware platform, it calls this endpoint and renders
 * your stream as a rich embedded player automatically.
 *
 * GET /.netlify/functions/oembed?url=<live-page-url>&maxwidth=800&maxheight=450
 */

"use strict";

exports.handler = async (event) => {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  const siteUrl  = process.env.SITE_URL || "https://extensionadmoney.netlify.app";
  const channel  = process.env.TWITCH_CHANNEL || "ricktaur";
  const liveUrl  = `${siteUrl}/live`;

  const maxWidth  = Math.min(Number(event.queryStringParameters?.maxwidth)  || 800,  1920);
  const maxHeight = Math.min(Number(event.queryStringParameters?.maxheight) || 450,  1080);

  // oEmbed rich response — embeds the live-now page as an iframe player
  const oembed = {
    version:        "1.0",
    type:           "rich",
    provider_name:  `${channel} on Twitch`,
    provider_url:   `https://www.twitch.tv/${channel}`,
    title:          `${channel} – Live on Twitch`,
    author_name:    channel,
    author_url:     `https://www.twitch.tv/${channel}`,
    thumbnail_url:  `https://static-cdn.jtvnw.net/jtv_user_pictures/${channel}-profile_image-300x300.png`,
    thumbnail_width:  300,
    thumbnail_height: 300,
    width:   maxWidth,
    height:  maxHeight,
    html: `<iframe src="${liveUrl}" width="${maxWidth}" height="${maxHeight}" frameborder="0" scrolling="no" allowfullscreen allow="autoplay; fullscreen"></iframe>`,
  };

  return {
    statusCode: 200,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=30" },
    body: JSON.stringify(oembed),
  };
};
