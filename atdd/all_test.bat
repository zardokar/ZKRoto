@echo off
rem ZKRoto - every unit test (atdd\ and dev\) with node --test. Exit 0 = PASS, 1 = FAIL, 2 = node not found.
setlocal
rem #### SETTINGS - EDIT HERE ####
set "NODE=node"
rem ##############################
cd /d "%~dp0.."
where %NODE% >nul 2>nul
if errorlevel 1 (
  echo all_test: FAIL - %NODE% not found on PATH
  if not defined ZK_NOPAUSE pause
  exit /b 2
)
%NODE% --test
if errorlevel 1 (
  echo all_test: FAIL
  if not defined ZK_NOPAUSE pause
  exit /b 1
)
echo all_test: PASS
if not defined ZK_NOPAUSE pause
exit /b 0
