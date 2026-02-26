# PVA Bazaar Stream Ecosystem

> Automated, owner-controlled streaming infrastructure for the **ricktaur** Twitch channel.  
> Designed for ethical monetisation, GDPR-compliant research logging, and zero-cost static hosting.

[![Deploy to GitHub Pages](https://github.com/PVAGR/theadsextent/actions/workflows/deploy.yml/badge.svg)](https://github.com/PVAGR/theadsextent/actions/workflows/deploy.yml)

---

## Table of Contents

1. [Overview](#overview)
2. [Repository Structure](#repository-structure)
3. [Quickstart (15 minutes)](#quickstart-15-minutes)
4. [Configuration Reference](#configuration-reference)
5. [Modules](#modules)
6. [Deployment](#deployment)
7. [Privacy & Compliance](#privacy--compliance)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance Schedule](#maintenance-schedule)
10. [Contributing & Versioning](#contributing--versioning)

---

## Overview

This repository hosts a fully static, self-owned streaming embed ecosystem. It attaches to the Twitch channel `ricktaur` and can be deployed for free on GitHub Pages.

**Dual purpose:**

| Goal | Description |
|---|---|
| Commercial | Affiliate revenue, donations, and sponsor impressions from owned web properties. |
| Academic | Longitudinal data collection for PhD research on creator-owned infrastructure. |

**Core principles:** Ownership · Compliance · No artificial view inflation.

---

## Repository Structure

```
theadsextent/
├── index.html                          # Universal Embed Engine (entry point)
├── privacy-policy.html                 # GDPR/CCPA privacy policy
├── terms.html                          # Terms of Use
├── config.json                         # Centralised configuration (no secrets)
├── CHANGELOG.md                        # Version history
├── .github/
│   └── workflows/
│       └── deploy.yml                  # CI/CD → GitHub Pages
└── src/
    ├── styles/
    │   └── main-styles.css             # Dark-mode-first responsive CSS
    └── components/
        ├── embed/
        │   └── embed-engine.js         # Live/offline detection + iframe render
        ├── monetization/
        │   ├── affiliate-rotator.js    # Affiliate carousel with UTM tracking
        │   └── donation.js             # Tip-jar modal + PayPal/Stripe links
        └── analytics/
            └── logger.js              # Privacy-compliant sendBeacon logger
```

---

## Quickstart (15 minutes)

### Prerequisites
- A GitHub account
- A Twitch Developer Application ([console.twitch.tv](https://dev.twitch.tv/console))
- (Optional) A PayPal or Stripe account for donations

### Steps

**1. Fork / clone the repository**
```bash
git clone https://github.com/PVAGR/theadsextent.git
cd theadsextent
```

**2. Create your Twitch application**
- Go to [dev.twitch.tv/console](https://dev.twitch.tv/console) → Register Your Application.
- Set OAuth Redirect URL to `http://localhost`.
- Copy your **Client ID**.

**3. Configure the system**

Open `config.json` and update:
```json
{
  "embed": {
    "channel": "YOUR_CHANNEL_NAME"
  },
  "api": {
    "twitch_client_id": "YOUR_TWITCH_CLIENT_ID_HERE"
  }
}
```

> ⚠️ **Never commit API secrets** (Client Secrets, tokens) to this file.  
> For server-side token generation, use GitHub Secrets and a Netlify/Vercel function.

**4. Update affiliate products**

Edit the `monetization.affiliates` array in `config.json` with your real product links.

**5. Deploy to GitHub Pages**

- Go to your repository **Settings → Pages → Source** → select `main` branch → `/` (root).
- Or push to `main` — the GitHub Actions workflow deploys automatically.

**6. Add your domain to Twitch**

- In [dev.twitch.tv/console](https://dev.twitch.tv/console), under your application, add your GitHub Pages URL (e.g., `yourusername.github.io`) as an **OAuth Redirect URL**.
- The embed engine reads `window.location.hostname` and injects it as the `parent` parameter automatically.

**7. Verify**

Visit your GitHub Pages URL. You should see either the live Twitch player or the offline placeholder with your schedule.

---

## Configuration Reference

All configuration lives in `config.json`. **No secrets should ever be committed here.**

| Path | Type | Description |
|---|---|---|
| `embed.channel` | string | Twitch login name |
| `embed.autoplay` | boolean | Auto-play the stream (muted) |
| `embed.muted` | boolean | Start the player muted (required for autoplay) |
| `embed.chat_enabled` | boolean | Reserved for future chat embed |
| `embed.theme_color` | string | Brand hex colour (CSS variable override) |
| `embed.offline_message` | string | Message shown when stream is offline |
| `embed.schedule` | array | `[{ day, time }]` – weekly stream schedule |
| `embed.vod_url` | string | Link to Twitch VODs |
| `embed.youtube_url` | string | Link to YouTube channel |
| `embed.follow_url` | string | Twitch follow / notify link |
| `api.twitch_client_id` | string | Twitch application Client ID |
| `api.twitch_api_base` | string | Twitch Helix API base URL |
| `monetization.donation.enabled` | boolean | Show the donation modal |
| `monetization.donation.paypal_button_id` | string | PayPal hosted button ID |
| `monetization.donation.stripe_payment_link` | string | Stripe payment link URL |
| `monetization.donation.goal_label` | string | Goal name (e.g. "New Camera Fund") |
| `monetization.donation.goal_current` | number | Amount raised so far |
| `monetization.donation.goal_target` | number | Goal amount |
| `monetization.affiliates` | array | `[{ id, title, image, link, price }]` |
| `monetization.sponsors` | array | `[{ id, name, logo, url, alt, expires }]` |
| `monetization.store_url` | string | Digital store URL |
| `analytics.enabled` | boolean | Enable analytics logging |
| `analytics.endpoint` | string | Serverless log endpoint |
| `analytics.ab_test_group` | string | `"A"` or `"B"` for A/B experiments |

---

## Modules

### Module 1 – Universal Embed Engine (`embed-engine.js`)
- Checks Twitch Helix API on page load.
- **Live:** renders Twitch iframe with the correct `parent` hostname.
- **Offline:** renders schedule, action links, pre-roll interstitial, and affiliate rotator.
- Exponential-backoff retry (up to 5 attempts) on API failure.
- Falls back to `localStorage` cached status on complete failure.

### Module 2 – Monetization Suite
- **Affiliate Rotator:** Displays 1–4 product cards; rotates featured card every 60 s; UTM-tagged links; FTC disclosure auto-populated from config.
- **Donation / Tip Jar:** Goal progress bar; PayPal & Stripe payment links; GDPR-safe (no PII stored); accessible modal.

### Module 3 – Analytics Logger (`logger.js`)
- Opt-in only (GDPR/CCPA cookie consent banner).
- Events: `embed_loaded`, `stream_status_change`, `affiliate_click`, `donation_initiated`, `time_watched`, `bounce_rate`.
- Anonymous session IDs (SHA-256 hash of random UUID).
- Transmits via `navigator.sendBeacon` → `/api/log`.
- A/B test group support.

### Module 4 – CI/CD Pipeline (`.github/workflows/deploy.yml`)
- Triggers on every push to `main`.
- Runs `npm audit` if a `package.json` is present.
- Deploys to GitHub Pages via `actions/deploy-pages`.

---

## Deployment

### GitHub Pages (recommended, free)
1. Push to `main`.
2. The workflow runs automatically and deploys to GitHub Pages.
3. Configure a custom domain in **Settings → Pages → Custom domain**.

### Local Testing
```bash
# Using Python's built-in HTTP server
python3 -m http.server 8080
# Then open http://localhost:8080
```

> The Twitch iframe requires the `parent` parameter to match the host.  
> For local testing, `localhost` is automatically detected and used.

---

## Privacy & Compliance

| Standard | Implementation |
|---|---|
| GDPR Art. 6(1)(a) | Explicit opt-in cookie consent banner before any data is collected |
| CCPA | Same opt-in mechanism; users can decline via the banner |
| FTC Affiliate Guidelines | Disclosure text auto-inserted from `config.json`; `rel="sponsored"` on all affiliate links |
| Twitch Developer Agreement | Player `parent` param injected; Twitch branding not obscured |
| Data Minimisation | No IP, no PII; only hashed session IDs and event metadata |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Embed not loading / grey box | Verify your domain is listed as the `parent` in the Twitch player URL. Check the browser console for CORS errors. |
| "Twitch Client ID not configured" warning | Set `api.twitch_client_id` in `config.json`. |
| Stream shows offline when it is live | Your Twitch Client ID may lack a valid Bearer token. Implement the OAuth Client Credentials flow in a serverless function and set the `Authorization` header in `embed-engine.js`. |
| Affiliate links not tracking | Verify UTM parameters appear in the URL. Check for ad blockers intercepting the redirect. |
| Analytics not logging | Check that the user accepted the cookie consent banner. Verify `/api/log` endpoint is reachable. |
| Donation modal shows "coming soon" | Add `paypal_button_id` or `stripe_payment_link` to `config.json`. |

---

## Maintenance Schedule

| Frequency | Task |
|---|---|
| Weekly | Review browser console error logs; verify affiliate links resolve |
| Monthly | Rotate Twitch Client Secret; review sponsor contract expiry dates in `config.json`; export analytics data backup |
| Quarterly | Run `npm audit`; review GDPR data retention (purge logs > 12 months); update documentation |

---

## Contributing & Versioning

This project uses [Semantic Versioning](https://semver.org/) and [Conventional Commits](https://www.conventionalcommits.org/).

```
feat: add new feature
fix: correct a bug
docs: documentation only
chore: maintenance task
```

See [CHANGELOG.md](CHANGELOG.md) for full version history.

---

*Built for organic growth amplification — not artificial inflation.*  
*All platform Terms of Service are strictly observed.*
