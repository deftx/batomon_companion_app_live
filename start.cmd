@echo off
setlocal EnableExtensions
title Batomon Companion
cd /d "%~dp0"

cls
echo  ============================================
echo    Batomon Companion
echo  ============================================
echo.

REM ---------------------------------------------------------------
REM 1) Are the app files actually next to this script?
REM    If not, the two likely causes are: run straight out of the zip
REM    (Windows previews a zip like a folder, but those are read-only
REM    temp copies - the #1 install failure), or start.cmd was moved
REM    out on its own. Use the path only to pick the better message,
REM    never to block a folder that genuinely has the files.
REM ---------------------------------------------------------------
if exist "server.js" goto :have_files
echo "%~dp0" | findstr /i "\\Temp\\" >nul
if not errorlevel 1 goto :in_zip
goto :wrong_folder
:have_files

REM ---------------------------------------------------------------
REM 2) Is Node.js installed? (the only thing you need to install)
REM ---------------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 goto :no_node

for /f "tokens=*" %%v in ('node --version 2^>nul') do set NODEVER=%%v
echo  Node.js %NODEVER% found.
echo.
echo  Starting the app... your browser will open in a few seconds.
echo.
echo  KEEP THIS WINDOW OPEN while you play.
echo  Closing it stops the app.
echo.
echo  --------------------------------------------

REM Open the browser AFTER the server has had time to start listening.
REM (Opening it first is why "localhost isn't working" for some people.)
start "" cmd /c "timeout /t 4 /nobreak >nul & start "" http://localhost:8137"

node server.js

echo.
echo  --------------------------------------------
echo  The app has stopped.
echo.
pause
exit /b 0


:in_zip
echo  [!] It looks like you are running this from INSIDE the zip file.
echo.
echo      Windows can preview a zip like a folder, but the app cannot
echo      run from there.
echo.
echo   HOW TO FIX:
echo     1. Close this window.
echo     2. Find batomon-companion.zip in your Downloads.
echo     3. Right-click it, choose "Extract All...", then Extract.
echo     4. Open the folder it creates and double-click start.cmd again.
echo.
pause
exit /b 1


:wrong_folder
echo  [!] Cannot find the app files (server.js is missing).
echo.
echo      start.cmd has to stay in the SAME folder as the rest of the
echo      app - please don't move it on its own.
echo.
echo      Re-extract the zip and double-click start.cmd inside that folder.
echo.
pause
exit /b 1


:no_node
echo  [!] Node.js is not installed - the app needs it to run.
echo      It is free, official, and takes about a minute.
echo.
echo   HOW TO FIX:
echo     1. The download page is opening now (nodejs.org).
echo        If it does not open, go there yourself.
echo     2. Download the Windows "LTS" version.
echo     3. Run the installer and click Next until it finishes
echo        (the default options are fine).
echo     4. Come back here and double-click start.cmd again.
echo.
start "" https://nodejs.org/en/download
pause
exit /b 1
