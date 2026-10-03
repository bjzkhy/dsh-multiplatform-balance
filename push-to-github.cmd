@echo off
rem ---------------------------------------------------------------------
rem  push-to-github.cmd - publish the local dsh-multiplatform-balance history
rem  to GitHub using the PortableGit that already exists on this machine.
rem
rem   push-to-github.cmd          add remote (if needed) + push
rem   push-to-github.cmd check    show local state, push nothing
rem ---------------------------------------------------------------------
setlocal enabledelayedexpansion
set "RC=1"

set "GITDIR=C:\Users\bjzkh_4vos7d6\.workbuddy\binaries\PortableGit\versions\1.2.0\cmd"
set "REPODIR=%~dp0"
set "GHUSER=bjzkhy"
set "GHREPO=dsh-multiplatform-balance"
set "GIT_URL=https://github.com/%GHUSER%/%GHREPO%.git"

rem keep git scratch out of the user profile: this shell may not write there
set "HOME=%~dp0"
set "GIT_CONFIG_COUNT=1"
set "GIT_CONFIG_KEY_0=safe.directory"
set "GIT_CONFIG_VALUE_0=*"

if not exist "%GITDIR%\git.exe" goto :nogl
if not exist "%REPODIR%\.git" goto :norepo
set "PATH=%GITDIR%;%PATH%"
cd /d "%REPODIR%" || goto :nocd

echo == local state ==
git --version
git log --oneline
echo.
echo == branch / tags / commit count (catalog gate: 10+) ==
git branch --show-current
git tag -l
git rev-list --count HEAD
echo.

if /i not "%~1"=="check" goto :doPush
echo [check] remote:
git remote -v
set "RC=0"
goto :out

:doPush
echo == remote ==
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin "%GIT_URL%"
  echo     added origin = %GIT_URL%
) else (
  echo     origin already present, leaving it alone
)
echo.
echo == pushing (a browser window may open for the GitHub sign-in) ==
git push -u origin main --follow-tags
set "RC=!ERRORLEVEL!"
echo.
if not "!RC!"=="0" goto :pushfail
echo [OK] pushed. Finish in the browser:
echo   1. repo page, right side About, the gear: add topic  dsh-plugin
echo   2. confirm the repo is Public and had no README auto-created
echo   3. tomorrow (repo must be 1+ day old) open the catalog PR with
echo      catalog\%GHUSER%__%GHREPO%.yml
goto :out

:pushfail
echo [X] push failed, exit !RC!. Usual causes:
echo     - repo %GHUSER%/%GHREPO% does not exist yet: create it empty,
echo       tick NOTHING under "Initialize this repository with"
echo     - your GitHub login is not "%GHUSER%": edit GHUSER above
echo       (top-right corner of github.com shows it)
echo     - the sign-in window was cancelled
goto :out

:nogl
echo [X] git.exe not found under %GITDIR%
echo     point GITDIR at any git installation you have.
goto :out
:norepo
echo [X] no .git in %REPODIR% - run init-repo.ps1 first.
goto :out
:nocd
echo [X] cannot enter %REPODIR%
goto :out

:out
echo.
pause
endlocal & exit /b %RC%
