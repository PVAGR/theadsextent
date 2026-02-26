# PVA Bazaar Stream Ecosystem

> Automated streaming infrastructure and monetization engine for the **ricktaur** Twitch channel.  
> Version: 1.0.0 | Author: Ricktaur | License: Private

---

## ✨ Features

| Module | Description |
|---|---|
| **Universal Embed Engine** | Live/Offline detection via Twitch API, dynamic parent-domain injection, 16:9 responsive player |
| **Offline Placeholder** | Schedule, VOD links, Notify Me button, affiliate carousel |
| **Chat Integration** | Responsive Twitch chat panel, collapses on mobile |
| **Monetization Suite** | Affiliate rotator (with UTM tracking), donation modal, sponsor bar, goal progress bar |
| **Analytics Logger** | Privacy-compliant event logging via `sendBeacon`, GDPR/CCPA cookie consent |
| **CI/CD Pipeline** | GitHub Actions: lint → test → deploy to GitHub Pages on every push to `main` |
| **Serverless Functions** | Netlify Functions: `/api/stream-status` (Twitch proxy), `/api/log` (analytics) |

---

## 🚀 Quick Start (< 15 minutes)

### 1. Clone & Configure

```bash
git clone https://github.com/PVAGR/theadsextent.git
cd theadsextent
```

Open `config.json` and update:

```json
{
  "embed": {
    "channel": "YOUR_TWITCH_CHANNEL",
    "offline_message": "Next stream at 8 PM EST!"
  },
  "monetization": {
    "affiliates": [ ... ],
    "donation": {
      "paypal_button_id": "YOUR_PAYPAL_BUTTON_ID",
      "stripe_payment_link": "https://buy.stripe.com/YOUR_LINK"
    }
  }
}
```

### 2. Set Environment Variables

**Never commit secrets.** Use GitHub Secrets or a `.env` file (gitignored):

| Variable | Description |
|---|---|
| `TWITCH_CLIENT_ID` | Your Twitch Developer application Client ID |
| `TWITCH_CLIENT_SECRET` | Your Twitch Developer application Client Secret |

In Netlify: **Site Settings → Environment variables**.  
In GitHub Actions: **Settings → Secrets and variables → Actions**.

### 3. Deploy

#### GitHub Pages (static embed)
Push to `main` — GitHub Actions handles everything automatically.

#### Netlify (serverless functions)
1. Connect your GitHub repo to Netlify.
2. Set build command: *(none — static site)*.
3. Set publish directory: `.` (repository root).
4. Add environment variables in Netlify dashboard.

---

## 📁 Project Structure

```
theadsextent/
├── index.html                  # Main embed page (Universal Embed Engine)
├── privacy-policy.html         # GDPR/CCPA compliant privacy policy
├── config.json                 # Centralised configuration
├── package.json                # Node.js tooling (lint, test)
│
├── src/
│   ├── css/
│   │   └── main-styles.css     # Mobile-first dark theme (WCAG 2.1 AA)
│   └── js/
│       ├── main.js             # Application bootstrap
│       ├── api-handler.js      # Twitch API with exponential backoff
│       ├── embed-engine.js     # Live/offline logic, parent domain injection
│       ├── monetization.js     # Affiliate rotator, tip jar, sponsor bar
│       └── analytics-logger.js # Privacy-compliant event logging
│
├── netlify/
│   └── functions/
│       ├── stream-status.js    # Twitch API proxy (hides secrets)
│       └── log.js              # Analytics logging endpoint
│
├── tests/
│   └── log.test.js             # Unit tests for serverless functions
│
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI: lint → test → deploy
│
├── .gitignore
├── .eslintrc.cjs
└── README.md
```

---

## 🧪 Local Development

```bash
npm install          # Install dev tools (ESLint, Jest)
npm run lint         # Lint all JS files
npm test             # Run unit tests
npm run audit        # Security audit
```

To test the embed locally, serve the project root with any static server:

```bash
npx serve .          # Serves at http://localhost:3000
```

> **Note:** The Twitch player requires `localhost` to be registered as an allowed parent domain in your [Twitch Developer Console](https://dev.twitch.tv/console/apps).

---

## 🔒 Security

- **CSP Headers** — strict Content-Security-Policy restricts scripts, frames, and connections.
- **Secrets** — all API keys are stored in environment variables; `.env` is gitignored.
- **Rate Limiting** — analytics endpoint enforces 100 requests/hour per IP.
- **Input Sanitisation** — all dynamic content uses `textContent` (not `innerHTML`). `_escapeHtml` used for attributes.
- **Dependency Audit** — `npm audit` runs on every CI push.

---

## 📊 Analytics Events

All events are anonymised (no IP, name, or email). Consent is required before any logging.

| Event | Data |
|---|---|
| `embed_loaded` | timestamp, domain, device type |
| `stream_status_change` | live: true/false |
| `affiliate_click` | product_id |
| `donation_initiated` | currency |
| `time_watched` | seconds |
| `bounce` | seconds (< 10) |

---

## 📋 FTC Compliance

All affiliate links include:
- `rel="sponsored noopener noreferrer"` attribute
- UTM parameters: `?utm_source=embed&utm_medium=affiliate&utm_campaign=ricktaur`
- Visible disclosure: *"As an Amazon Associate and affiliate partner, I earn from qualifying purchases."*

---

## ⚠️ Terms of Service Compliance

This project strictly adheres to:
- Twitch Developer Agreement (no metric manipulation, no view botting)
- FTC Affiliate Disclosure Guidelines
- GDPR / CCPA data privacy regulations
- GitHub Acceptable Use Policies

**PROHIBITED:** Any feature that simulates viewers, inflates viewer counts, automates fake chat, or manipulates platform metrics is strictly forbidden and will not be implemented.

---

## 🔧 Troubleshooting

| Problem | Solution |
|---|---|
| **Embed not loading** | Check `parent` param; add domain to Twitch Developer Console |
| **API key invalid** | Verify `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` env vars |
| **Affiliate links not tracking** | Check UTM params are appended; disable ad blocker for testing |
| **Analytics not logging** | Check Netlify function logs; ensure user accepted cookie consent |
| **CORS errors** | Verify serverless function URL matches in `api-handler.js` |

---

## ⚠️ Known Limitations

- **Analytics persistence** — `netlify/functions/log.js` currently logs events to Netlify function stdout only. Wire up a Supabase client (or another store) in that file's TODO block before using in production. Events are never lost silently; they are safely discarded if the endpoint is unreachable and the user hasn't consented.

---

## 📈 Roadmap

- [ ] Admin dashboard (`/admin`) with JWT auth
- [ ] Supabase integration for persistent analytics storage
- [ ] PDF sponsor report generator
- [ ] Multi-channel URL parameter support (`?channel=ricktaur`)
- [ ] Dockerised local development environment

---

## 📄 License

Private — all rights reserved. © PVA Bazaar / ricktaur.
