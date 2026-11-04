@echo off
chcp 65001 >nul
if not exist "%~dp0moa-llm-share.ps1" (
  echo moa-llm-share.ps1 파일이 이 파일과 같은 폴더에 있어야 해요. 압축을 먼저 풀어 주세요.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0moa-llm-share.ps1"
if errorlevel 1 pause
