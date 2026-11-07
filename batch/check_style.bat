@echo off
rem ZKRoto - both house checkers (dev\check_style.js, dev\check_blocks.js); prints file:line. Exit 0 = PASS, 1 = FAIL, 2 = node not found.
setlocal
rem #### SETTINGS - EDIT HERE ####
set "NODE=node"
set "STYLE_TARGETS=web atdd dev batch docs third-party\NOTICE.md README.md"
set "BLOCK_TARGETS=web atdd dev"
rem ##############################
cd /d "%~dp0.."
where %NODE% >nul 2>nul
if errorlevel 1 (
  echo check_style: FAIL - %NODE% not found on PATH
  if not defined ZK_NOPAUSE pause
  exit /b 2
)
set "RESULT=0"
%NODE% dev\check_style.js %STYLE_TARGETS%
if errorlevel 1 set "RESULT=1"
%NODE% dev\check_blocks.js %BLOCK_TARGETS%
if errorlevel 1 set "RESULT=1"
if "%RESULT%"=="0" (echo checks: PASS) else (echo checks: FAIL)
if not defined ZK_NOPAUSE pause
exit /b %RESULT%
