"""
Offline format validation for Indian government ID numbers.

IMPORTANT: this only checks that a number is *well-formed* (and, for Aadhaar,
that its Verhoeff checksum is correct). It cannot tell you that the number
belongs to the person submitting it, or that it exists. That is what the
document upload + admin review step is for. To verify against the issuing
authority you need a licensed provider (DigiLocker / UIDAI e-KYC / NSDL PAN
verification, or an aggregator such as Digio, Signzy, IDfy, Karza). See
`external_verify()` in app.py for the hook.
"""
import re

ID_TYPES = {
    "aadhaar": "Aadhaar Card",
    "pan": "PAN Card",
    "voter_id": "Voter ID (EPIC)",
    "driving_licence": "Driving Licence",
    "passport": "Passport",
}

# --- Verhoeff checksum (used by Aadhaar) ---------------------------------
_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]
_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9]


def verhoeff_valid(number: str) -> bool:
    c = 0
    for i, ch in enumerate(reversed(number)):
        c = _D[c][_P[i % 8][int(ch)]]
    return c == 0


def verhoeff_check_digit(number: str) -> str:
    """Used by the tests to build valid sample Aadhaar numbers."""
    c = 0
    for i, ch in enumerate(reversed(number)):
        c = _D[c][_P[(i + 1) % 8][int(ch)]]
    return str(_INV[c])


# --- Per-document validators ----------------------------------------------
def _aadhaar(raw):
    n = re.sub(r"[\s-]", "", raw)
    if not re.fullmatch(r"[2-9][0-9]{11}", n):
        return None, "Aadhaar must be 12 digits and cannot start with 0 or 1."
    if not verhoeff_valid(n):
        return None, "This Aadhaar number fails the checksum. Please re-check it."
    return n, None


def _pan(raw):
    n = re.sub(r"\s", "", raw).upper()
    # 4th character = holder type (P individual, C company, H HUF, F firm, ...)
    if not re.fullmatch(r"[A-Z]{3}[ABCFGHLJPT][A-Z][0-9]{4}[A-Z]", n):
        return None, "PAN must look like ABCDE1234F (5 letters, 4 digits, 1 letter)."
    return n, None


def _voter(raw):
    n = re.sub(r"\s", "", raw).upper()
    if not re.fullmatch(r"[A-Z]{3}[0-9]{7}", n):
        return None, "Voter ID (EPIC) must be 3 letters followed by 7 digits."
    return n, None


def _dl(raw):
    n = re.sub(r"[\s-]", "", raw).upper()
    if not re.fullmatch(r"[A-Z]{2}[0-9]{2}(19|20)[0-9]{2}[0-9]{7}", n):
        return None, ("Driving licence must look like DL-0420110149646 "
                      "(state code, RTO code, year, 7-digit serial).")
    return n, None


def _passport(raw):
    n = re.sub(r"\s", "", raw).upper()
    if not re.fullmatch(r"[A-Z][0-9]{7}", n):
        return None, "Passport number must be 1 letter followed by 7 digits."
    return n, None


_VALIDATORS = {
    "aadhaar": _aadhaar, "pan": _pan, "voter_id": _voter,
    "driving_licence": _dl, "passport": _passport,
}


def validate_id(id_type: str, raw: str):
    """Return (normalised_number, error). Exactly one of the two is None."""
    fn = _VALIDATORS.get(id_type)
    if fn is None:
        return None, "Unsupported ID type."
    if not isinstance(raw, str) or not raw.strip():
        return None, "ID number is required."
    if len(raw) > 40:
        return None, "ID number is too long."
    return fn(raw)


def mask_id(normalised: str) -> str:
    """Keep only the last 4 characters: all we ever store in readable form."""
    return "X" * max(0, len(normalised) - 4) + normalised[-4:]


# --- File sniffing (never trust the client's filename / content-type) -----
def sniff_upload(data: bytes):
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    return None
