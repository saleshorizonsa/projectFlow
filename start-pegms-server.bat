@echo off
title ProjectFlow Local Server
cd /d "%~dp0"
echo Starting ProjectFlow...
echo.
echo URL: http://localhost:3000
echo.
npm.cmd run dev
echo.
echo Server stopped. Press any key to close this window.
pause >nul
