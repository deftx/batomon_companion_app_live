@echo off
title Batomon Companion (DEV)
cd /d "%~dp0"
set BC_AUTO_REFRESH=1
echo DEV mode - batodex auto-refresh ENABLED
echo.
start "" http://localhost:8137
node server.js
pause
