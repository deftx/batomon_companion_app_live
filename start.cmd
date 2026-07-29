@echo off
title Batomon Companion
cd /d "%~dp0"
echo Starting Batomon Companion...
echo.
start "" http://localhost:8137
node server.js
pause
