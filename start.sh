#!/usr/bin/env bash
# start.sh – PVA Bazaar Stream Embed – Mac / Linux Launcher
# Make executable: chmod +x start.sh
# Then run: ./start.sh

set -e
cd "$(dirname "$0")"

echo ""
echo "============================================================"
echo "  PVA Bazaar Stream Embed – Local Server"
echo "============================================================"
echo ""

# ── Check Node.js ─────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is not installed."
  echo ""
  echo "Install it from: https://nodejs.org/en/download"
  echo "  or via Homebrew (Mac): brew install node"
  echo "  or via nvm:            nvm install --lts"
  echo ""
  exit 1
fi

NODE_VER=$(node --version)
echo "  Node.js found: $NODE_VER"
echo ""

# ── Create .env from .env.example if missing ──────────────────────────────────
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp ".env.example" ".env"
  echo "  Created .env from .env.example"
  echo "  Edit .env to add your Twitch/Discord keys."
  echo ""
fi

# ── Make the script itself executable (helpful if running via sh start.sh) ───
chmod +x start.sh 2>/dev/null || true

# ── Start ─────────────────────────────────────────────────────────────────────
echo "  Starting server on http://localhost:8888 ..."
echo "  Your browser will open automatically."
echo ""
echo "  ── Quick links ─────────────────────────────────────────"
echo "    Stream embed : http://localhost:8888/"
echo "    Go-Live panel: http://localhost:8888/go-live"
echo "    Admin dash   : http://localhost:8888/admin"
echo "    Live page    : http://localhost:8888/live"
echo "    Toggle live  : http://localhost:8888/dev/toggle-live"
echo "  ────────────────────────────────────────────────────────"
echo ""
echo "  Press Ctrl+C to stop."
echo ""

node server.js --open
