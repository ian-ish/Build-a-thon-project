"""
Hospital Bed Availability & Resource Coordination: Python backend (Flask + SQLite)

What this adds on top of the original static site
  * Staff accounts (register / login / logout)
  * KYC gate: users must submit a government ID (Aadhaar, PAN, Voter ID,
    Driving Licence, Passport) and be verified BEFORE the dashboard is served
  * Admin review queue for KYC submissions
  * Shared, persistent dashboard state in SQLite (replaces browser localStorage),
    with revision checking so two users cannot silently overwrite each other
  * Server-stamped audit log (the operator name comes from the login, not the browser)

The dashboard HTML/JS is only ever served by the server to verified users, so
the KYC check cannot be bypassed by editing front-end code.
"""
import datetime as dt
import hashlib
import hmac
import json
import math
import os
import re
import secrets
import sqlite3
import time
import uuid
from functools import wraps
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from flask import (Flask, Response, abort, g, jsonify, redirect, render_template,
                   request, send_from_directory, session)
from werkzeug.security import check_password_hash, generate_password_hash

from kyc_validation import ID_TYPES, mask_id, sniff_upload, validate_id

# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("HBA_DATA_DIR", BASE_DIR / "data"))
DOCS_DIR = DATA_DIR / "kyc_docs"
DB_PATH = DATA_DIR / "hospital.db"
KEYS_PATH = DATA_DIR / "keys.json"

# demo   = auto-approve any submission whose ID number passes format checks (default for interactive testing)
# manual = an admin must approve every KYC submission (set KYC_MODE=manual for real deployments)
KYC_MODE = os.environ.get("KYC_MODE", "demo").lower()
PURGE_DOCS_ON_DECISION = os.environ.get("KYC_PURGE_DOCS", "1") == "1"
HTTPS = os.environ.get("HBA_HTTPS", "0") == "1"
MAX_UPLOAD = 5 * 1024 * 1024          # per file
MAX_STATE_BYTES = 2 * 1024 * 1024

DESIGNATIONS = ["Doctor", "Nurse", "Bed Coordinator", "Ward Manager",
                "Housekeeping / EVS Lead", "Hospital Administrator", "Other"]

DEPT_IDS = {"ED", "CCU", "NICU", "PICU", "SURG", "RESP", "ONCO"}
CAT_IDS = {"icu", "emergency", "longstay"}
STATUS_IDS = {"available", "occupied", "reserved", "cleaning", "maintenance"}
RESOURCE_KEYS = {"ventilators", "monitors", "infusion_pumps", "oxygen_ports",
                 "crash_carts", "dialysis"}

DATA_DIR.mkdir(parents=True, exist_ok=True)
DOCS_DIR.mkdir(parents=True, exist_ok=True)


def _load_keys():
    """Generate secrets on first run; keep them out of the code and out of git."""
    if KEYS_PATH.exists():
        return json.loads(KEYS_PATH.read_text())
    keys = {
        "flask_secret": secrets.token_hex(32),
        "fernet": Fernet.generate_key().decode(),
        "hmac": secrets.token_hex(32),
    }
    KEYS_PATH.write_text(json.dumps(keys))
    try:
        os.chmod(KEYS_PATH, 0o600)
    except OSError:
        pass
    return keys


KEYS = _load_keys()
FERNET = Fernet(KEYS["fernet"].encode())

app = Flask(__name__, static_folder="static", static_url_path="/static")
app.config.update(
    SECRET_KEY=os.environ.get("HBA_SECRET_KEY", KEYS["flask_secret"]),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=HTTPS,
    PERMANENT_SESSION_LIFETIME=dt.timedelta(hours=8),
    MAX_CONTENT_LENGTH=12 * 1024 * 1024,
)

# --------------------------------------------------------------------------
# Database
# --------------------------------------------------------------------------
SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  phone         TEXT NOT NULL,
  designation   TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff',          -- staff | admin
  kyc_status    TEXT NOT NULL DEFAULT 'none',           -- none | pending | verified | rejected
  created_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kyc_submissions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  legal_name    TEXT NOT NULL,
  dob           TEXT NOT NULL,
  id_type       TEXT NOT NULL,
  id_masked     TEXT NOT NULL,
  id_hmac       TEXT NOT NULL,
  front_path    TEXT,
  back_path     TEXT,
  checks_json   TEXT NOT NULL DEFAULT '{}',
  consent_at    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',        -- pending | verified | rejected
  reject_reason TEXT,
  submitted_at  TEXT NOT NULL,
  reviewed_by   TEXT,
  reviewed_at   TEXT
);
-- One government ID can back at most one pending/verified account.
CREATE UNIQUE INDEX IF NOT EXISTS ux_kyc_active_id
  ON kyc_submissions(id_hmac) WHERE status IN ('pending','verified');
CREATE TABLE IF NOT EXISTS app_state (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  rev         INTEGER NOT NULL DEFAULT 0,
  beds        TEXT,
  resources   TEXT,
  updated_at  TEXT,
  updated_by  TEXT,
  sim_owner   TEXT,
  sim_expires REAL NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO app_state(id, rev) VALUES (1, 0);
CREATE TABLE IF NOT EXISTS audit_logs (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  id          TEXT NOT NULL,
  timestamp   TEXT NOT NULL,
  staff       TEXT NOT NULL,
  user_id     INTEGER,
  action      TEXT NOT NULL,
  action_type TEXT NOT NULL,
  bed_id      TEXT,
  dept        TEXT,
  cat         TEXT,
  details     TEXT,
  notes       TEXT
);
"""


def get_db():
    if "db" not in g:
        conn = sqlite3.connect(DB_PATH, timeout=15, isolation_level=None)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        g.db = conn
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def now_iso():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()


def bootstrap_admin():
    """Create the first admin. Password comes from ADMIN_PASSWORD or is generated once."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    if conn.execute("SELECT 1 FROM users WHERE role='admin'").fetchone():
        conn.close()
        return
    email = os.environ.get("ADMIN_EMAIL", "admin@hospital.local").lower()
    pw = os.environ.get("ADMIN_PASSWORD")
    generated = pw is None
    if generated:
        pw = secrets.token_urlsafe(12)
    conn.execute(
        "INSERT INTO users(email,password_hash,full_name,phone,designation,role,kyc_status,created_at)"
        " VALUES (?,?,?,?,?,?,?,?)",
        (email, generate_password_hash(pw), "System Administrator", "0000000000",
         "Hospital Administrator", "admin", "verified", now_iso()))
    conn.commit()
    conn.close()
    print("\n" + "=" * 62)
    print(" First-run admin account created")
    print(f"   email   : {email}")
    if generated:
        print(f"   password: {pw}   <-- shown once, change it / store it safely")
    else:
        print("   password: (taken from ADMIN_PASSWORD)")
    print("=" * 62 + "\n")


# --------------------------------------------------------------------------
# Small helpers: rate limiting, CSRF, auth decorators
# --------------------------------------------------------------------------
_HITS = {}


def rate_limited(bucket, key, limit, window):
    """Sliding window counter (in-memory; use Redis/flask-limiter if you scale out)."""
    now = time.time()
    k = (bucket, key)
    hits = [t for t in _HITS.get(k, []) if now - t < window]
    if len(hits) >= limit:
        _HITS[k] = hits
        return True
    return False


def note_hit(bucket, key):
    _HITS.setdefault((bucket, key), []).append(time.time())


def client_ip():
    return request.remote_addr or "unknown"


def err(message, status=400, **extra):
    return jsonify({"error": message, **extra}), status


@app.before_request
def load_user_and_check_csrf():
    g.user = None
    uid = session.get("uid")
    if uid:
        row = get_db().execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
        if row:
            g.user = row
        else:
            session.clear()
    if "csrf" not in session:
        session["csrf"] = secrets.token_urlsafe(32)
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        sent = request.headers.get("X-CSRF-Token", "")
        if not hmac.compare_digest(sent, session.get("csrf", "")):
            return err("Invalid or missing CSRF token. Reload the page and try again.", 403)


@app.context_processor
def inject_globals():
    return {"csrf_token": session.get("csrf", ""), "user": g.get("user"),
            "kyc_mode": KYC_MODE}


@app.after_request
def security_headers(resp):
    strict = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
              "img-src 'self' data: blob:; frame-ancestors 'none'; base-uri 'none'; "
              "form-action 'self'; object-src 'none'")
    # The original dashboard builds HTML with inline onclick="" handlers, which a
    # strict CSP would block. Only the dashboard page gets this relaxation.
    relaxed = strict.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
    resp.headers["Content-Security-Policy"] = relaxed if g.get("relaxed_csp") else strict
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "no-referrer"
    if HTTPS:
        resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    if request.path.startswith("/api/") or request.path in ("/", "/app.js", "/kyc", "/admin/kyc"):
        resp.headers["Cache-Control"] = "no-store"
    return resp


def _deny(api, status, msg, page_redirect):
    return err(msg, status) if api else redirect(page_redirect)


def login_required(api=True):
    def deco(fn):
        @wraps(fn)
        def wrapper(*a, **kw):
            if g.user is None:
                return _deny(api, 401, "Please sign in.", "/login")
            return fn(*a, **kw)
        return wrapper
    return deco


def verified_required(api=True):
    def deco(fn):
        @wraps(fn)
        def wrapper(*a, **kw):
            if g.user is None:
                return _deny(api, 401, "Please sign in.", "/login")
            if g.user["kyc_status"] != "verified":
                if api:
                    return err("KYC verification required.", 403, code="kyc_required")
                return redirect("/kyc")
            return fn(*a, **kw)
        return wrapper
    return deco


def admin_required(api=True):
    def deco(fn):
        @wraps(fn)
        def wrapper(*a, **kw):
            if g.user is None:
                return _deny(api, 401, "Please sign in.", "/login")
            if g.user["role"] != "admin":
                return err("Administrator access required.", 403) if api else abort(403)
            return fn(*a, **kw)
        return wrapper
    return deco


def user_dict(u):
    return {"id": u["id"], "email": u["email"], "full_name": u["full_name"],
            "designation": u["designation"], "role": u["role"], "kyc_status": u["kyc_status"]}


# --------------------------------------------------------------------------
# Pages
# --------------------------------------------------------------------------
@app.route("/")
def index():
    if g.user is None:
        return redirect("/login")
    if g.user["kyc_status"] != "verified":
        return redirect("/kyc")           # <- the KYC gate: no dashboard until verified
    g.relaxed_csp = True
    return render_template("dashboard.html")


@app.route("/app.js")
@verified_required(api=False)
def dashboard_js():
    g.relaxed_csp = True
    return send_from_directory(BASE_DIR / "protected", "app.js",
                               mimetype="application/javascript")


@app.route("/login")
def login_page():
    if g.user:
        return redirect("/")
    return render_template("login.html")


@app.route("/register")
def register_page():
    if g.user:
        return redirect("/")
    return render_template("register.html", designations=DESIGNATIONS)


@app.route("/kyc")
@login_required(api=False)
def kyc_page():
    if g.user["kyc_status"] == "verified":
        return redirect("/")
    return render_template("kyc.html", id_types=ID_TYPES)


@app.route("/admin/kyc")
@admin_required(api=False)
def admin_kyc_page():
    return render_template("admin_kyc.html")


# --------------------------------------------------------------------------
# Auth API
# --------------------------------------------------------------------------
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")
PHONE_RE = re.compile(r"^[6-9][0-9]{9}$")
_DUMMY_HASH = generate_password_hash("not-a-real-password")


def _clean_name(raw, lo=2, hi=80):
    if not isinstance(raw, str):
        return None
    name = " ".join(raw.split())
    if not (lo <= len(name) <= hi):
        return None
    if not all(ch.isalpha() or ch in " .'’-" for ch in name):
        return None
    return name


@app.post("/api/register")
def api_register():
    if rate_limited("register", client_ip(), 10, 3600):
        return err("Too many sign-ups from this network. Try again later.", 429)
    d = request.get_json(silent=True) or {}
    email = str(d.get("email", "")).strip().lower()
    password = str(d.get("password", ""))
    name = _clean_name(d.get("full_name"))
    phone = re.sub(r"[\s-]", "", str(d.get("phone", "")))
    phone = phone[3:] if phone.startswith("+91") else phone
    designation = d.get("designation")

    if not EMAIL_RE.match(email) or len(email) > 120:
        return err("Enter a valid email address.")
    if len(password) < 8 or len(password) > 128 or not re.search(r"[A-Za-z]", password) \
            or not re.search(r"\d", password):
        return err("Password must be 8+ characters and contain letters and numbers.")
    if not name:
        return err("Enter your full name (letters only).")
    if not PHONE_RE.match(phone):
        return err("Enter a valid 10-digit Indian mobile number.")
    if designation not in DESIGNATIONS:
        return err("Choose your designation.")

    note_hit("register", client_ip())
    db = get_db()
    try:
        cur = db.execute(
            "INSERT INTO users(email,password_hash,full_name,phone,designation,created_at)"
            " VALUES (?,?,?,?,?,?)",
            (email, generate_password_hash(password), name, phone, designation, now_iso()))
    except sqlite3.IntegrityError:
        return err("An account with this email already exists.", 409)
    session.clear()
    session.permanent = True
    session["uid"] = cur.lastrowid
    session["csrf"] = secrets.token_urlsafe(32)
    return jsonify({"ok": True, "next": "/kyc", "csrf": session["csrf"]})


@app.post("/api/login")
def api_login():
    d = request.get_json(silent=True) or {}
    email = str(d.get("email", "")).strip().lower()
    password = str(d.get("password", ""))
    key = f"{client_ip()}|{email}"
    if rate_limited("login", key, 5, 900):
        return err("Too many failed attempts. Try again in 15 minutes.", 429)
    row = get_db().execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    ok = check_password_hash(row["password_hash"] if row else _DUMMY_HASH, password)
    if not (row and ok):
        note_hit("login", key)
        return err("Incorrect email or password.", 401)
    session.clear()                      # new session on login (prevents fixation)
    session.permanent = True
    session["uid"] = row["id"]
    session["csrf"] = secrets.token_urlsafe(32)
    nxt = "/" if row["kyc_status"] == "verified" else "/kyc"
    return jsonify({"ok": True, "next": nxt, "csrf": session["csrf"]})


@app.post("/api/logout")
def api_logout():
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/me")
@login_required()
def api_me():
    return jsonify({"user": user_dict(g.user), "csrf": session["csrf"]})


# --------------------------------------------------------------------------
# KYC API (user side)
# --------------------------------------------------------------------------
def external_verify(id_type, number, legal_name, dob):
    """
    HOOK for a licensed identity-verification provider.

    Offline checks cannot prove an ID is real or belongs to this person.
    To do that, call your provider here (DigiLocker / UIDAI e-KYC for Aadhaar,
    NSDL/Protean for PAN, ECI for EPIC, Parivahan for DL, PSP for passports,
    or an aggregator such as Digio / Signzy / IDfy / Karza) and return e.g.
        {"verified": True,  "provider": "digio", "name_match": 0.97}
    Return verified=None when no provider is configured.
    """
    return {"verified": None, "provider": None}


@app.get("/api/kyc/status")
@login_required()
def api_kyc_status():
    row = get_db().execute(
        "SELECT * FROM kyc_submissions WHERE user_id=? ORDER BY id DESC LIMIT 1",
        (g.user["id"],)).fetchone()
    sub = None
    if row:
        sub = {"status": row["status"], "id_type": ID_TYPES.get(row["id_type"], row["id_type"]),
               "id_masked": row["id_masked"], "submitted_at": row["submitted_at"],
               "reject_reason": row["reject_reason"], "legal_name": row["legal_name"]}
    return jsonify({"kyc_status": g.user["kyc_status"], "submission": sub, "mode": KYC_MODE})


def _read_upload(field, required):
    f = request.files.get(field)
    if not f or not f.filename:
        return (None, f"Upload the {field} of your ID.") if required else (None, None)
    data = f.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        return None, "Each file must be 5 MB or smaller."
    if len(data) < 1024:
        return None, "That file looks empty or corrupted."
    if sniff_upload(data) is None:
        return None, "Only JPG, PNG or PDF files are accepted."
    return data, None


def _store_encrypted(data):
    name = secrets.token_hex(16) + ".bin"
    (DOCS_DIR / name).write_bytes(FERNET.encrypt(data))
    return name


def _remove_doc(name):
    if name:
        try:
            (DOCS_DIR / name).unlink()
        except FileNotFoundError:
            pass


@app.post("/api/kyc")
@login_required()
def api_kyc_submit():
    u = g.user
    if u["kyc_status"] in ("pending", "verified"):
        return err("Your KYC is already " + u["kyc_status"] + ".", 409)
    if rate_limited("kyc", str(u["id"]), 5, 3600):
        return err("Too many attempts. Please try again later.", 429)

    f = request.form
    legal_name = _clean_name(f.get("legal_name"))
    id_type = f.get("id_type", "")
    number_raw = f.get("id_number", "")
    if not legal_name:
        return err("Enter your name exactly as printed on the ID (letters only).")
    try:
        dob = dt.date.fromisoformat(f.get("dob", ""))
    except ValueError:
        return err("Enter a valid date of birth.")
    today = dt.date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    if age < 18 or age > 100:
        return err("You must be at least 18 years old.")
    if id_type not in ID_TYPES:
        return err("Choose a valid ID type.")
    number, problem = validate_id(id_type, number_raw)
    if problem:
        return err(problem)
    if f.get("consent") != "yes":
        return err("You must consent to identity verification to continue.")

    front, e1 = _read_upload("front", True)
    if e1:
        return err(e1)
    back, e2 = _read_upload("back", False)
    if e2:
        return err(e2)

    id_hmac = hmac.new(KEYS["hmac"].encode(), f"{id_type}:{number}".encode(),
                       hashlib.sha256).hexdigest()
    ext = external_verify(id_type, number, legal_name, dob.isoformat())
    checks = {"format_ok": True, "checksum_ok": id_type == "aadhaar" or None,
              "name_matches_account": legal_name.lower() == u["full_name"].lower(),
              "external": ext}

    front_name = back_name = None
    db = get_db()
    try:
        front_name = _store_encrypted(front)
        back_name = _store_encrypted(back) if back else None
        db.execute("BEGIN IMMEDIATE")
        db.execute(
            "INSERT INTO kyc_submissions(user_id,legal_name,dob,id_type,id_masked,id_hmac,"
            "front_path,back_path,checks_json,consent_at,submitted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (u["id"], legal_name, dob.isoformat(), id_type, mask_id(number), id_hmac,
             front_name, back_name, json.dumps(checks), now_iso(), now_iso()))
        new_status = "pending"
        if KYC_MODE == "demo":
            new_status = "verified"
            db.execute("UPDATE kyc_submissions SET status='verified', reviewed_by='auto-demo',"
                       " reviewed_at=? WHERE user_id=? AND status='pending'", (now_iso(), u["id"]))
        db.execute("UPDATE users SET kyc_status=? WHERE id=?", (new_status, u["id"]))
        db.execute("COMMIT")
    except sqlite3.IntegrityError:
        db.execute("ROLLBACK")
        _remove_doc(front_name); _remove_doc(back_name)
        return err("This ID has already been submitted for another account. "
                   "Contact your administrator if you think this is a mistake.", 409)
    except Exception:
        try:
            db.execute("ROLLBACK")
        except sqlite3.Error:
            pass
        _remove_doc(front_name); _remove_doc(back_name)
        app.logger.exception("KYC submit failed")
        return err("Could not save your submission. Please try again.", 500)

    note_hit("kyc", str(u["id"]))
    return jsonify({"ok": True, "status": new_status,
                    "next": "/" if new_status == "verified" else "/kyc"})


# --------------------------------------------------------------------------
# KYC API (admin side)
# --------------------------------------------------------------------------
@app.get("/api/admin/kyc")
@admin_required()
def api_admin_kyc_list():
    status = request.args.get("status", "pending")
    q = ("SELECT s.*, u.email, u.full_name AS account_name, u.phone, u.designation "
         "FROM kyc_submissions s JOIN users u ON u.id = s.user_id ")
    args = ()
    if status in ("pending", "verified", "rejected"):
        q += "WHERE s.status=? "
        args = (status,)
    q += "ORDER BY s.id DESC LIMIT 200"
    out = []
    for r in get_db().execute(q, args).fetchall():
        checks = json.loads(r["checks_json"] or "{}")
        out.append({
            "id": r["id"], "status": r["status"], "email": r["email"],
            "account_name": r["account_name"], "phone": r["phone"],
            "designation": r["designation"], "legal_name": r["legal_name"],
            "dob": r["dob"], "id_type": ID_TYPES.get(r["id_type"], r["id_type"]),
            "id_masked": r["id_masked"], "submitted_at": r["submitted_at"],
            "name_matches_account": checks.get("name_matches_account"),
            "checksum_ok": checks.get("checksum_ok"),
            "has_front": bool(r["front_path"]), "has_back": bool(r["back_path"]),
            "reject_reason": r["reject_reason"], "reviewed_by": r["reviewed_by"],
            "reviewed_at": r["reviewed_at"],
        })
    return jsonify({"items": out})


@app.get("/api/admin/kyc/<int:sub_id>/doc/<side>")
@admin_required()
def api_admin_kyc_doc(sub_id, side):
    if side not in ("front", "back"):
        abort(404)
    row = get_db().execute("SELECT front_path, back_path FROM kyc_submissions WHERE id=?",
                           (sub_id,)).fetchone()
    name = row[f"{side}_path"] if row else None
    if not name or not re.fullmatch(r"[0-9a-f]{32}\.bin", name):
        abort(404)
    try:
        data = FERNET.decrypt((DOCS_DIR / name).read_bytes())
    except (FileNotFoundError, InvalidToken):
        abort(404)
    app.logger.info("KYC doc %s/%s viewed by admin %s", sub_id, side, g.user["email"])
    return Response(data, mimetype=sniff_upload(data) or "application/octet-stream",
                    headers={"Content-Disposition": "inline"})


@app.post("/api/admin/kyc/<int:sub_id>/decision")
@admin_required()
def api_admin_kyc_decision(sub_id):
    d = request.get_json(silent=True) or {}
    decision = d.get("decision")
    reason = " ".join(str(d.get("reason", "")).split())[:300]
    if decision not in ("approve", "reject"):
        return err("Invalid decision.")
    if decision == "reject" and len(reason) < 3:
        return err("Give the applicant a short reason for rejection.")
    db = get_db()
    db.execute("BEGIN IMMEDIATE")
    row = db.execute("SELECT * FROM kyc_submissions WHERE id=?", (sub_id,)).fetchone()
    if not row or row["status"] != "pending":
        db.execute("ROLLBACK")
        return err("This submission is no longer pending.", 409)
    if row["user_id"] == g.user["id"]:
        db.execute("ROLLBACK")
        return err("You cannot review your own KYC submission.", 403)
    new = "verified" if decision == "approve" else "rejected"
    db.execute("UPDATE kyc_submissions SET status=?, reject_reason=?, reviewed_by=?, reviewed_at=?"
               " WHERE id=?", (new, reason if new == "rejected" else None, g.user["email"],
                               now_iso(), sub_id))
    db.execute("UPDATE users SET kyc_status=? WHERE id=?", (new, row["user_id"]))
    if PURGE_DOCS_ON_DECISION:
        db.execute("UPDATE kyc_submissions SET front_path=NULL, back_path=NULL WHERE id=?", (sub_id,))
    db.execute("COMMIT")
    if PURGE_DOCS_ON_DECISION:
        _remove_doc(row["front_path"]); _remove_doc(row["back_path"])
    app.logger.info("KYC %s %s by %s", sub_id, new, g.user["email"])
    return jsonify({"ok": True, "status": new})


# --------------------------------------------------------------------------
# Dashboard state API (verified users only)
# --------------------------------------------------------------------------
_KEY_RE = re.compile(r"^[A-Za-z0-9_]{1,40}$")
_BEDID_RE = re.compile(r"^[A-Za-z0-9_-]{1,32}$")
_ESC = str.maketrans({"<": "&lt;", ">": "&gt;", '"': "&quot;"})


class Invalid(ValueError):
    pass


def sanitize(v, depth=0):
    """
    The dashboard builds HTML from this data with innerHTML. Now that data is
    shared between users, a malicious value would be stored XSS, so neutralise
    < > and " in every string. The transform never touches '&', so it is
    idempotent (client -> server -> client -> server does not double-escape).
    """
    if depth > 6:
        raise Invalid("nesting too deep")
    if isinstance(v, str):
        if len(v) > 600:
            raise Invalid("text too long")
        return v.translate(_ESC)
    if isinstance(v, bool) or v is None:
        return v
    if isinstance(v, (int, float)):
        if not math.isfinite(v):
            raise Invalid("bad number")
        return v
    if isinstance(v, list):
        if len(v) > 2000:
            raise Invalid("list too long")
        return [sanitize(x, depth + 1) for x in v]
    if isinstance(v, dict):
        out = {}
        for k, x in v.items():
            if not isinstance(k, str) or not _KEY_RE.match(k):
                raise Invalid("bad key")
            out[k] = sanitize(x, depth + 1)
        return out
    raise Invalid("unsupported value")


def validate_state(beds, resources):
    if not isinstance(beds, list) or not (1 <= len(beds) <= 500):
        raise Invalid("beds must be a list of 1-500 items")
    seen = set()
    for b in beds:
        if not isinstance(b, dict):
            raise Invalid("bad bed")
        bid = b.get("id")
        if not isinstance(bid, str) or not _BEDID_RE.match(bid) or bid in seen:
            raise Invalid("bad or duplicate bed id")
        seen.add(bid)
        if b.get("dept") not in DEPT_IDS or b.get("cat") not in CAT_IDS \
                or b.get("status") not in STATUS_IDS:
            raise Invalid(f"bad dept/category/status on {bid}")
        if b.get("patient") is not None and not isinstance(b["patient"], dict):
            raise Invalid("bad patient")
        res = b.get("resources", [])
        if not isinstance(res, list) or any(r not in RESOURCE_KEYS for r in res):
            raise Invalid("bad bed resources")
        m = b.get("cleaningMinutesLeft")
        if m is not None and (not isinstance(m, (int, float)) or m < 0 or m > 10000):
            raise Invalid("bad cleaning time")
    if not isinstance(resources, dict) or set(resources) - RESOURCE_KEYS:
        raise Invalid("bad resources")
    for r in resources.values():
        if not isinstance(r, dict):
            raise Invalid("bad resource entry")
        for k in ("total", "inUse", "inMaint"):
            if not isinstance(r.get(k), (int, float)) or not (0 <= r[k] <= 100000):
                raise Invalid("bad resource counts")


def _audit_rows(limit=500):
    rows = get_db().execute(
        "SELECT * FROM audit_logs ORDER BY seq DESC LIMIT ?", (limit,)).fetchall()
    return [{"id": r["id"], "timestamp": r["timestamp"], "staff": r["staff"],
             "action": r["action"], "actionType": r["action_type"], "bedId": r["bed_id"],
             "dept": r["dept"], "cat": r["cat"], "details": r["details"] or "",
             "notes": r["notes"] or ""} for r in rows]


def _state_payload(row):
    return {"rev": row["rev"],
            "beds": json.loads(row["beds"]) if row["beds"] else None,
            "resources": json.loads(row["resources"]) if row["resources"] else None,
            "auditLogs": _audit_rows()}


@app.get("/api/state")
@verified_required()
def api_state_get():
    row = get_db().execute("SELECT * FROM app_state WHERE id=1").fetchone()
    try:
        known = int(request.args.get("rev", "-1"))
    except ValueError:
        known = -1
    if known == row["rev"]:
        return jsonify({"changed": False, "rev": row["rev"]})
    return jsonify({"changed": True, **_state_payload(row)})


@app.put("/api/state")
@verified_required()
def api_state_put():
    if (request.content_length or 0) > MAX_STATE_BYTES:
        return err("State too large.", 413)
    d = request.get_json(silent=True)
    if not isinstance(d, dict):
        return err("Invalid JSON.")
    try:
        base_rev = int(d.get("baseRev"))
        beds = sanitize(d.get("beds"))
        resources = sanitize(d.get("resources"))
        validate_state(beds, resources)
        new_logs = d.get("newAuditLogs") or []
        if not isinstance(new_logs, list) or len(new_logs) > 100:
            raise Invalid("bad audit batch")
        clean_logs = []
        for e in new_logs:
            if not isinstance(e, dict):
                raise Invalid("bad audit entry")
            action = str(e.get("action", ""))
            atype = str(e.get("actionType", "status"))
            if not re.fullmatch(r"[A-Z0-9_]{1,60}", action) or not re.fullmatch(r"[a-z_]{1,20}", atype):
                raise Invalid("bad audit entry")
            clean_logs.append((action, atype,
                               *(str(sanitize(str(e.get(k, ""))[:500])) for k in
                                 ("bedId", "dept", "cat", "details", "notes"))))
    except (Invalid, TypeError, ValueError) as ex:
        return err(f"Rejected: {ex}", 422)

    wants_reset = bool(d.get("reset"))
    if wants_reset and g.user["role"] != "admin":
        return err("Only an administrator can reset the dashboard.", 403)

    db = get_db()
    db.execute("BEGIN IMMEDIATE")
    row = db.execute("SELECT * FROM app_state WHERE id=1").fetchone()
    if row["rev"] != base_rev and not wants_reset:
        db.execute("ROLLBACK")
        return jsonify({"error": "conflict", **_state_payload(row)}), 409
    new_rev = row["rev"] + 1
    db.execute("UPDATE app_state SET rev=?, beds=?, resources=?, updated_at=?, updated_by=? WHERE id=1",
               (new_rev, json.dumps(beds), json.dumps(resources), now_iso(), g.user["email"]))
    if wants_reset:
        db.execute("DELETE FROM audit_logs")
    for action, atype, bed_id, dept, cat, details, notes in clean_logs:
        db.execute(
            "INSERT INTO audit_logs(id,timestamp,staff,user_id,action,action_type,bed_id,dept,cat,details,notes)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            ("log_" + uuid.uuid4().hex[:12], now_iso(), g.user["full_name"], g.user["id"],
             action, atype, bed_id, dept, cat, details, notes))
    db.execute("COMMIT")
    return jsonify({"ok": True, "rev": new_rev})


@app.post("/api/sim/lease")
@verified_required()
def api_sim_lease():
    """
    The demo simulation (cleaning countdowns) runs in a browser. With several
    users online only ONE tab at a time may drive it, otherwise every tab would
    tick the same beds. A tab asks for a short lease and ticks only if it has it.
    """
    client = str((request.get_json(silent=True) or {}).get("client", ""))[:40]
    if not re.fullmatch(r"[A-Za-z0-9_-]{6,40}", client):
        return err("Bad client id.")
    db = get_db()
    db.execute("BEGIN IMMEDIATE")
    row = db.execute("SELECT sim_owner, sim_expires FROM app_state WHERE id=1").fetchone()
    now = time.time()
    leader = row["sim_owner"] == client or row["sim_expires"] < now or not row["sim_owner"]
    if leader:
        db.execute("UPDATE app_state SET sim_owner=?, sim_expires=? WHERE id=1", (client, now + 30))
    db.execute("COMMIT")
    return jsonify({"leader": leader})


# --------------------------------------------------------------------------
# CLI + entry point
# --------------------------------------------------------------------------
@app.cli.command("create-admin")
def cli_create_admin():
    """flask --app app create-admin  (uses ADMIN_EMAIL / ADMIN_PASSWORD)"""
    bootstrap_admin()


init_db()
bootstrap_admin()

if __name__ == "__main__":
    if KYC_MODE == "demo":
        print("!! KYC_MODE=demo: submissions are auto-approved. Never use this in production.")
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8080"))
    print(f"Serving on http://{host}:{port}/  (KYC mode: {KYC_MODE})")
    if os.environ.get("HBA_PROD") == "1":
        from waitress import serve          # pip install waitress
        serve(app, host=host, port=port)
    else:
        app.run(host=host, port=port, debug=False)
