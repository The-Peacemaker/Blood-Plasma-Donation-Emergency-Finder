@echo off
title BloodFinder Backend Server
echo.
echo ============================================
echo    BloodFinder Backend Server Startup
echo ============================================
echo.

REM Check if MongoDB is running
echo Checking MongoDB service...
sc query MongoDB | find "RUNNING" >nul
if %errorlevel%==0 (
    echo ✅ MongoDB service is running
) else (
    echo ❌ MongoDB service is not running
    echo Starting MongoDB service...
    net start MongoDB
)

echo.
echo Starting BloodFinder Backend Server...
echo Server will be available at: http://localhost:5000
echo API Health Check: http://localhost:5000/api/health
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start the Node.js server
cd /d "%~dp0"
npm run dev

pause
