/**
 * generate-promo.js – AI-powered stream promotion content generator
 *
 * POST /.netlify/functions/generate-promo
 * Body: { title, game, customMsg }
 *
 * Uses Claude to write ready-to-post promotional content for
 * Twitter/X, Reddit, Discord, and a short hype message.
 *
 * Requires env var: ANTHROPIC_API_KEY
 * Get a free key at: https://console.anthropic.com
 */

"use strict";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        fallback: true,
        message: "Add ANTHROPIC_API_KEY to Netlify env vars to enable AI generation.",
      }),
    };
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}

  const channel   = process.env.TWITCH_CHANNEL || "ricktaur";
  const siteUrl   = (process.env.SITE_URL || "https://extensionadmoney.netlify.app").replace(/\/$/, "");
  const liveUrl   = `${siteUrl}/live`;
  const twitchUrl = `https://www.twitch.tv/${channel}`;

  const title     = body.title     || "";
  const game      = body.game      || "";
  const customMsg = body.customMsg || "";

  const prompt = `You are a social media manager for a Twitch streamer named ${channel}.
Generate promotional go-live posts for each platform listed below.
The streamer is going live right now.
${title ? `Stream title: ${title}` : ""}
${game  ? `Game/category: ${game}` : ""}
${customMsg ? `Extra info: ${customMsg}` : ""}
Live page URL: ${liveUrl}
Twitch URL: ${twitchUrl}

Write each post to be genuinely engaging — not spammy. Use relevant gaming/streaming culture tone.
Include the live URL in each post.

Return ONLY a JSON object with these exact keys, no other text:
{
  "tweet": "...",
  "reddit_title": "...",
  "reddit_body": "...",
  "discord": "...",
  "hype": "..."
}

tweet: Under 280 chars. Punchy, includes 2-3 hashtags, link.
reddit_title: Good title for r/Twitch or relevant game subreddit post.
reddit_body: 2-3 sentences, friendly, not spammy, includes link.
discord: Short announcement for a Discord server, can use markdown bold/emoji.
hype: One short hype line (under 100 chars) to use anywhere.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    // Parse the JSON Claude returned
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Could not parse AI response");
    const posts = JSON.parse(jsonMatch[0]);

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, posts }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
