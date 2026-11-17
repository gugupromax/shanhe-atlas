@echo off
setlocal
where py.exe >nul 2>nul
if not errorlevel 1 (
  py -3 "%~dp0scripts\launch_map.pyw" --stop
  exit /b
)
where python.exe >nul 2>nul
if not errorlevel 1 (
  python "%~dp0scripts\launch_map.pyw" --stop
  exit /b
)
echo Python 3 is required. Use an existing Python installation or another static server.
pause
exit /b 1
