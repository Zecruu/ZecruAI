@echo off
title ZecruAI
color 0A

echo.
echo   ========================================
echo        ZecruAI - Starting up...
echo   ========================================
echo.

cd /d "%~dp0"

:: Check if node is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo   [ERROR] Node.js is not installed.
    echo   Download it from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Check if dependencies are installed
if not exist "node_modules" (
    echo   Installing dependencies (first time only)...
    echo.
    call npm install
    echo.
)

:: Start browser after a short delay
start /b cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000"

echo   Starting ZecruAI...
echo.
echo   App:   http://localhost:3000
echo   Relay: http://localhost:3001 (auto)
echo.
echo   Keep this window open while using ZecruAI.
echo   Press Ctrl+C to stop.
echo.
echo   ========================================
echo.

:: npm run dev now starts both Next.js AND the relay
call npm run dev
