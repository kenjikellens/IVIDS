@echo off
setlocal enabledelayedexpansion

set "BUILD_START_TIME=%TIME%"

echo.
echo ===================================================
echo             IVIDS AUTOMATED BUILD SCRIPT
echo ===================================================
echo   Started at: %DATE% %TIME%
echo ===================================================
echo.

:: VERSION MODE
if "%~1"=="version" (
    if "%~2"=="" (
        echo [ERROR] Version string not specified.
        exit /b 1
    )
    node update-version.js %~2
    if !errorlevel! neq 0 exit /b 1
    exit /b 0
)

:: BUILD TYPE
set "BUILD_TYPE=debug"
if "%~1"=="release" set "BUILD_TYPE=release"
if "%~1"=="--release" set "BUILD_TYPE=release"

echo [INFO] Build type: %BUILD_TYPE%
echo.

:: PREREQS
where npm >nul 2>&1
if errorlevel 1 exit /b 1

if not exist "gradlew.bat" exit /b 1

echo [PRE] OK
echo.

:: AUTO-INCREMENT BUILD NUMBER
echo [INFO] Incrementing build number...
node increment-version-code.js
if errorlevel 1 (
    echo [ERROR] Failed to increment versionCode.
    exit /b 1
)
echo.

:: BUILD STEP
echo [1-2/5] Building Windows + Android...

set "WIN_STATUS=%TEMP%\win_%RANDOM%.status"
set "APK_STATUS=%TEMP%\apk_%RANDOM%.status"

del "%WIN_STATUS%" >nul 2>&1
del "%APK_STATUS%" >nul 2>&1

:: FIXED START COMMANDS (THIS WAS YOUR BUG)

start "Build Windows" /b cmd /c "npm run dist & echo !errorlevel! > ""%WIN_STATUS%"""

if "%BUILD_TYPE%"=="release" (
    start "Build Android" /b cmd /c "gradlew.bat assembleRelease & echo !errorlevel! > ""%APK_STATUS%"""
) else (
    start "Build Android" /b cmd /c "gradlew.bat assembleDebug & echo !errorlevel! > ""%APK_STATUS%"""
)

:wait
ping 127.0.0.1 -n 3 >nul
if not exist "%WIN_STATUS%" goto wait
if not exist "%APK_STATUS%" goto wait

set /p WIN_ERR=<"%WIN_STATUS%"
set /p APK_ERR=<"%APK_STATUS%"

del "%WIN_STATUS%" >nul 2>&1
del "%APK_STATUS%" >nul 2>&1

set "WIN_ERR=%WIN_ERR: =%"
set "APK_ERR=%APK_ERR: =%"

if not "%WIN_ERR%"=="0" (
    echo [ERROR] Windows build failed: %WIN_ERR%
    exit /b 1
)

if not "%APK_ERR%"=="0" (
    echo [ERROR] Android build failed: %APK_ERR%
    exit /b 1
)

echo [OK] Builds done
echo.

:: MOVE EXE
echo [3/5] Moving EXE...

set "WIN_SRC="
for %%f in (dist\ivids*.exe) do set "WIN_SRC=%%f"

if not defined WIN_SRC exit /b 1

if exist "IVIDS.exe" del /f /q "IVIDS.exe"

move /y "!WIN_SRC!" "IVIDS.exe" >nul

echo [OK] EXE moved

:: MOVE APK
echo [4/5] Moving APK...

set "APK_SRC="
if "%BUILD_TYPE%"=="release" (
    for %%f in (app\build\outputs\apk\release\app-release*.apk) do set "APK_SRC=%%f"
) else (
    set "APK_SRC=app\build\outputs\apk\debug\app-debug.apk"
)

if not exist "!APK_SRC!" exit /b 1

if exist "IVIDS.apk" del /f /q "IVIDS.apk"

move /y "!APK_SRC!" "IVIDS.apk" >nul

echo [OK] APK moved

:: CLEAN DIST
echo [5/5] Cleaning dist...

if exist dist rmdir /s /q dist

echo.
echo BUILD SUCCESS
exit /b 0