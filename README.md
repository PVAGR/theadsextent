# PVA Bazaar Universal Stream Embed

Owner-controlled Twitch stream embed + full monetisation and go-live system for the **ricktaur** channel.

**No frameworks. No build step. Download → double-click → browser opens.**

---

## Download & Run (3 steps)

### Step 1 – Download

On GitHub, click **Code → Download ZIP**, then unzip the folder anywhere on your computer.

### Step 2 – Install Node.js (one time, if you don't have it)

Download the **LTS** version from [nodejs.org](https://nodejs.org/en/download) and install it.
You only ever do this once. After that, all future projects just work.

### Step 3 – Launch

**Windows:** Double-click `start.bat`

**Mac / Linux:**
```bash
chmod +x start.sh
./start.sh
```

**Or from any terminal:**
```bash
node server.js --open
```

Your browser opens automatically at `http://localhost:8888`.

---

## Pages

| URL | What it is |
|---|---|
| `/` | Main stream embed with affiliate footer |
| `/live` | **Shareable live page** – post this on social when you go live |
| `/go-live` | **Your private control panel** – press GO LIVE to fire Discord |
| `/admin` | Revenue + config dashboard |
| `/stream-chat.html` | Side-by-side stream + chat |
| `/embed/chat` | Chat-only panel |
| `/embed/vod` | VOD/clips player (`?video=<id>` or `?clip=<slug>`) |
| `/embed/schedule` | Stream schedule + countdown timer |
| `/widget` | Tiny live badge (drop on any website) |
| `/widget/card` | Widget card with avatar |
| `/widget/banner` | Full-width live banner |

---

## Go-Live Workflow (every stream)

1. Open `http://localhost:8888/go-live` (or `/go-live` on Netlify)
2. Enter your stream title + game
3. Press **GO LIVE** → Discord notification fires automatically
4. Copy the `/live` link and post it everywhere (Twitter/X, Discord, Reddit, etc.)
5. When people click it they see your live stream with chat, donation goal, and affiliate gear all in one page

---

## Dev Tools (local only)

These only work while the local server is running:

| URL | What it does |
|---|---|
| `/dev/toggle-live` | Flip the stream between LIVE and OFFLINE |
| `/dev/status` | See current mock state + revenue counters |
| `/dev/reset-revenue` | Zero out local event counters |

**Test the full flow:** Open `/go-live`, press GO LIVE (no secret needed locally), then open `/live` in another tab – the player and chat appear.

---

## Configuration

Everything is driven by `Extensionadmoney/config.json`. Edit it to customise:

```json
{
  "embed": {
    "channel": "ricktaur",
    "offlineMessage": "Catch the next stream at 8 PM EST!"
  },
  "schedule": {
    "entries": [
      { "dayOfWeek": 1, "hour": 20, "minute": 0, "title": "Monday Night Gaming" }
    ]
  },
  "vods": [
    { "videoId": "PASTE_REAL_TWITCH_VIDEO_ID", "title": "Latest Stream" }
  ],
  "monetization": {
    "affiliate": { "products": [ ... ] },
    "donations":  { "goalCurrent": 500 },
    "sponsors":   { "slots": [ ... ] }
  }
}
```

---

## Environment Variables

Copy `.env.example` to `.env` (same folder as `server.js`) and fill in your keys:

| Variable | What it is | Where to get it |
|---|---|---|
| `TWITCH_CLIENT_ID` | Twitch API app ID | [dev.twitch.tv](https://dev.twitch.tv/console/apps) |
| `TWITCH_CLIENT_SECRET` | Twitch API secret | Same app page |
| `TWITCH_CHANNEL` | Your channel name | `ricktaur` |
| `DISCORD_WEBHOOK_URL` | Discord server webhook | Server Settings → Integrations → Webhooks |
| `NOTIFY_SECRET` | Secret for GO LIVE button | Make up any string |
| `SITE_URL` | Your live Netlify URL | Set after deploying |

**Without Twitch keys:** Stream status defaults to "offline". Toggle with `/dev/toggle-live`.
**Without Discord webhook:** Go-Live still works, Discord step is skipped.

---

## File Structure

```
theadsextent/
├── server.js              ← local dev server (zero npm deps)
├── package.json
├── start.bat              ← Windows double-click launcher
├── start.sh               ← Mac/Linux launcher
├── .env.example           ← copy to .env and fill in keys
├── .gitignore
├── netlify.toml           ← Netlify deployment config
│
└── Extensionadmoney/
    ├── index.html             Main stream embed
    ├── live-now.html          Shareable live page
    ├── go-live.html           Streamer control panel
    ├── stream-chat.html       Stream + chat
    ├── chat-embed.html        Chat only
    ├── vod-embed.html         VOD/clips player
    ├── schedule-embed.html    Schedule + countdown
    ├── widget-embed.html      Live indicator widget
    ├── admin.html             Revenue dashboard
    ├── embed-engine.js        Core embed logic
    ├── config.json            All your settings
    ├── sitemap.xml            SEO sitemap
    ├── robots.txt             SEO robots
    │
    ├── netlify/functions/
    │   ├── stream-status.js   Twitch live/offline proxy
    │   ├── log.js             Analytics event logger
    │   ├── revenue.js         Revenue aggregation
    │   └── notify.js          Go-live notifier (Discord)
    │
    └── src/components/
        ├── embed/
        ├── monetization/
        └── analytics/
```

---

## Deploy to Netlify (free)

1. Push this repo to GitHub
2. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import from Git**
3. Select your repo
4. Set build settings:
   - **Base directory:** `Extensionadmoney`
   - **Publish directory:** `Extensionadmoney`
   - **Functions directory:** `Extensionadmoney/netlify/functions`
5. Add environment variables (Site configuration → Environment variables):
   `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_CHANNEL`, `DISCORD_WEBHOOK_URL`, `NOTIFY_SECRET`, `SITE_URL`
6. Deploy → live
7. Update `sitemap.xml` and `robots.txt` with your real URL, commit, and submit sitemap to Google Search Console

---

## Revenue + Traffic

### How money flows
- **Affiliate clicks** → UTM-tracked → Amazon Associates commissions
- **Donation initiations** → PayPal / Stripe links → tips
- **Sponsor slots** → partner logos in the footer

### How traffic is generated
- **Post `/live` link** on Twitter/X, Discord, Reddit → rich preview card auto-appears
- **Widget embeds** on any website → live badge, auto-refreshes every 90 seconds
- **SEO pages** (schedule, VODs) indexed by Google
- **Discord notifications** alert your community the moment you go live

### Revenue tracking
All events are counted and visible in `/admin`. Locally saved to `.dev-data/revenue.json`. On Netlify saved via Netlify Blobs.

---

## Widget Embed Code

```html
<!-- Live badge -->
<iframe src="https://YOUR-SITE.netlify.app/widget"
  width="160" height="40" frameborder="0" scrolling="no"></iframe>

<!-- Card widget -->
<iframe src="https://YOUR-SITE.netlify.app/widget/card"
  width="240" height="155" frameborder="0" scrolling="no"></iframe>

<!-- Full-width live banner (only shows when live) -->
<iframe src="https://YOUR-SITE.netlify.app/widget/banner"
  width="100%" height="38" frameborder="0" scrolling="no" style="border:none;"></iframe>
```

---

## FAQ

**Q: Do I need to install anything besides Node.js?**
No. `server.js` uses zero npm packages. Just `node server.js`.

**Q: Stream shows offline locally even when I'm live.**
Add `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` to `.env`. Without them status is mocked. Toggle manually at `/dev/toggle-live`.

**Q: How do I add affiliate products?**
Edit `config.json` → `monetization.affiliate.products`. Each needs `id`, `title`, `image`, `price`, `url`.

**Q: How do I update the donation goal?**
Edit `config.json` → `monetization.donations.goalCurrent` and commit.

**Q: Where do I find VOD video IDs?**
Go to `twitch.tv/ricktaur/videos`, click a VOD, copy the number from the URL: `twitch.tv/videos/1234567890` → ID is `1234567890`.
