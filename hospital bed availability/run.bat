@echo off
REM Starts the hospital dashboard backend on http://localhost:8080
cd /d "%~dp0"
if not exist .venv ( py -3 -m venv .venv )
call .venv\Scripts\activate
pip install -q -r requirements.txt
REM Optional: set KYC_MODE=demo to auto-approve KYC while testing
REM Optional: set ADMIN_EMAIL=you@hospital.org  and  set ADMIN_PASSWORD=...
python app.py
pause
