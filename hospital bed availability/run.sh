#!/usr/bin/env bash
# Starts the hospital dashboard backend on http://localhost:8080
cd "$(dirname "$0")"
[ -d .venv ] || python3 -m venv .venv
. .venv/bin/activate
pip install -q -r requirements.txt
exec python app.py
