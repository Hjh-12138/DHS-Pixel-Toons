@echo off
setlocal DisableDelayedExpansion
set "ELECTRON_RUN_AS_NODE=1"
"%~1\DeepSeek Harness.exe" --expose-internals "%~dp0install-desktop-package.mjs" "%~1" "%~2" "%~3" "%~4" "%~5" "%~6"
exit /b %errorlevel%
