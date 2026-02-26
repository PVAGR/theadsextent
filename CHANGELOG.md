# Changelog

All notable changes to this project are documented in this file.  
This project follows [Semantic Versioning](https://semver.org/) and
[Conventional Commits](https://www.conventionalcommits.org/).

---

## [1.0.0] — 2026-02-26

### Added

#### Module 1: Universal Embed Engine
- `index.html` — main embed page with 16:9 responsive player container
- `src/js/embed-engine.js` — live/offline detection, dynamic Twitch parent-domain injection, interstitial pre-roll, schedule and VOD link rendering
- `src/js/api-handler.js` — Twitch API integration with exponential backoff, cached Last Known Status fallback

#### Module 2: Monetization Suite
- `src/js/monetization.js` — affiliate link rotator with UTM tracking, tip jar modal (PayPal + Stripe), donation goal progress bar, sponsor bar with expiry management, A/B test for donate button colour
- FTC-compliant affiliate disclosure rendered automatically

#### Module 3: Analytics & Research Logger
- `src/js/analytics-logger.js` — privacy-compliant event logger using `navigator.sendBeacon`; SHA-256 hashed session IDs, no PII collected
- GDPR/CCPA cookie consent banner; analytics only fire after user accepts
- `netlify/functions/log.js` — serverless analytics endpoint with rate limiting (100 req/hr/IP), payload size enforcement, PII field stripping

#### Module 4: CI/CD Pipeline
- `.github/workflows/deploy.yml` — GitHub Actions workflow: lint → test → deploy to GitHub Pages on `main` push; scheduled health check every 5 minutes

#### Module 5: Security & Compliance
- Content-Security-Policy meta tag on all pages
- All outbound links use `rel="noopener noreferrer"`; affiliate links additionally use `rel="sponsored"`
- Secrets managed via environment variables (never in source)
- `netlify/functions/stream-status.js` — Twitch API proxy that hides credentials from client

#### Module 6: Infrastructure
- `config.json` — centralised configuration for channel, affiliates, donations, analytics, A/B tests
- `privacy-policy.html` — GDPR/CCPA compliant policy page covering analytics, affiliate disclosure, and user rights
- `src/css/main-styles.css` — mobile-first dark theme, WCAG 2.1 AA contrast, keyboard navigation, ARIA labels
- `package.json`, `.eslintrc.cjs` — ESLint + Jest tooling
- `tests/log.test.js` — 8 unit tests covering the analytics endpoint
- `.gitignore` — excludes `node_modules`, `.env`, build artefacts
- `README.md` — full setup guide, project structure, security notes, troubleshooting

---

*End of Changelog*
