@echo off
title PVA Bazaar Stream Embed - Local Server
color 0A
cls

echo.
echo  ============================================================
echo   PVA Bazaar Stream Embed - Windows Launcher
echo  ============================================================
echo.

REM ── Check Node.js is installed ─────────────────────────────────────────────
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed or not in PATH.
    echo.
    echo  Download and install Node.js from:
    echo    https://nodejs.org/en/download
    echo.
    echo  After installing, close this window and double-click start.bat again.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo  Node.js found: %NODE_VER%
echo.

REM ── Copy .env.example to .env if .env doesn't exist ──────────────────────────
if not exist ".env" (
    if exist ".env.example" (
        echo  Creating .env from .env.example ...
        copy ".env.example" ".env" >nul
        echo  .env created. Edit it to add your Twitch/Discord keys.
        echo.
    )
)

REM ── Start the server ────────────────────────────────────────────────────────
echo  Starting server on http://localhost:8888 ...
echo  Your browser will open automatically.
echo.
echo  ── Quick links ─────────────────────────────────────────────
echo    Stream embed : http://localhost:8888/
echo    Go-Live panel: http://localhost:8888/go-live
echo    Admin dash   : http://localhost:8888/admin
echo    Live page    : http://localhost:8888/live
echo    Toggle live  : http://localhost:8888/dev/toggle-live
echo  ────────────────────────────────────────────────────────────
echo.
echo  Press Ctrl+C in this window to stop the server.
echo.

node server.js --open

echo.
echo  Server stopped.
pause
