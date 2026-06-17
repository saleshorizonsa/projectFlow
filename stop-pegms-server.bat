@echo off
title Stop ProjectFlow Local Server
echo Stopping ProjectFlow server on port 3000...
echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  echo Found server process: %%a
  taskkill /PID %%a /F
)

echo.
echo Done. Press any key to close this window.
pause >nul
