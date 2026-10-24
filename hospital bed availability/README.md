# Hospital Bed Availability & Resource Coordination System

An enterprise-grade, real-time hospital bed census, category allocation, and critical resource coordination dashboard designed for clinical operations teams, triage charge nurses, attending physicians, bed coordinators, and hospital leadership.

---

## 🌟 Key Features

### 1. Prominent Doctor Assigned at Every Bed & in Every Department
- **At Each Bed**: When a bed is occupied or reserved, a distinct **Assigned Doctor Card** is displayed front-and-center with:
  - Doctor's Avatar Initials (e.g. `DC`, `RG`, `SS`)
  - Full Name (e.g., `Dr. David Chen, MD`, `Dr. Robert Gupta, MD`)
  - Subspecialty Pill (e.g. `Emergency Critical Care`, `Chief Interventional Cardiologist`, `Neuro-Intensivist`)
- **In Each Department View**:
  - **Attending Doctors on Duty Panel**: Displays all physicians currently managing patients in the department.
  - Shows each doctor's live active patient count in that department (e.g. `Dr. Robert Gupta (2 patients)`).
  - **One-Click Filtering**: Clicking any doctor's badge filters the bed census grid to instantly highlight only beds assigned to that doctor!

### 2. "Complete All Sanitization" Feature
- **Hospital-Wide Fast Action**: One-click **`✨ Complete All Sanitization`** button in the header and overview view:
  - Scans all beds currently in status `Cleaning`.
  - Instantly verifies UV sterilization and returns all beds to `Available` status.
  - Resets cleaning countdowns to zero.
  - Logs a formal sanitization sign-off audit event with the list of bed IDs and timestamp.
  - Plays a clean audio chime and triggers an alert feed update.
- **Department-Specific Action**: **`✨ Sanitize Dept Beds`** button inside each department dashboard to complete turnaround for that specific ward only.

### 3. "Discharge Recovered Patients" Feature
- **Batch Discharge**: One-click **`🩺 Discharge Recovered`** button in the top header and department views:
  - Identifies all occupied beds where patients are clinically recovered or meet discharge criteria.
  - Discharges them in one coordinated step, frees attached equipment back to the fleet pool, and transitions their beds to the `Cleaning` queue.
- **Individual Patient Recovery Toggle**:
  - Every occupied bed features a **`Mark Recovered` / `✓ Ready to Discharge`** toggle button.
  - Displays a green `✓ Recovered` badge so charge nurses can visually identify discharge-ready patients at a glance.

### 4. Comprehensive Real-Time Operational Clock & Timing
- **Live Header Operational Clock**:
  - Live ticking digital clock (`HH:MM:SS AM/PM`) and date (`Oct 24, 2026`).
  - Automatic Shift Detection: `Day Shift (07:00 - 19:00)` vs `Night Shift (19:00 - 07:00)`.
- **Bed Admission Time & Length of Stay (LOS)**:
  - Displays exact admission timestamp (e.g., `🕒 In: Today 10:15 AM`).
  - Live calculated elapsed duration of stay (e.g., `⏳ Stay: 2h 15m`, `1d 4h`).
- **Cleaning Turnaround Countdown**:
  - Real-time countdown timer on beds undergoing terminal cleaning (e.g., `⏱️ 12m countdown`).
- **Audit History Timestamps**:
  - Exact time, date, and operator logged on every clinical and operational action.

### 5. Dedicated Department Dashboards & Bed Categories
- 7 Specialized Clinical Departments:
  1. **Emergency & Trauma Center (ED)**
  2. **Cardiology & Critical Care (CCU)**
  3. **Neurology & Stroke Center (NICU / Neuro)**
  4. **Pediatrics & PICU**
  5. **General Surgery & Post-Op (SICU / PACU)**
  6. **Pulmonology & Respiratory Care**
  7. **Oncology & Hematology**
- Specific bed category tracking:
  - ⚡ **ICU Beds**: Critical care with ventilator readiness and critical low alerts ($\le 1$ bed free).
  - 🚨 **Emergency Beds**: Rapid intake bays with surge monitoring ($>80\%$ occupancy).
  - 🛌 **Rooms for Longer Stays**: Inpatient recovery rooms and step-down suites.

### 6. Hospital-Wide Executive Overview
- Top KPI Summary Cards: Total Beds, Available Beds, Occupied Beds, Global Occupancy %, Sanitization Queue, and Out of Service.
- Department Census Comparison Matrix with live occupancy meters.
- Multi-parameter filter toolbar by department, category, status, acuity, doctor, and search text.

### 7. Critical Resource Pool & Immutable Audit History
- Live fleet meters for Ventilators, Vital Sign Monitors, Infusion Pumps, High-Flow O2, Crash Carts, and Dialysis units.
- Complete operational audit log with **1-click CSV export**.

---

## 🚀 How to Run the Dashboard

### Option 1: Direct Browser Launch (No Installation Required)
Simply double-click or open `index.html` in any modern web browser:
```powershell
Start-Process "c:\hospital bed availability\index.html"
```
Or open the file in Chrome, Edge, Firefox, or Opera.

### Option 2: Local PowerShell Web Server
Run the included lightweight HTTP server:
```powershell
powershell -ExecutionPolicy Bypass -File "c:\hospital bed availability\server.ps1"
```
Then visit:
`http://localhost:8080/`

---

## 📁 File Structure
```
c:\hospital bed availability\
├── index.html       # Full application layout, views, modals, filters, and header clock
├── styles.css       # Clean hospital theme, doctor cards, timer badges, dark/light mode
├── app.js           # Reactive state engine, doctor registry, sanitization & discharge logic
├── server.ps1       # Lightweight PowerShell web server
└── README.md        # Technical and operational documentation
```
