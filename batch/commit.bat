@echo off
rem ZKRoto - commit every change in this repo with MSG below, then ask about push. Exit 0 = done, 1 = cancelled / failed, 2 = no git / not a repo.
setlocal
rem #### SETTINGS - EDIT HERE ####
set "GIT=git"
set "MSG=ZKRoto 0.1.3: AppMaker v003 rewrite, import map ?v= on every module and JSON, last-frame fix, 42 tests, NOTICE only"
rem ##############################
set "RC=0"
cd /d "%~dp0.."
where %GIT% >nul 2>nul
if errorlevel 1 (
  echo commit: FAIL - %GIT% not found on PATH
  set "RC=2"
  goto :end
)
%GIT% rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
  echo commit: FAIL - %CD% is not a git repository
  set "RC=2"
  goto :end
)
echo Repository: %CD%
%GIT% status --short
echo.
echo Message: %MSG%
echo.
choice /c YN /m "Commit all changes with this message"
if errorlevel 2 (
  echo commit: cancelled, nothing changed
  set "RC=1"
  goto :end
)
%GIT% add -A
%GIT% commit -m "%MSG%"
if errorlevel 1 (
  echo commit: FAIL
  set "RC=1"
  goto :end
)
%GIT% log -1 --oneline
choice /c YN /m "Push to the remote now"
if errorlevel 2 (
  echo push: skipped
  goto :end
)
%GIT% push
if errorlevel 1 (
  echo push: FAIL
  set "RC=1"
)
:end
if not defined ZK_NOPAUSE pause
exit /b %RC%
