"""End-to-end tests. Run:  python tests/test_flow.py"""
import io
import json
import os
import re
import sys
import tempfile
import unittest

TMP = tempfile.mkdtemp()
os.environ["HBA_DATA_DIR"] = TMP
os.environ["ADMIN_EMAIL"] = "admin@test.local"
os.environ["ADMIN_PASSWORD"] = "AdminPass123"
os.environ["KYC_MODE"] = "manual"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app as hba                      # noqa: E402
from kyc_validation import verhoeff_check_digit   # noqa: E402

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 2048


def aadhaar(seed):
    base = ("2" + str(seed).zfill(10))[:11]
    return base + verhoeff_check_digit(base)


class Client:
    def __init__(self):
        self.c = hba.app.test_client()
        html = self.c.get("/login").get_data(as_text=True)
        self.csrf = re.search(r'name="csrf-token" content="([^"]+)"', html).group(1)

    def h(self):
        return {"X-CSRF-Token": self.csrf}

    def post(self, url, **kw):
        return self.c.post(url, headers=self.h(), **kw)

    def put(self, url, **kw):
        return self.c.put(url, headers=self.h(), **kw)

    def login(self, email, pw):
        r = self.post("/api/login", json={"email": email, "password": pw})
        if r.status_code == 200:
            self.csrf = r.get_json()["csrf"]
        return r

    def register(self, email, name="Priya Sharma", phone="9876543210", pw="Password1"):
        r = self.post("/api/register", json={"email": email, "password": pw, "full_name": name,
                                              "phone": phone, "designation": "Nurse"})
        if r.status_code == 200:
            self.csrf = r.get_json()["csrf"]
        return r

    def kyc(self, number, id_type="aadhaar", name="Priya Sharma", front=PNG, back=None, consent="yes"):
        data = {"id_type": id_type, "id_number": number, "legal_name": name, "dob": "1995-04-12",
                "consent": consent, "front": (io.BytesIO(front), "front.png")}
        if back:
            data["back"] = (io.BytesIO(back), "back.png")
        return self.c.post("/api/kyc", headers=self.h(), data=data, content_type="multipart/form-data")


def seed_beds():
    return [{"id": "ED-EM-01", "name": "Bay 1", "dept": "ED", "cat": "emergency", "status": "available",
             "patient": None, "resources": ["monitors"]},
            {"id": "CCU-ICU-01", "name": "ICU 1", "dept": "CCU", "cat": "icu", "status": "occupied",
             "patient": {"name": "A B", "mrn": "MRN-1"}, "resources": []}]


def seed_res():
    return {"ventilators": {"total": 5, "inUse": 1, "inMaint": 0}}


class Flow(unittest.TestCase):
    def test_1_gate_and_kyc(self):
        anon = Client()
        self.assertEqual(anon.c.get("/").status_code, 302)
        self.assertIn("/login", anon.c.get("/").headers["Location"])
        self.assertEqual(anon.c.get("/app.js").status_code, 302)       # dashboard code not served
        self.assertEqual(anon.c.get("/api/state").status_code, 401)

        u = Client()
        self.assertEqual(u.register("nurse1@test.local").status_code, 200)
        self.assertIn("/kyc", u.c.get("/").headers["Location"])        # redirected to KYC
        self.assertIn("/kyc", u.c.get("/app.js").headers["Location"])  # JS still withheld
        r = u.c.get("/api/state")
        self.assertEqual((r.status_code, r.get_json()["code"]), (403, "kyc_required"))

        # no CSRF header -> rejected
        self.assertEqual(u.c.post("/api/logout").status_code, 403)

        # validation
        bad = aadhaar(1)[:-1] + str((int(aadhaar(1)[-1]) + 1) % 10)
        self.assertEqual(u.kyc(bad).status_code, 400)                              # checksum
        self.assertEqual(u.kyc(aadhaar(1), consent="no").status_code, 400)         # consent
        self.assertEqual(u.kyc(aadhaar(1), front=b"MZ" + b"\x00" * 3000).status_code, 400)  # not an image
        self.assertEqual(u.kyc("abcde1234f", id_type="aadhaar").status_code, 400)
        self.assertEqual(u.kyc("ABCPE1234F", id_type="pan").status_code, 200)      # valid PAN -> pending

        r = u.c.get("/api/kyc/status").get_json()
        self.assertEqual(r["kyc_status"], "pending")
        self.assertEqual(r["submission"]["id_masked"], "XXXXXX234F")
        self.assertIn("/kyc", u.c.get("/").headers["Location"])                    # still gated
        self.assertEqual(u.kyc("ABCPE1234F", id_type="pan").status_code, 409)      # already pending

        # same ID on a second account -> blocked
        v = Client()
        v.register("nurse2@test.local", name="Other Person")
        self.assertEqual(v.kyc("ABCPE1234F", id_type="pan", name="Other Person").status_code, 409)

    def test_2_admin_review_and_dashboard(self):
        u = Client()
        u.register("doc@test.local", name="Amit Verma", phone="9123456780")
        self.assertEqual(u.kyc(aadhaar(555), name="Amit Verma", back=PNG).status_code, 200)

        # normal staff cannot touch admin endpoints
        self.assertEqual(u.c.get("/api/admin/kyc").status_code, 403)
        self.assertEqual(u.c.get("/admin/kyc").status_code, 403)

        a = Client()
        self.assertEqual(a.login("admin@test.local", "AdminPass123").status_code, 200)
        items = a.c.get("/api/admin/kyc?status=pending").get_json()["items"]
        it = next(i for i in items if i["email"] == "doc@test.local")
        self.assertTrue(it["name_matches_account"])
        self.assertTrue(it["checksum_ok"])
        self.assertNotIn(aadhaar(555), json.dumps(it))                 # full number never exposed
        doc = a.c.get(f"/api/admin/kyc/{it['id']}/doc/front")
        self.assertEqual((doc.status_code, doc.data, doc.mimetype), (200, PNG, "image/png"))

        # reject needs a reason
        self.assertEqual(a.post(f"/api/admin/kyc/{it['id']}/decision", json={"decision": "reject"}).status_code, 400)
        self.assertEqual(a.post(f"/api/admin/kyc/{it['id']}/decision", json={"decision": "approve"}).status_code, 200)
        self.assertEqual(a.post(f"/api/admin/kyc/{it['id']}/decision", json={"decision": "approve"}).status_code, 409)
        self.assertEqual(a.c.get(f"/api/admin/kyc/{it['id']}/doc/front").status_code, 404)   # docs purged
        self.assertEqual(os.listdir(hba.DOCS_DIR).count(""), 0)

        # now the user gets the dashboard
        self.assertEqual(u.c.get("/").status_code, 200)
        self.assertIn(b"Amit Verma", u.c.get("/").data)
        self.assertEqual(u.c.get("/app.js").status_code, 200)

    def _verified_user(self, email, name, num):
        u = Client()
        u.register(email, name=name, phone="9000000001")
        u.kyc(aadhaar(num), name=name)
        a = Client(); a.login("admin@test.local", "AdminPass123")
        it = next(i for i in a.c.get("/api/admin/kyc?status=pending").get_json()["items"] if i["email"] == email)
        a.post(f"/api/admin/kyc/{it['id']}/decision", json={"decision": "approve"})
        return u

    def test_3_state_api(self):
        u1 = self._verified_user("s1@test.local", "Sunita Rao", 1001)
        u2 = self._verified_user("s2@test.local", "Rahul Das", 1002)

        s = u1.c.get("/api/state").get_json()
        base = s["rev"]
        # seed / save with a lying client: staff name must come from the login
        r = u1.put("/api/state", json={"baseRev": base, "beds": seed_beds(), "resources": seed_res(),
            "newAuditLogs": [{"action": "PATIENT_ADMIT", "actionType": "admit", "bedId": "ED-EM-01",
                              "dept": "ED", "cat": "emergency", "details": "x", "notes": "n", "staff": "Dr. Fake"}]})
        self.assertEqual(r.status_code, 200)
        rev1 = r.get_json()["rev"]
        logs = u2.c.get("/api/state").get_json()["auditLogs"]
        self.assertEqual(logs[0]["staff"], "Sunita Rao")

        # stale write is refused, not merged
        r = u2.put("/api/state", json={"baseRev": base, "beds": seed_beds(), "resources": seed_res()})
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.get_json()["rev"], rev1)

        # polling shortcut
        self.assertFalse(u2.c.get(f"/api/state?rev={rev1}").get_json()["changed"])

        # stored-XSS attempt is neutralised, and re-saving doesn't double-escape
        evil = seed_beds()
        evil[1]["patient"]["name"] = '<img src=x onerror=alert(1)>"'
        evil[1]["patient"]["diagnosis"] = "SBP < 90"
        rev = rev1
        for _ in range(2):
            r = u1.put("/api/state", json={"baseRev": rev, "beds": evil, "resources": seed_res()})
            self.assertEqual(r.status_code, 200); rev = r.get_json()["rev"]
            evil = u1.c.get("/api/state").get_json()["beds"]
        p = evil[1]["patient"]
        self.assertEqual(p["name"], "&lt;img src=x onerror=alert(1)&gt;&quot;")
        self.assertEqual(p["diagnosis"], "SBP &lt; 90")

        # structural validation
        for mutate in (lambda b: b[0].update(status="exploded"),
                       lambda b: b[0].update(id="a'b"),
                       lambda b: b[0].update(dept="XX"),
                       lambda b: b[0].update(resources=["laser"])):
            b = seed_beds(); mutate(b)
            r = u1.put("/api/state", json={"baseRev": rev, "beds": b, "resources": seed_res()})
            self.assertEqual(r.status_code, 422, r.get_data(as_text=True))

        # only admins can reset
        r = u1.put("/api/state", json={"baseRev": rev, "beds": seed_beds(), "resources": seed_res(), "reset": True})
        self.assertEqual(r.status_code, 403)
        a = Client(); a.login("admin@test.local", "AdminPass123")
        s = a.c.get("/api/state").get_json()
        r = a.put("/api/state", json={"baseRev": s["rev"], "beds": seed_beds(), "resources": seed_res(), "reset": True})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(a.c.get("/api/state").get_json()["auditLogs"], [])

        # simulation lease: one leader at a time
        self.assertTrue(u1.post("/api/sim/lease", json={"client": "tab-aaaaaa"}).get_json()["leader"])
        self.assertFalse(u2.post("/api/sim/lease", json={"client": "tab-bbbbbb"}).get_json()["leader"])
        self.assertTrue(u1.post("/api/sim/lease", json={"client": "tab-aaaaaa"}).get_json()["leader"])

    def test_4_reject_resubmit_and_login_throttle(self):
        u = Client()
        u.register("rej@test.local", name="Kiran Mehta", phone="9000000002")
        u.kyc("DL-0420110149646", id_type="driving_licence", name="Kiran Mehta")
        a = Client(); a.login("admin@test.local", "AdminPass123")
        it = next(i for i in a.c.get("/api/admin/kyc?status=pending").get_json()["items"] if i["email"] == "rej@test.local")
        self.assertEqual(a.post(f"/api/admin/kyc/{it['id']}/decision",
                                json={"decision": "reject", "reason": "Photo is blurry"}).status_code, 200)
        st = u.c.get("/api/kyc/status").get_json()
        self.assertEqual((st["kyc_status"], st["submission"]["reject_reason"]), ("rejected", "Photo is blurry"))
        self.assertIn("/kyc", u.c.get("/").headers["Location"])
        # rejected user can resubmit the same ID
        self.assertEqual(u.kyc("DL-0420110149646", id_type="driving_licence", name="Kiran Mehta").status_code, 200)

        t = Client()
        codes = [t.login("nobody@test.local", "wrongpass1").status_code for _ in range(6)]
        self.assertEqual(codes[:5], [401] * 5)
        self.assertEqual(codes[5], 429)

    def test_5_headers(self):
        c = Client()
        r = c.c.get("/login")
        self.assertIn("script-src 'self';", r.headers["Content-Security-Policy"])
        self.assertEqual(r.headers["X-Frame-Options"], "DENY")


if __name__ == "__main__":
    unittest.main(verbosity=2)
