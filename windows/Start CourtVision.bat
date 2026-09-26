@echo off
title CourtVision
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
if errorlevel 1 (
  echo.
  echo CourtVision could not start. Read the message above.
  pause
)
