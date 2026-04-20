@echo off
setlocal

set "ROOT_DIR=%~dp0.."
if not defined LIMPAE_PROXY_TARGET set "LIMPAE_PROXY_TARGET=https://limpae-jcqa.onrender.com"
if not defined LIMPAE_PROXY_PORT set "LIMPAE_PROXY_PORT=8787"

echo [limpae bat] backend: %LIMPAE_PROXY_TARGET%
echo [limpae bat] porta:   %LIMPAE_PROXY_PORT%

cd /d "%ROOT_DIR%"
node scripts\start-expo-proxy.js %*
