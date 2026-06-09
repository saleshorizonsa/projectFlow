@echo off
title PEGMS Local Server
cd /d "%~dp0"
echo Starting Project Execution ^& Gap Management System...
echo.
echo URL: http://localhost:3000
echo.
npm.cmd run dev
echo.
echo Server stopped. Press any key to close this window.
pause >nul
