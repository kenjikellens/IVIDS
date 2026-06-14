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
:: STEP 1 / 5 — Build Windows Portable Executable
:: ===========================================================
echo ---------------------------------------------------
echo [1/5] Building Windows Portable Executable...
echo ---------------------------------------------------

call npm run dist
if !errorlevel! neq 0 (
    echo.
    echo [ERROR] npm run dist failed with exit code !errorlevel!.
    echo [ERROR] Step 1/5 FAILED — Windows executable was NOT built.
    echo [ERROR] Build aborted at: %DATE% %TIME%
    exit /b 1
)

echo [1/5] SUCCESS — Windows executable built.
echo.

:: ===========================================================
:: STEP 2 / 5 — Build Android APK
:: ===========================================================
echo ---------------------------------------------------
echo [2/5] Building Android APK (%BUILD_TYPE%)...
echo ---------------------------------------------------

if "%BUILD_TYPE%"=="release" (
    call gradlew.bat assembleRelease
) else (
    call gradlew.bat assembleDebug
)
if !errorlevel! neq 0 (
    echo.
    echo [ERROR] Gradle build failed with exit code !errorlevel!.
    echo [ERROR] Step 2/5 FAILED — Android APK was NOT built.
    echo [ERROR] Build aborted at: %DATE% %TIME%
    exit /b 1
)

echo [2/5] SUCCESS — Android APK built (%BUILD_TYPE%).
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
