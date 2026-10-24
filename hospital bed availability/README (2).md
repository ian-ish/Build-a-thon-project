# Hospital Bed Availability & Resource Coordination System: Python backend edition

Your dashboard, now with a Flask + SQLite backend, staff accounts, and a **KYC gate**:
nobody sees the dashboard until they have signed in **and** their government ID has been verified.

## Quick start

**Windows:** double-click `run.bat`  **Mac/Linux:** `./run.sh`
(or manually: `pip install -r requirements.txt` then `python app.py`), then open <http://localhost:8080>.

On the first run the console prints an **admin account** (`admin@hospital.local` + a generated password, shown once).
Set your own with `ADMIN_EMAIL` / `ADMIN_PASSWORD` before the first start.

## How it works

```
Register  ->  Sign in  ->  KYC form (ID type + number + photo)  ->  Admin reviews  ->  Dashboard
```

1. **Register**: name, email, mobile, designation, password.
2. **KYC**: choose **Aadhaar, PAN, Voter ID (EPIC), Driving Licence or Passport**, enter the number, the name and date
   of birth as printed on it, upload a photo/PDF of the front (and back), and tick the consent box.
3. **Checks run immediately**: the ID number must be correctly formatted (Aadhaar also has to pass its Verhoeff
   checksum), the user must be 18+, the file must really be a JPG/PNG/PDF (checked by content, not by file name),
   and the same ID cannot be used on two accounts.
4. **Admin review** (`/admin/kyc`): the admin sees the masked ID, whether the name matches the account, and the
   decrypted document, then approves or rejects (with a reason the applicant sees). Admins cannot approve themselves.
5. **Dashboard unlocks**: only after approval. The dashboard HTML *and* `app.js` are served by the server only to
   verified users, so editing front-end code cannot skip KYC. Every `/api/state` call re-checks it too.

`KYC_MODE=demo` auto-approves any submission that passes the format checks, handy for trying things out. **Never use it
for real patients' data.**

## What changed in the dashboard

| Before | Now |
|---|---|
| Data in each browser's `localStorage` | Shared & persistent in SQLite; every verified user sees the same beds, updated live (polls every 4 s) |
| "Switch staff persona" dropdown | The operator is the signed-in user; **Logout** button |
| Audit log written by the browser | Operator name and timestamp are **stamped by the server** from the login |
| Two people editing = last write wins silently | Revision check: a stale save is refused and the user is told to review and redo |
| "Reset Demo" for everyone | Admin only (also hidden for others) |
| Simulation ran in every tab | Only one tab at a time (server-issued lease) drives the cleaning-countdown simulation |
| `server.ps1` | Replaced by `app.py`. You can delete `server.ps1` |

## Files

```
app.py              Flask backend: auth, KYC, admin review, state + audit API
kyc_validation.py   ID format checks (Aadhaar Verhoeff checksum, PAN, EPIC, DL, passport) + file sniffing
protected/app.js    Your dashboard logic (only served to verified users)
templates/          dashboard.html (your index.html), login, register, kyc, admin_kyc
static/             styles.css (yours), auth.css, small page scripts
tests/test_flow.py  End-to-end tests:  python tests/test_flow.py
data/               Created at runtime: hospital.db, keys.json, encrypted ID images. BACK THIS UP, DON'T COMMIT IT
```

## Important: what this does and does not prove

The built-in checks confirm a number is **well-formed**, not that it is **real** or **belongs to the person**. The
real protection is the human admin comparing the uploaded ID with the entered details. If you need automated
verification against the issuing authority, plug a licensed provider (DigiLocker / UIDAI e-KYC, NSDL PAN
verification, or an aggregator like Digio, Signzy, IDfy or Karza) into `external_verify()` in `app.py`. It is already
called on every submission and stored with the result.

## How ID data is protected

* Document images are **encrypted at rest** (Fernet); keys are generated into `data/keys.json`. Lose that file and the images are unreadable.
* Only the **last 4 characters** of the ID number are kept, plus an HMAC hash used for duplicate detection. The full number is never stored.
* After a decision the images are **deleted** (`KYC_PURGE_DOCS=0` to keep them).
* Passwords are hashed (werkzeug/scrypt); sessions are HttpOnly + SameSite cookies; every write needs a CSRF token;
  login is rate-limited (5 failures / 15 min); strict CSP, `nosniff`, `X-Frame-Options: DENY`.
* Patient text is escaped on the server so one user cannot plant script in a record that other users' browsers render.

## Before using this with real patient data

* Run behind **HTTPS** and set `HBA_HTTPS=1`; serve with `HBA_PROD=1 python app.py` (needs `pip install waitress`) rather than Flask's dev server.
* Replace the sample patients/doctors with your real data source. This is still the original demo dataset and simulation.
* **Aadhaar:** private organisations are restricted in how they can collect and use it (Aadhaar Act, the 2018 Supreme
  Court ruling, DPDP Act 2023). That is why it's one of several options here. Have your legal/compliance team confirm
  what you may ask for, and consider making Aadhaar optional.
* Not included yet: email/mobile OTP verification, password reset, account disabling, and per-role permissions
  (currently any verified user can operate beds; only admins can reset or review KYC). Rate limits are in-memory (single process).
* The dashboard page keeps inline `onclick` handlers from the original code, so its Content-Security-Policy allows inline scripts. Auth/KYC/admin pages use a strict policy.

## Configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `KYC_MODE` | `manual` | `manual` = admin approval, `demo` = auto-approve |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@hospital.local` / generated | First-run admin |
| `KYC_PURGE_DOCS` | `1` | Delete ID images after approve/reject |
| `HBA_HTTPS` | `0` | Secure cookies + HSTS |
| `HBA_PROD` | `0` | Use waitress |
| `HOST` / `PORT` | `127.0.0.1` / `8080` | Bind address (use `0.0.0.0` to allow other machines) |
| `HBA_DATA_DIR` | `./data` | Where DB, keys and documents live |
