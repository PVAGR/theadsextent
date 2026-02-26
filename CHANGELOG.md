# CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

---

## [1.0.0] – 2026-02-26

### Added
- **`config.json`** – Centralised configuration for channel, embed, affiliate products, sponsors, donation goals, and analytics settings. All secrets remain in environment variables and are never committed.
- **`index.html`** – Universal Embed Engine page. Includes GDPR/CCPA cookie consent banner, stream container, offline placeholder, donation modal, sponsor carousel, and footer with legal disclosures.
- **`src/styles/main-styles.css`** – Dark-mode-first, mobile-first stylesheet using CSS custom properties. Covers all UI states: loading, live player, offline placeholder, affiliate cards, donation modal, sponsor footer.
- **`src/components/embed/embed-engine.js`** – Core embed logic:
  - Queries Twitch Helix API with exponential-backoff retry (up to 5 attempts).
  - Renders Twitch Player iframe (with dynamic `parent` param) when live.
  - Renders offline placeholder with schedule, action links, and pre-roll interstitial when offline.
  - Caches last-known status in `localStorage` to handle API outages gracefully.
- **`src/components/monetization/affiliate-rotator.js`** – Affiliate link carousel:
  - Reads products from `config.json`; renders responsive product cards.
  - Rotates featured card every 60 seconds.
  - Appends UTM parameters (`utm_source=embed&utm_medium=affiliate`) to all links.
  - Displays FTC disclosure text from config.
  - Tracks clicks via `StreamLogger`.
- **`src/components/monetization/donation.js`** – Tip-jar module:
  - Renders donation goal progress bar from config values.
  - Injects PayPal and Stripe payment links (no custom payment processing).
  - Accessible modal with keyboard navigation and focus trapping.
  - Logs `donation_initiated` events (amount/currency only — no PII).
- **`src/components/analytics/logger.js`** – Privacy-compliant analytics:
  - Opt-in only; honours cookie consent banner choice.
  - Transmits events via `navigator.sendBeacon` (falls back to `fetch`).
  - Anonymous session IDs via SHA-256 hash of a random UUID.
  - Collects: event name, timestamp, domain, device type, A/B group.
  - Collects nothing on opt-out.
  - Tracks `embed_loaded`, `stream_status_change`, `affiliate_click`, `donation_initiated`, `time_watched`, `bounce_rate`.
  - A/B test group support (read from `config.json`).
- **`.github/workflows/deploy.yml`** – CI/CD pipeline:
  - Triggers on every push to `main`.
  - Runs `npm audit` security check (if `package.json` is present).
  - Deploys static site to GitHub Pages.
- **`privacy-policy.html`** – GDPR/CCPA-compliant privacy policy explaining data collection for research.
- **`terms.html`** – Standard Terms of Use with affiliate and Twitch embed disclosures.
- **`README.md`** – Full setup, configuration, and deployment guide (15-minute quickstart).

---

## [0.0.1] – 2026-02-25 (Initial repository)

### Added
- Empty repository scaffold with basic `README.md`.
