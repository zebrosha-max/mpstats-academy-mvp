@echo off
echo Stopping dev servers on ports 3000-3002...
echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo Killing process on port 3000: PID %%a
    taskkill /F /PID %%a 2>nul
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo Killing process on port 3001: PID %%a
    taskkill /F /PID %%a 2>nul
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002 ^| findstr LISTENING') do (
    echo Killing process on port 3002: PID %%a
    taskkill /F /PID %%a 2>nul
)

echo.
echo Done!
pause
