# PVA Bazaar Universal Stream Embed (ricktaur)

Owner-controlled, Twitch-compliant stream embed and monetization scaffold for the **PVA Bazaar / ricktaur** ecosystem.  
Static frontend (GitHub Pages friendly) + serverless backend (Netlify Functions) + research-ready analytics hooks.

## Features (Phase 1)

- **Universal Embed Engine**
  - Live/offline detection for the `ricktaur` Twitch channel via a secure Netlify proxy.
  - Responsive 16:9 player container with dark, Twitch-native styling.
  - Offline state with calls-to-action to follow and watch VODs.
- **Privacy-Conscious Analytics Stub**
  - `embed_loaded` event logged via `navigator.sendBeacon` to a Netlify Function.
  - No IPs, emails, or PII stored; payload is event + timestamp + coarse properties.
- **Owner-Friendly Infra**
  - Static `index.html` suitable for GitHub Pages or any static host.
  - Netlify Functions for `/stream-status` and `/log` under `/.netlify/functions/*`.

This repo intentionally avoids any metric manipulation (no viewbots, fake chat, or inflation).

## Directory Structure

- `index.html` – Universal Embed page (Twitch iframe + overlays).
- `embed-engine.js` – Frontend logic for live/offline handling and analytics beacons.
- `config.json` – Central configuration (embed, Twitch, analytics).
- `netlify/functions/stream-status.js` – Twitch live/offline proxy (server-side).
- `netlify/functions/log.js` – Analytics/event logger stub (server-side).
- `src/components/embed` – Future embed subcomponents.
- `src/components/monetization` – Future monetization suite.
- `src/components/analytics` – Future research dashboards.

## Configuration

Edit `config.json`:

- **Embed**
  - `embed.channel` – Twitch channel name (default `ricktaur`).
  - `embed.autoplay` – Whether the player should try to autoplay (muted).
  - `embed.muted` – Start muted (recommended for browser policies).
  - `embed.offlineMessage` – Offline placeholder message.
- **Twitch**
  - `twitch.statusProxyEndpoint` – Should remain `/.netlify/functions/stream-status` for Netlify.
  - `twitch.clientId` – Placeholder only (real ID should live in env vars on Netlify).
- **Analytics**
  - `analytics.loggingEnabled` – Toggle analytics beacon.
  - `analytics.beaconEndpoint` – `/.netlify/functions/log`.

> For production: keep real client secrets in environment variables, not committed JSON.

## Environment Variables (Netlify)

Configure these in your Netlify project settings:

- `TWITCH_CLIENT_ID` – From your Twitch Developer application.
- `TWITCH_CLIENT_SECRET` – From your Twitch Developer application.
- `TWITCH_CHANNEL` – Defaults to `ricktaur` if omitted.

## Local Development

1. Install a simple static server (if you don’t already have one):

   ```bash
   npm install -g serve
   ```

2. Run a local static server from the project root:

   ```bash
   serve .
   ```

3. In parallel, run Netlify dev (if using Netlify CLI) so functions are mounted under `/.netlify/functions/*`:

   ```bash
   npm install -g netlify-cli
   netlify dev
   ```

4. Visit the URL Netlify dev prints (usually `http://localhost:8888/index.html`) to test:
   - Spinner → then either live player or offline placeholder.
   - Network tab should show calls to:
     - `/.netlify/functions/stream-status`
     - `/.netlify/functions/log` (from the `embed_loaded` analytics beacon)

## Deployment

### 1. GitHub Pages (static embed)

1. Initialize a Git repo and push:

   ```bash
   git init
   git add .
   git commit -m "chore: scaffold universal embed engine"
   git branch -M main
   git remote add origin git@github.com:<your-username>/<repo-name>.git
   git push -u origin main
   ```

2. In GitHub → **Settings → Pages**:
   - Source: **Deploy from a branch**.
   - Branch: `main` / root.

Your embed will be live at:

```text
https://<your-username>.github.io/<repo-name>/index.html
```

Embed it on owned sites:

```html
<iframe
  src="https://<your-username>.github.io/<repo-name>/index.html"
  width="100%"
  height="600"
  frameborder="0"
  scrolling="no"
></iframe>
```

### 2. Netlify (functions + static)

1. Create a new site on Netlify from this GitHub repo.
2. Set environment variables:
   - `TWITCH_CLIENT_ID`
   - `TWITCH_CLIENT_SECRET`
   - `TWITCH_CHANNEL` (optional, defaults to `ricktaur`)
3. Build command: `npm run build` (or `npm run build` placeholder if you’re just serving static).
4. Publish directory: root (`/`) or `dist` depending on your build.

Netlify will host both:

- `index.html` and other static assets.
- `/.netlify/functions/stream-status`
- `/.netlify/functions/log`

## Testing Checklist

- **Live/Offline Detection**
  - Temporarily log the `status` object in `embed-engine.js` to verify correct `live` flag.
- **Analytics Beacon**
  - Open DevTools → Network → filter by `log` and confirm POST / 202 response.
- **Mobile**
  - Use Chrome DevTools device toolbar to ensure:
    - Player is fully visible and touch-friendly.
    - CTA and footer remain usable on small screens.

## Next Phases

- Affiliate link rotator module under `src/components/monetization`.
- Donation / Tip Jar UI and provider wiring (PayPal / Stripe Links).
- Richer analytics (time watched, bounce rate, A/B flags) with Supabase or similar.
- Admin dashboard (`/admin`) for revenue and research views.

