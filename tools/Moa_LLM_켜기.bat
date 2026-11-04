@echo off
chcp 65001 >nul
title Moa LLM (EXAONE 3.5)

set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
if not exist "%OLLAMA_EXE%" (
  echo Ollama 프로그램을 찾을 수 없어요: %OLLAMA_EXE%
  echo Ollama가 설치되어 있는지 확인해 주세요.
  pause
  exit /b 1
)

echo [1/3] Moa 사이트가 내 LLM을 쓸 수 있도록 Ollama를 다시 켜는 중이에요...
taskkill /IM "ollama app.exe" /F >nul 2>&1
taskkill /IM "ollama.exe" /F >nul 2>&1
timeout /t 2 /nobreak >nul

rem 이 창에서 켠 Ollama만 Moa 사이트의 접속을 허용해요 (Windows 설정은 바꾸지 않아요)
set "OLLAMA_ORIGINS=https://soong9ing.github.io,http://localhost:5173"
start "" /b "%OLLAMA_EXE%" serve >nul 2>&1
timeout /t 3 /nobreak >nul

echo [2/3] 한국어 모델 EXAONE 3.5 (2.4B)를 확인하는 중이에요...
echo       처음 한 번은 1.6GB를 내려받아서 몇 분 걸릴 수 있어요.
"%OLLAMA_EXE%" pull exaone3.5:2.4b
if errorlevel 1 (
  echo.
  echo EXAONE을 받지 못했어요. 인터넷 연결을 확인해 주세요.
  echo 대신 원래 모델 qwen3:4b-instruct로 동작해요.
)

echo.
echo [3/3] 준비됐어요!
echo ==========================================================
echo  이 창은 닫지 말고 켜 둔 채로 쓰세요.
echo  Moa 사이트에서 [겹지인에게 소개받기]를 누르면 돼요.
echo  다 쓰면 이 창을 닫으면 꺼져요.
echo ==========================================================
echo.
:wait
timeout /t 3600 /nobreak >nul
goto wait
