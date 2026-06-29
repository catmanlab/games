@echo off
cd /d "%~dp0"
echo.
echo  Supergun local server
echo  Open: http://localhost:8777/supergun.html
echo  (Use localhost — not 127.0.0.1 — so your account stays the same)
echo  Press Ctrl+C to stop
echo.
python -m http.server 8777
