@echo off
setlocal enabledelayedexpansion

:: ──────────────────────────────────────────────────────────
:: Store the build start time for elapsed-time calculation
:: ──────────────────────────────────────────────────────────
set "BUILD_START_TIME=%TIME%"

echo.
echo ===================================================
echo             IVIDS AUTOMATED BUILD SCRIPT
echo ===================================================
echo   Started at: %DATE% %TIME%
echo ===================================================
echo.


:: ──────────────────────────────────────────────────────────
:: Check for version update command
:: ──────────────────────────────────────────────────────────
if "%~1"=="version" (
    if "%~2"=="" (
        echo [ERROR] Version string not specified.
        echo Usage: build.bat version [version_number]
        exit /b 1
    )
    echo [INFO] Running automatic version updater for: %~2
    node update-version.js %~2
    if !errorlevel! neq 0 (
        echo [ERROR] Version update failed.
        exit /b 1
    )
    echo [INFO] Version update successful.
    exit /b 0
)

:: ──────────────────────────────────────────────────────────
:: Parse build type argument (debug or release)
:: ──────────────────────────────────────────────────────────
set BUILD_TYPE=debug
if "%~1"=="release"   set BUILD_TYPE=release
if "%~1"=="--release"  set BUILD_TYPE=release

echo [INFO] Build type: %BUILD_TYPE%

echo.

:: ===========================================================
:: PREREQUISITE CHECKS
:: ===========================================================
echo [PRE] Checking prerequisites...

:: --- Check: Node / npm ---
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 'npm' is not found on PATH. Install Node.js first.
    echo [ERROR] Build aborted during prerequisite check.
    exit /b 1
)
for /f "tokens=*" %%v in ('npm --version 2^>nul') do set "NPM_VER=%%v"
echo   [OK] npm found (v%NPM_VER%)

:: --- Check: gradlew.bat exists ---
if not exist "gradlew.bat" (
    echo [ERROR] 'gradlew.bat' not found in project root.
    echo [ERROR] Build aborted during prerequisite check.
    exit /b 1
)
echo   [OK] gradlew.bat found

echo.
echo [PRE] All prerequisites satisfied.
echo.

:: ===========================================================
:: STEP 1 & 2 / 5 — Build Windows Portable Executable & Android APK (Concurrently)
:: ===========================================================
echo ---------------------------------------------------
echo [1-2/5] Building Windows Executable and Android APK Concurrently...
echo ---------------------------------------------------

set "WIN_STATUS=%TEMP%\win_build_%RANDOM%.status"
set "APK_STATUS=%TEMP%\apk_build_%RANDOM%.status"

if exist "%WIN_STATUS%" del "%WIN_STATUS%"
if exist "%APK_STATUS%" del "%APK_STATUS%"

:: Start Windows build in background
echo [INFO] Starting Windows build in background...
start "Build Windows" /b cmd /c "npm run dist & call echo %%errorlevel%% > "%WIN_STATUS%""

:: Start Android build in background
echo [INFO] Starting Android build (%BUILD_TYPE%) in background...
if "%BUILD_TYPE%"=="release" (
    start "Build Android" /b cmd /c "gradlew.bat assembleRelease & call echo %%errorlevel%% > "%APK_STATUS%""
) else (
    start "Build Android" /b cmd /c "gradlew.bat assembleDebug & call echo %%errorlevel%% > "%APK_STATUS%""
)

echo [INFO] Waiting for parallel builds to complete...

:wait_loop
timeout /t 2 /nobreak >nul
if not exist "%WIN_STATUS%" goto wait_loop
if not exist "%APK_STATUS%" goto wait_loop

:: Read exit codes
set /p WIN_ERR=<"%WIN_STATUS%"
set /p APK_ERR=<"%APK_STATUS%"

:: Clean up status files
del "%WIN_STATUS%" >nul 2>&1
del "%APK_STATUS%" >nul 2>&1

:: Check results
set BUILD_FAILED=0

:: Trim whitespace from read values
set "WIN_ERR=%WIN_ERR: =%"
set "APK_ERR=%APK_ERR: =%"

if "%WIN_ERR%" neq "0" (
    echo.
    echo [ERROR] Windows build failed with exit code %WIN_ERR%.
    set BUILD_FAILED=1
) else (
    echo [1/5] SUCCESS — Windows executable built.
)

if "%APK_ERR%" neq "0" (
    echo.
    echo [ERROR] Android APK build failed with exit code %APK_ERR%.
    set BUILD_FAILED=1
) else (
    echo [2/5] SUCCESS — Android APK built (%BUILD_TYPE%).
)

if "%BUILD_FAILED%"=="1" (
    echo.
    echo [ERROR] Parallel build failed.
    echo [ERROR] Build aborted at: %DATE% %TIME%
    exit /b 1
)
echo.

:: ===========================================================
:: STEP 3 / 5 — Copy Windows Executable to root
:: ===========================================================
echo ---------------------------------------------------
echo [3/5] Copying Windows Executable to root...
echo ---------------------------------------------------

:: Verify the source file exists before attempting copy
set "WIN_SRC="
for %%f in (dist\ivids*.exe) do set "WIN_SRC=%%f"
if not defined WIN_SRC (
    echo [ERROR] No file matching dist\ivids*.exe was found.
    echo [ERROR] Step 3/5 FAILED — nothing to copy.
    echo [ERROR] Build aborted at: %DATE% %TIME%
    exit /b 1
)

copy /y "!WIN_SRC!" "IVIDS.exe" >nul
if !errorlevel! neq 0 (
    echo [ERROR] 'copy' command failed with exit code !errorlevel!.
    echo [ERROR] Step 3/5 FAILED — could not copy Windows executable.
    echo [ERROR] Build aborted at: %DATE% %TIME%
    exit /b 1
)

echo [3/5] SUCCESS — !WIN_SRC! -^> IVIDS.exe
echo.

:: ===========================================================
:: STEP 4 / 5 — Copy Android APK to root
:: ===========================================================
echo ---------------------------------------------------
echo [4/5] Copying Android APK to root...
echo ---------------------------------------------------

:: Determine the source APK path and verify it exists
set "APK_SRC="
if "%BUILD_TYPE%"=="release" (
    for %%f in (app\build\outputs\apk\release\app-release*.apk) do set "APK_SRC=%%f"
) else (
    if exist "app\build\outputs\apk\debug\app-debug.apk" (
        set "APK_SRC=app\build\outputs\apk\debug\app-debug.apk"
    )
)

if not defined APK_SRC (
    echo [ERROR] No APK file found for build type '%BUILD_TYPE%'.
    if "%BUILD_TYPE%"=="release" (
        echo [ERROR] Expected: app\build\outputs\apk\release\app-release*.apk
    ) else (
        echo [ERROR] Expected: app\build\outputs\apk\debug\app-debug.apk
    )
    echo [ERROR] Step 4/5 FAILED — nothing to copy.
    echo [ERROR] Build aborted at: %DATE% %TIME%
    exit /b 1
)

copy /y "!APK_SRC!" "IVIDS.apk" >nul
if !errorlevel! neq 0 (
    echo [ERROR] 'copy' command failed with exit code !errorlevel!.
    echo [ERROR] Step 4/5 FAILED — could not copy APK.
    echo [ERROR] Build aborted at: %DATE% %TIME%
    exit /b 1
)

echo [4/5] SUCCESS — !APK_SRC! -^> IVIDS.apk
echo.

:: ===========================================================
:: STEP 5 / 5 — Clean up build artifacts (dist folder)
:: ===========================================================
echo ---------------------------------------------------
echo [5/5] Cleaning up build artifacts (dist folder)...
echo ---------------------------------------------------

if exist dist (
    rmdir /s /q dist
    if !errorlevel! neq 0 (
        echo [WARNING] Could not fully remove 'dist' folder [exit code !errorlevel!].
        echo [WARNING] Some files may be locked. You can delete it manually later.
    ) else (
        echo [5/5] SUCCESS — dist folder removed.
    )
) else (
    echo [5/5] SKIPPED — dist folder does not exist; nothing to clean.
)

echo.

:: ===========================================================
:: BUILD COMPLETE
:: ===========================================================
echo ===================================================
echo  BUILD SUCCESSFUL (%BUILD_TYPE%)
echo ===================================================
echo   Outputs:
echo     - IVIDS.exe   (Windows portable executable)
echo     - IVIDS.apk   (Android APK — %BUILD_TYPE%)
echo   Finished at: %DATE% %TIME%
echo ===================================================
echo.

endlocal
exit /b 0
