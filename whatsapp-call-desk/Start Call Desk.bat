@echo off
title Brule Call Desk
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed yet. Opening the download page...
  echo  Install the LTS version, then double-click this file again.
  start "" "https://nodejs.org/en/download"
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo.
  echo  First start: installing Call Desk. This downloads about 200 MB and happens only once.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  The install failed - see the messages above.
    pause
    exit /b 1
  )
)

echo.
echo  Starting Call Desk. Your browser will open in a moment.
echo  Keep this window open while you use it. Close it to stop Call Desk.
echo.
call npm start
pause
