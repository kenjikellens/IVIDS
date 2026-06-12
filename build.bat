@echo off

echo ===================================================
echo             IVIDS AUTOMATED BUILD SCRIPT
echo ===================================================
echo.

:: Check for release argument
set BUILD_TYPE=debug
if "%1"=="release" set BUILD_TYPE=release
if "%1"=="--release" set BUILD_TYPE=release

echo [1/5] Building Windows Portable Executable...
call npm run dist
if errorlevel 1 echo [ERROR] Failed to build Windows executable.
if errorlevel 1 exit /b 1

echo [2/5] Building Android APK (%BUILD_TYPE%)...
if "%BUILD_TYPE%"=="release" call gradlew.bat assembleRelease
if not "%BUILD_TYPE%"=="release" call gradlew.bat assembleDebug
if errorlevel 1 echo [ERROR] Failed to build Android APK.
if errorlevel 1 exit /b 1

echo [3/5] Copying Windows Executable to root...
copy /y dist\ivids*.exe IVIDS.exe >nul
if errorlevel 1 echo [ERROR] Failed to copy Windows executable to root.
if errorlevel 1 exit /b 1
echo Copy successful: dist\ivids*.exe -^> IVIDS.exe

echo [4/5] Copying Android APK to root...
if "%BUILD_TYPE%"=="release" copy /y app\build\outputs\apk\release\app-release*.apk IVIDS.apk >nul
if not "%BUILD_TYPE%"=="release" copy /y app\build\outputs\apk\debug\app-debug.apk IVIDS.apk >nul
if errorlevel 1 echo [ERROR] Failed to copy Android APK to root.
if errorlevel 1 exit /b 1
echo Copy successful: APK -^> IVIDS.apk

echo [5/5] Cleaning up build artifacts (dist folder)...
if exist dist rmdir /s /q dist
if errorlevel 1 echo [WARNING] Failed to delete dist folder.

echo.
echo ===================================================
echo  BUILD SUCCESSFUL (%BUILD_TYPE%): IVIDS.exe and IVIDS.apk
echo ===================================================
