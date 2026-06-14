@echo off
title Student Survey App
echo ============================================
echo   Student Survey App - Starting...
echo ============================================
echo.
cd /d "%~dp0"

rem --- Find Node.js (PATH or default install location) ---
set "NODE_EXE=node"
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "NODE_EXE=C:\Program Files\nodejs\node.exe"
    ) else (
        echo ERROR: Node.js is not installed.
        echo Please download it from https://nodejs.org
        pause
        exit /b 1
    )
)

if not exist node_modules (
    echo Installing dependencies for the first time...
    if exist "C:\Program Files\nodejs\npm.cmd" (
        call "C:\Program Files\nodejs\npm.cmd" install
    ) else (
        call npm install
    )
    echo.
)

echo ============================================
echo  Admin Panel:  http://localhost:3000/admin
echo  Login:        admin / admin123
echo  CHANGE password after first login!
echo ============================================
echo.
echo Keep this window OPEN while using the app.
echo Press Ctrl+C to stop the server.
echo.
"%NODE_EXE%" server.js
pause
