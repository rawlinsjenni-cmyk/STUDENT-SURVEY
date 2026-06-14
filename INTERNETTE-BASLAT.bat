@echo off
title Student Survey App - ONLINE
cd /d "%~dp0"

set "NODE_EXE=node"
where node >nul 2>nul || set "NODE_EXE=C:\Program Files\nodejs\node.exe"

echo ============================================
echo   Student Survey App - INTERNETE ACILIYOR
echo ============================================
echo.

rem --- 1) Sunucuyu baslat (arka planda) ---
echo [1/2] Sunucu baslatiliyor...
start "Survey Server" /min "%NODE_EXE%" server.js
timeout /t 3 /nobreak >nul

rem --- 2) Tuneli baslat ve adresi al ---
echo [2/2] Internet baglantisi (tunnel) aciliyor...
if exist tunnel.log del tunnel.log
start "Survey Tunnel" /min cloudflared.exe tunnel --url http://localhost:3000 --logfile tunnel.log
echo     Adres bekleniyor (15 saniye)...
timeout /t 15 /nobreak >nul

echo.
echo ============================================
echo   INTERNET ADRESI (ogrencilere bu linki ver):
echo ============================================
echo.
powershell -NoProfile -Command "$u=(Select-String -Path tunnel.log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1).Matches.Value; if($u){Write-Host ('   '+$u) -ForegroundColor Green; Write-Host ''; Write-Host ('   Admin paneli: '+$u+'/admin')} else {Write-Host '   Adres alinamadi - birkac saniye sonra tunnel.log dosyasina bakin.' -ForegroundColor Yellow}"
echo.
echo ============================================
echo  ONEMLI:
echo   - Bu pencereyi ve acilan 2 kucuk pencereyi KAPATMAYIN.
echo   - Bilgisayar acik kaldigi surece link calisir.
echo   - Bilgisayari kapatip acinca bu dosyaya tekrar cift tiklayin;
echo     YENI bir adres olusur (degisir).
echo ============================================
echo.
pause
