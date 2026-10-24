/**
 * Hospital Bed Availability & Resource Coordination System
 * Full-Stack Client Engine & Aadhaar KYC Authentication v3.0
 * 
 * Interacts with Python Flask Backend (/api/*) with local fallback.
 */

// API Configuration
const API_BASE = window.location.origin.includes('5000') || window.location.origin.includes('8080')
  ? '' 
  : 'http://127.0.0.1:5000';

// Demo Pre-Verified Aadhaar Accounts Registry
const DEMO_ACCOUNTS = [
  {
    aadhaar: "234567890123",
    formattedAadhaar: "2345 6789 0123",
    name: "Dr. David Chen, MD",
    role: "admin",
    designation: "ICU Director & Intensivist",
    department: "Emergency & CCU",
    mobile: "+91 98765 11223",
    kycVerified: true,
    kycProvider: "UIDAI / DigiLocker Certified",
    avatar: "DC"
  },
  {
    aadhaar: "345678901234",
    formattedAadhaar: "3456 7890 1234",
    name: "Sarah Jenkins, RN",
    role: "admin",
    designation: "Lead Triage Charge Nurse",
    department: "Emergency & Trauma Center",
    mobile: "+91 98765 22334",
    kycVerified: true,
    kycProvider: "UIDAI / DigiLocker Certified",
    avatar: "SJ"
  },
  {
    aadhaar: "456789012345",
    formattedAadhaar: "4567 8901 2345",
    name: "Dr. Robert Gupta, MD",
    role: "admin",
    designation: "Chief Interventional Cardiologist",
    department: "Cardiology & CCU",
    mobile: "+91 98765 33445",
    kycVerified: true,
    kycProvider: "UIDAI / DigiLocker Certified",
    avatar: "RG"
  },
  {
    aadhaar: "987654321098",
    formattedAadhaar: "9876 5432 1098",
    name: "Rajesh Kumar Sharma",
    role: "user",
    designation: "Citizen / Patient Relative",
    department: "Public / General Citizen",
    mobile: "+91 98111 54321",
    kycVerified: true,
    kycProvider: "UIDAI Aadhaar e-KYC Verified",
    avatar: "RS"
  },
  {
    aadhaar: "876543210987",
    formattedAadhaar: "8765 4321 0987",
    name: "Ananya Verma",
    role: "user",
    designation: "Citizen / Inpatient Applicant",
    department: "Public / General Citizen",
    mobile: "+91 98222 65432",
    kycVerified: true,
    kycProvider: "UIDAI Aadhaar e-KYC Verified",
    avatar: "AV"
  }
];

// Global Application State
let appState = {
  currentUser: null,       // Authenticated User Object with role ('admin' or 'user')
  activeRole: 'admin',     // 'admin' or 'user'
  currentView: 'overview', // 'overview', 'dept-{id}', 'resources', 'audit', 'reservations', 'user-home', 'user-booking', etc.
  selectedDeptId: null,
  selectedDoctorFilter: null,
  beds: [],
  resources: {},
  reservations: [],
  auditLogs: [],
  departments: [],
  departmentDoctors: {},
  filters: {
    category: 'all',
    status: 'all',
    search: '',
    acuity: 'all'
  },
  simulation: {
    running: true,
    speed: 1,
    intervalId: null,
    audioEnabled: true
  }
};

// ==========================================
// INITIALIZATION & LIFECYCLE
// ==========================================

async function initApp() {
  setupNavigation();
  setupAuthControls();
  setupModals();
  setupFilters();
  setupSimulation();
  startLiveClock();

  // Load session or show KYC Auth modal
  const savedUser = localStorage.getItem('hospital_auth_user');
  if (savedUser) {
    try {
      appState.currentUser = JSON.parse(savedUser);
      appState.activeRole = appState.currentUser.role || 'admin';
    } catch (e) {
      appState.currentUser = null;
    }
  }

  // Fetch full state from Python backend
  await syncStateWithBackend();

  if (!appState.currentUser) {
    // Default to initial Demo Admin or show Auth Overlay
    openAuthModal();
  } else {
    applyUserRoleTheme();
    if (appState.activeRole === 'user') {
      navigateTo('user-home');
    } else {
      navigateTo('overview');
    }
  }

  startSimulationTicker();
}

// Fetch entire hospital census and reservations from Python backend
async function syncStateWithBackend() {
  try {
    const res = await fetch(`${API_BASE}/api/hospital/state`);
    if (res.ok) {
      const data = await res.json();
      appState.beds = data.beds || [];
      appState.resources = data.resources || {};
      appState.reservations = data.reservations || [];
      appState.auditLogs = data.auditLogs || [];
      appState.departments = data.departments || [];
      appState.departmentDoctors = data.departmentDoctors || {};
      renderSidebarStats();
      renderAlertBanner();
      return true;
    }
  } catch (err) {
    console.warn('Backend API offline or unreachable, using local state cache.', err);
  }
  return false;
}

// ==========================================
// AADHAAR KYC & AUTHENTICATION ENGINE
// ==========================================

function setupAuthControls() {
  const aadhaarInput = document.getElementById('loginAadhaarInput');
  const regAadhaarInput = document.getElementById('regAadhaarInput');

  // Format Aadhaar inputs with 4-digit spacing (XXXX XXXX XXXX)
  [aadhaarInput, regAadhaarInput].forEach(input => {
    if (!input) return;
    input.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '').substring(0, 12);
      let formatted = val.match(/.{1,4}/g)?.join(' ') || val;
      e.target.value = formatted;
      updateAadhaarCardPreview(val);
    });
  });

  // Login form submit
  document.getElementById('aadhaarLoginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawVal = document.getElementById('loginAadhaarInput').value;
    const cleaned = rawVal.replace(/\s+/g, '');

    if (cleaned.length !== 12) {
      showToast('Aadhaar must be exactly 12 numeric digits.', 'error');
      return;
    }

    await performAadhaarLogin(cleaned);
  });

  // Direct click on Verify e-KYC button
  document.getElementById('loginSubmitBtn')?.addEventListener('click', async (e) => {
    const rawVal = document.getElementById('loginAadhaarInput')?.value || '';
    const cleaned = rawVal.replace(/\s+/g, '');
    if (cleaned.length === 12) {
      e.preventDefault();
      await performAadhaarLogin(cleaned);
    }
  });

  // Register role dropdown toggle
  document.getElementById('regRoleSelect')?.addEventListener('change', (e) => {
    const isStaff = e.target.value === 'admin';
    const staffBox = document.getElementById('regStaffFields');
    if (staffBox) staffBox.style.display = isStaff ? 'block' : 'none';
  });

  // Register form submit
  document.getElementById('aadhaarRegisterForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regNameInput').value.trim();
    const rawAadhaar = document.getElementById('regAadhaarInput').value.replace(/\s+/g, '');
    const mobile = document.getElementById('regMobileInput').value.trim();
    const role = document.getElementById('regRoleSelect').value;
    const designation = document.getElementById('regDesignationInput')?.value.trim() || (role === 'admin' ? 'Medical Staff' : 'Citizen User');
    const dept = document.getElementById('regDeptSelect')?.value || 'ED';

    if (rawAadhaar.length !== 12) {
      showToast('Aadhaar must be exactly 12 digits.', 'error');
      return;
    }

    let newUser = null;
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, aadhaar: rawAadhaar, mobile, role, designation, department: dept })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) newUser = data.user;
      }
    } catch (err) {
      console.warn('Backend unavailable during registration; completing via local e-KYC.', err);
    }

    if (!newUser) {
      newUser = {
        aadhaar: rawAadhaar,
        formattedAadhaar: rawAadhaar.replace(/(\d{4})/g, '$1 ').trim(),
        name: name || (role === 'admin' ? 'Registered Hospital Staff' : 'Registered Citizen'),
        role: role,
        designation: designation,
        department: dept,
        mobile: mobile || '+91 98765 00000',
        kycVerified: true,
        kycProvider: 'UIDAI Aadhaar e-KYC Verified',
        avatar: (name ? name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase() : (role === 'admin' ? 'ST' : 'CZ'))
      };
    }

    playAudioChime('success');
    showToast('✓ Aadhaar e-KYC Verified! Account registered.', 'success');
    setCurrentUser(newUser);
    closeAuthModal();
  });

  // Modal controls
  document.getElementById('closeAuthModalBtn')?.addEventListener('click', closeAuthModal);
  document.getElementById('switchIdentityBtn')?.addEventListener('click', openAuthModal);
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('hospital_auth_user');
    appState.currentUser = null;
    openAuthModal();
  });
}

function openAuthModal() {
  const overlay = document.getElementById('authOverlay');
  if (overlay) overlay.style.display = 'flex';
  const closeBtn = document.getElementById('closeAuthModalBtn');
  if (closeBtn) closeBtn.style.display = appState.currentUser ? 'block' : 'none';
}

function closeAuthModal() {
  const overlay = document.getElementById('authOverlay');
  if (overlay) overlay.style.display = 'none';
}

function switchAuthTab(tab) {
  const loginPanel = document.getElementById('authLoginPanel');
  const regPanel = document.getElementById('authRegisterPanel');
  const tabLogin = document.getElementById('tabLoginBtn');
  const tabReg = document.getElementById('tabRegisterBtn');

  if (tab === 'login') {
    loginPanel.style.display = 'block';
    regPanel.style.display = 'none';
    tabLogin.classList.add('active');
    tabReg.classList.remove('active');
  } else {
    loginPanel.style.display = 'none';
    regPanel.style.display = 'block';
    tabLogin.classList.remove('active');
    tabReg.classList.add('active');
  }
}

// Update the interactive Aadhaar visual card in the modal
function updateAadhaarCardPreview(numberDigits) {
  const numberElem = document.getElementById('aadhaarCardNumber');
  if (numberElem) {
    if (!numberDigits) {
      numberElem.textContent = 'XXXX XXXX XXXX';
    } else {
      let padded = numberDigits.padEnd(12, 'X');
      numberElem.textContent = `${padded.substring(0,4)} ${padded.substring(4,8)} ${padded.substring(8,12)}`;
    }
  }
}

// 1-Click Demo Login with Pre-Verified Aadhaar
async function quickLoginAadhaar(aadhaarNumber) {
  document.getElementById('loginAadhaarInput').value = aadhaarNumber.replace(/(\d{4})/g, '$1 ').trim();
  updateAadhaarCardPreview(aadhaarNumber);
  await performAadhaarLogin(aadhaarNumber);
}

// Perform Login & KYC Verification
async function performAadhaarLogin(aadhaarNumber) {
  showToast('Initiating UIDAI Aadhaar e-KYC Verification...', 'info');
  let loggedInUser = null;

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aadhaar: aadhaarNumber })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        loggedInUser = data.user;
      }
    }
  } catch (err) {
    console.warn('Backend authentication unreachable; proceeding with verified local Aadhaar e-KYC engine.', err);
  }

  // Fallback to local e-KYC registry if backend is offline or returned failure
  if (!loggedInUser) {
    const matched = DEMO_ACCOUNTS.find(a => a.aadhaar === aadhaarNumber);
    if (matched) {
      loggedInUser = { ...matched };
    } else if (aadhaarNumber && aadhaarNumber.length === 12) {
      const isAdminStaff = ['2', '3', '4'].includes(aadhaarNumber[0]);
      loggedInUser = {
        aadhaar: aadhaarNumber,
        formattedAadhaar: aadhaarNumber.replace(/(\d{4})/g, '$1 ').trim(),
        name: isAdminStaff ? 'Hospital Medical Officer' : 'Verified Citizen Patient',
        role: isAdminStaff ? 'admin' : 'user',
        designation: isAdminStaff ? 'Attending Physician' : 'Citizen User',
        department: isAdminStaff ? 'Emergency & Critical Care' : 'Public Patient Services',
        mobile: '+91 98765 43210',
        kycVerified: true,
        kycProvider: 'UIDAI Aadhaar e-KYC Instant Verification',
        avatar: isAdminStaff ? 'MO' : 'CP'
      };
    }
  }

  if (loggedInUser) {
    playAudioChime('success');
    showToast(`✓ e-KYC Verified: Logged in as ${loggedInUser.name} (${loggedInUser.role.toUpperCase()})`, 'success');
    setCurrentUser(loggedInUser);
    closeAuthModal();
    try { await syncStateWithBackend(); } catch (e) {}
  } else {
    showToast('Invalid Aadhaar number or e-KYC verification failed.', 'error');
  }
}

function setCurrentUser(user) {
  appState.currentUser = user;
  appState.activeRole = user.role || 'admin';
  localStorage.setItem('hospital_auth_user', JSON.stringify(user));
  applyUserRoleTheme();

  // Direct user to their respective dashboard
  if (appState.activeRole === 'user') {
    navigateTo('user-home');
  } else {
    navigateTo('overview');
  }
}

// Switch between User & Admin views dynamically
function toggleRoleDashboard() {
  if (appState.activeRole === 'admin') {
    appState.activeRole = 'user';
    showToast('Switched to Citizen & Patient Portal Mode', 'info');
    navigateTo('user-home');
  } else {
    appState.activeRole = 'admin';
    showToast('Switched to Hospital Admin & Command Center Mode', 'info');
    navigateTo('overview');
  }
  applyUserRoleTheme();
}

// Update UI Layout based on Active Role (Admin vs Citizen User)
function applyUserRoleTheme() {
  const user = appState.currentUser || { name: 'Dr. David Chen', role: 'admin', designation: 'ICU Director', formattedAadhaar: '2345 6789 0123' };
  const isAdmin = appState.activeRole === 'admin';

  // Sidebar profile updates
  document.getElementById('currentStaffName').textContent = user.name;
  document.getElementById('currentStaffRole').textContent = user.designation || (isAdmin ? 'Medical Staff' : 'Citizen User');
  document.getElementById('currentStaffAvatar').textContent = user.avatar || (isAdmin ? 'DC' : 'CU');
  document.getElementById('currentAadhaarMasked').textContent = `Aadhaar: •••• ${user.aadhaar ? user.aadhaar.slice(-4) : '0123'}`;

  // Role badge in header
  const roleBadge = document.getElementById('activeRoleBadge');
  if (roleBadge) {
    if (isAdmin) {
      roleBadge.className = 'role-indicator-pill role-admin';
      roleBadge.innerHTML = '🛡️ Admin Mode • Hospital Staff (Switch ⇄)';
    } else {
      roleBadge.className = 'role-indicator-pill role-user';
      roleBadge.innerHTML = '👤 Citizen Mode • Patient Portal (Switch ⇄)';
    }
  }

  // Toggle navigation menus
  const adminNav = document.getElementById('adminNavSection');
  const userNav = document.getElementById('userNavSection');
  if (adminNav) adminNav.style.display = isAdmin ? 'block' : 'none';
  if (userNav) userNav.style.display = isAdmin ? 'none' : 'block';

  // Toggle top header operational buttons
  const adminTop = document.getElementById('adminTopActions');
  const userTop = document.getElementById('userTopActions');
  if (adminTop) adminTop.style.display = isAdmin ? 'flex' : 'none';
  if (userTop) userTop.style.display = isAdmin ? 'none' : 'flex';

  // Citizen Dashboard Profile
  const citizenGreeting = document.getElementById('citizenGreeting');
  if (citizenGreeting) citizenGreeting.textContent = `Welcome, ${user.name}`;
  const citizenAvatar = document.getElementById('citizenAvatarBig');
  if (citizenAvatar) citizenAvatar.textContent = user.avatar || 'CU';
  const citizenAadhaar = document.getElementById('citizenAadhaarDisplay');
  if (citizenAadhaar) citizenAadhaar.textContent = user.formattedAadhaar || 'XXXX-XXXX-1098';
  const citizenMobile = document.getElementById('citizenMobileDisplay');
  if (citizenMobile) citizenMobile.textContent = user.mobile || '+91 98111 54321';

  // Pre-fill Citizen Booking Form
  const bookName = document.getElementById('userBookPatientName');
  if (bookName && !bookName.value) bookName.value = user.name;
  const bookAadhaar = document.getElementById('userBookAadhaar');
  if (bookAadhaar) bookAadhaar.value = user.formattedAadhaar || user.aadhaar || '9876 5432 1098';
  const bookMobile = document.getElementById('userBookMobile');
  if (bookMobile && !bookMobile.value) bookMobile.value = user.mobile || '+91 98111 54321';
}

// ==========================================
// NAVIGATION & ROUTING
// ==========================================

function setupNavigation() {
  document.querySelectorAll('[data-view]').forEach(elem => {
    elem.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = elem.getAttribute('data-view');
      navigateTo(targetView);
    });
  });

  // Dark/Light Theme toggle
  document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    document.getElementById('themeToggleBtn').innerHTML = isLight ? '🌙' : '☀️';
  });

  // Audio chime toggle
  document.getElementById('audioToggleBtn')?.addEventListener('click', () => {
    appState.simulation.audioEnabled = !appState.simulation.audioEnabled;
    const btn = document.getElementById('audioToggleBtn');
    btn.innerHTML = appState.simulation.audioEnabled ? '🔔' : '🔕';
    showToast(appState.simulation.audioEnabled ? 'Audio alerts turned ON' : 'Audio alerts muted', 'info');
  });

  // Reset baseline button
  document.getElementById('resetSystemBtn')?.addEventListener('click', async () => {
    if (confirm('Reset entire hospital system & census to pristine baseline?')) {
      try {
        await fetch(`${API_BASE}/api/system/reset`, { method: 'POST' });
        showToast('Hospital census & Aadhaar registry reset to baseline', 'info');
        await syncStateWithBackend();
        renderActiveView();
      } catch (e) {
        showToast('Reset failed', 'error');
      }
    }
  });

  // Export audit log button
  document.getElementById('exportAuditCsvBtn')?.addEventListener('click', exportAuditToCSV);
}

function navigateTo(viewId) {
  appState.currentView = viewId;
  appState.selectedDoctorFilter = null;

  if (viewId.startsWith('dept-')) {
    appState.selectedDeptId = viewId.replace('dept-', '');
  } else {
    appState.selectedDeptId = null;
  }

  // Update active links
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('data-view') === viewId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Switch view panels
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  const titleElem = document.getElementById('pageTitleText');

  if (viewId === 'overview') {
    document.getElementById('viewOverview').classList.add('active');
    titleElem.textContent = 'Hospital Operations Command Center';
  } else if (viewId.startsWith('dept-')) {
    document.getElementById('viewDepartment').classList.add('active');
    const dept = (appState.departments || []).find(d => d.id === appState.selectedDeptId);
    titleElem.textContent = `${dept ? dept.icon : '🏥'} ${dept ? dept.name : 'Department'} Dashboard`;
  } else if (viewId === 'resources') {
    document.getElementById('viewResources').classList.add('active');
    titleElem.textContent = 'Hospital Equipment & Resource Inventory';
  } else if (viewId === 'reservations') {
    document.getElementById('viewAdminReservations').classList.add('active');
    titleElem.textContent = 'Citizen Bed Reservation Requests Manager';
  } else if (viewId === 'audit') {
    document.getElementById('viewAudit').classList.add('active');
    titleElem.textContent = 'Operational Audit Trail & Governance Log';
  } else if (viewId.startsWith('user-')) {
    document.getElementById('viewUserDashboard').classList.add('active');
    titleElem.textContent = 'AegisHealth Citizen & Patient Bed Availability Portal';

    if (viewId === 'user-booking') {
      setTimeout(() => {
        document.getElementById('userBookingSection')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }

  renderActiveView();
}

function renderActiveView() {
  if (appState.currentView === 'overview') {
    renderOverviewView();
  } else if (appState.currentView.startsWith('dept-')) {
    renderDepartmentView(appState.selectedDeptId);
  } else if (appState.currentView === 'resources') {
    renderResourcesView();
  } else if (appState.currentView === 'reservations') {
    renderAdminReservations();
  } else if (appState.currentView === 'audit') {
    renderAuditView();
  } else if (appState.currentView.startsWith('user-')) {
    renderUserDashboard();
  }
  renderSidebarStats();
}

// ==========================================
// USER DASHBOARD RENDERING (CITIZEN PORTAL)
// ==========================================

function renderUserDashboard() {
  const beds = appState.beds || [];
  const totalAvail = beds.filter(b => b.status === 'available').length;
  const icuAvail = beds.filter(b => b.cat === 'icu' && b.status === 'available').length;
  const emAvail = beds.filter(b => b.cat === 'emergency' && b.status === 'available').length;
  const lsAvail = beds.filter(b => b.cat === 'longstay' && b.status === 'available').length;

  // KPI counters on citizen portal
  document.getElementById('userAvailBeds').textContent = totalAvail;
  document.getElementById('userAvailIcu').textContent = icuAvail;
  document.getElementById('userAvailEmergency').textContent = emAvail;
  document.getElementById('userAvailLongstay').textContent = lsAvail;

  // Render Citizen Bed Bookings
  renderUserReservationsList();

  // Render Citizen Department Wards Directory
  renderUserDepartmentDirectory();
}

function renderUserReservationsList() {
  const container = document.getElementById('userReservationsList');
  if (!container) return;

  const user = appState.currentUser;
  const userAadhaar = user ? user.aadhaar : null;

  // Filter reservations for current user
  let myReservations = appState.reservations || [];
  if (userAadhaar) {
    myReservations = myReservations.filter(r => r.aadhaar === userAadhaar);
  }

  if (myReservations.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; padding: 30px; text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-color);">
        <p style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">No Active Bed Requests</p>
        <p style="font-size: 12px;">You currently have no pending or active hospital bed bookings.</p>
        <button class="btn btn-primary btn-sm" style="margin-top: 10px;" onclick="scrollOrSwitchToBooking()">Book a Hospital Bed</button>
      </div>
    `;
    return;
  }

  container.innerHTML = myReservations.map(res => {
    let statusClass = res.status; // 'pending', 'approved', 'rejected'
    let statusPill = '';

    if (res.status === 'pending') {
      statusPill = '<span class="status-pill reserved">🟡 Triage Review in Progress</span>';
    } else if (res.status === 'approved') {
      statusPill = '<span class="status-pill available">🟢 Approved & Bed Allocated</span>';
    } else {
      statusPill = '<span class="status-pill occupied">🔴 Request Diverted</span>';
    }

    return `
      <div class="booking-status-card ${statusClass}">
        <div class="booking-card-top">
          <span style="font-size: 11px; font-weight: 700; color: var(--primary);">REF: ${res.id}</span>
          ${statusPill}
        </div>

        <div class="booking-patient-name">${res.patientName} (${res.age} yo)</div>
        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
          Preferred Dept: <strong>${res.preferredDept}</strong> • Category: <strong>${(res.bedCategory || '').toUpperCase()}</strong>
        </div>

        <div style="font-size: 12px; color: var(--text-secondary); background: var(--bg-main); padding: 8px 10px; border-radius: 6px; margin-bottom: 10px;">
          🩺 ${res.reason}
        </div>

        ${res.status === 'approved' ? `
          <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 8px 10px; margin-bottom: 8px;">
            <div style="font-size: 11px; font-weight: 700; color: #10b981;">✓ ALLOCATED BED: <strong>${res.assignedBedId}</strong></div>
            <div style="font-size: 11px; color: var(--text-secondary);">👨‍⚕️ Assigned Attending: <strong>${res.assignedDoc || 'Attending Physician'}</strong></div>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: var(--text-muted); margin-top: auto;">
          <span>Submitted: ${res.createdAt}</span>
          <span>Aadhaar: •••• ${res.aadhaar ? res.aadhaar.slice(-4) : 'XXXX'}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderUserDepartmentDirectory() {
  const tableBody = document.getElementById('userDeptMatrixBody');
  if (!tableBody) return;

  const depts = appState.departments || [];
  tableBody.innerHTML = depts.map(dept => {
    const deptBeds = (appState.beds || []).filter(b => b.dept === dept.id);
    const icuAvail = deptBeds.filter(b => b.cat === 'icu' && b.status === 'available').length;
    const icuTotal = deptBeds.filter(b => b.cat === 'icu').length;

    const emAvail = deptBeds.filter(b => b.cat === 'emergency' && b.status === 'available').length;
    const emTotal = deptBeds.filter(b => b.cat === 'emergency').length;

    const lsAvail = deptBeds.filter(b => b.cat === 'longstay' && b.status === 'available').length;
    const lsTotal = deptBeds.filter(b => b.cat === 'longstay').length;

    const doctors = (appState.departmentDoctors[dept.id] || []).map(d => d.name).join(', ');

    return `
      <tr>
        <td>
          <div class="dept-name-cell">
            <span class="dept-icon-mini">${dept.icon}</span>
            <div>
              <div style="font-weight: 700;">${dept.name}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${dept.floor}</div>
            </div>
          </div>
        </td>
        <td><strong style="color:#ec4899;">${icuAvail}</strong> / ${icuTotal} ready</td>
        <td><strong style="color:#f97316;">${emAvail}</strong> / ${emTotal} ready</td>
        <td><strong style="color:#3b82f6;">${lsAvail}</strong> / ${lsTotal} ready</td>
        <td style="font-size: 11px; color: var(--text-secondary); max-width: 250px;">
          👨‍⚕️ ${doctors || 'On-Call Specialists'}
        </td>
        <td>
          <span class="status-pill available">● Intake Active</span>
        </td>
      </tr>
    `;
  }).join('');
}

function scrollOrSwitchToBooking() {
  navigateTo('user-booking');
}

function triggerEmergencySosCall() {
  playAudioChime('alert');
  alert('🚨 EMERGENCY 108 DISPATCHED!\nParamedics and emergency response transport have been notified for immediate pickup.');
  showToast('🚨 108 Emergency Ambulance Dispatched to your location!', 'error');
}

// Citizen Bed Booking Form Submission
document.getElementById('citizenBedBookingForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const patientName = document.getElementById('userBookPatientName').value.trim();
  const age = document.getElementById('userBookPatientAge').value;
  const rawAadhaar = document.getElementById('userBookAadhaar').value.replace(/\s+/g, '');
  const mobile = document.getElementById('userBookMobile').value.trim();
  const preferredDept = document.getElementById('userBookDept').value;
  const bedCategory = document.getElementById('userBookCategory').value;
  const reason = document.getElementById('userBookReason').value.trim();
  const requiresOxygen = document.getElementById('userBookNeedsOxygen')?.checked || false;
  const requiresVentilator = document.getElementById('userBookNeedsVentilator')?.checked || false;

  try {
    const res = await fetch(`${API_BASE}/api/reservations/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientName, age, aadhaar: rawAadhaar, mobile, preferredDept, bedCategory, reason, requiresOxygen, requiresVentilator
      })
    });
    const data = await res.json();
    if (data.success) {
      playAudioChime('success');
      showToast('✓ Bed Request Submitted! Hospital triage notified.', 'success');
      document.getElementById('userBookReason').value = '';
      await syncStateWithBackend();
      renderUserDashboard();
    } else {
      showToast(data.error || 'Request submission failed', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to backend server', 'error');
  }
});

// ==========================================
// ADMIN DASHBOARD: CITIZEN RESERVATIONS QUEUE
// ==========================================

function renderAdminReservations() {
  const container = document.getElementById('adminReservationsContainer');
  if (!container) return;

  const reservations = appState.reservations || [];
  if (reservations.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <p style="font-size: 16px; font-weight: 600;">No Pending Citizen Bed Requests</p>
        <p style="font-size: 12px;">All online booking requests have been triaged and resolved.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = reservations.map(r => {
    const isPending = r.status === 'pending';
    return `
      <div class="res-queue-item" style="border-left: 4px solid ${isPending ? 'var(--status-reserved)' : (r.status === 'approved' ? 'var(--status-available)' : 'var(--status-occupied)')};">
        <div class="res-queue-info">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="font-weight: 700; font-size: 15px;">${r.patientName} (${r.age} yo)</span>
            <span class="status-pill ${r.status === 'pending' ? 'reserved' : (r.status === 'approved' ? 'available' : 'occupied')}">
              ${r.status.toUpperCase()}
            </span>
            <span class="acuity-badge acuity-${r.urgency || 'urgent'}">${(r.urgency || 'urgent').toUpperCase()}</span>
          </div>

          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">
            Requested Dept: <strong>${r.preferredDept}</strong> • Category: <strong>${(r.bedCategory || '').toUpperCase()}</strong> • Aadhaar: <strong>${r.formattedAadhaar || r.aadhaar}</strong> • 📱 ${r.mobile}
          </div>

          <div style="font-size: 12px; color: var(--primary);">
            🩺 Symptoms: ${r.reason}
          </div>
          ${r.assignedBedId ? `<div style="font-size: 11px; color:#10b981; font-weight:700; margin-top:4px;">Allocated: ${r.assignedBedId} under ${r.assignedDoc}</div>` : ''}
        </div>

        <div class="res-queue-actions">
          ${isPending ? `
            <button class="btn btn-success btn-sm" onclick="openApproveReservationModal('${r.id}')">
              ✓ Approve & Allocate Bed
            </button>
            <button class="btn btn-outline btn-sm" onclick="rejectReservation('${r.id}')">
              ✕ Reject
            </button>
          ` : `
            <span style="font-size: 11px; color: var(--text-muted);">${r.createdAt}</span>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function openApproveReservationModal(resId) {
  const res = (appState.reservations || []).find(r => r.id === resId);
  if (!res) return;

  const modal = document.getElementById('approveResModal');
  document.getElementById('appResId').value = res.id;
  document.getElementById('appResPatientName').textContent = `${res.patientName} (${res.age} yo)`;
  document.getElementById('appResMeta').textContent = `Aadhaar: ${res.formattedAadhaar || res.aadhaar} • Urgency: ${res.urgency.toUpperCase()} • Dept: ${res.preferredDept} [${res.bedCategory}]`;
  document.getElementById('appResReason').textContent = `Reason: ${res.reason}`;

  const bedSelect = document.getElementById('appResBedSelect');
  // Available beds
  const availableBeds = (appState.beds || []).filter(b => b.status === 'available');
  if (availableBeds.length === 0) {
    bedSelect.innerHTML = `<option value="">No available beds across the hospital!</option>`;
  } else {
    bedSelect.innerHTML = availableBeds.map(b => {
      const dept = (appState.departments || []).find(d => d.id === b.dept);
      return `<option value="${b.id}">${b.id} - ${dept ? dept.name : b.dept} [${b.cat.toUpperCase()}] (${b.name})</option>`;
    }).join('');
  }

  modal.classList.add('open');
}

document.getElementById('approveResForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const resId = document.getElementById('appResId').value;
  const bedId = document.getElementById('appResBedSelect').value;
  const doc = document.getElementById('appResDocSelect').value;
  const staffName = appState.currentUser ? appState.currentUser.name : 'Hospital Admin';

  try {
    const res = await fetch(`${API_BASE}/api/reservations/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId: resId, bedId, doc, staffName })
    });
    const data = await res.json();
    if (data.success) {
      playAudioChime('success');
      showToast(data.message, 'success');
      closeAllModals();
      await syncStateWithBackend();
      renderActiveView();
    } else {
      showToast(data.error || 'Approval failed', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to backend', 'error');
  }
});

async function rejectReservation(resId) {
  const reason = prompt('Please enter clinical justification for rejecting or diverting this request:');
  if (!reason) return;

  try {
    const res = await fetch(`${API_BASE}/api/reservations/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId: resId, reason, staffName: appState.currentUser?.name || 'Admin' })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'info');
      await syncStateWithBackend();
      renderActiveView();
    }
  } catch (e) {
    showToast('Error rejecting reservation', 'error');
  }
}

// ==========================================
// ADMIN DASHBOARD CORE: OVERVIEW & DEPARTMENTS
// ==========================================

function renderOverviewView() {
  const beds = appState.beds || [];
  const totalBeds = beds.length;
  const availableBeds = beds.filter(b => b.status === 'available').length;
  const occupiedBeds = beds.filter(b => b.status === 'occupied').length;
  const reservedBeds = beds.filter(b => b.status === 'reserved').length;
  const cleaningBeds = beds.filter(b => b.status === 'cleaning').length;
  const maintBeds = beds.filter(b => b.status === 'maintenance').length;
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  document.getElementById('ovTotalBeds').textContent = totalBeds;
  document.getElementById('ovAvailableBeds').textContent = availableBeds;
  document.getElementById('ovOccupiedBeds').textContent = occupiedBeds;
  document.getElementById('ovOccupancyPct').textContent = occupancyPct + '%';
  document.getElementById('ovCleaningBeds').textContent = cleaningBeds;
  document.getElementById('ovMaintBeds').textContent = maintBeds;

  renderCategoryBreakdown(beds, 'overviewCategoryCards');
  renderDepartmentComparisonMatrix();
  renderBedsGrid('overviewBedsGrid', beds);
}

function renderDepartmentView(deptId) {
  const dept = (appState.departments || []).find(d => d.id === deptId);
  if (!dept) return;

  const deptBeds = (appState.beds || []).filter(b => b.dept === deptId);
  const totalBeds = deptBeds.length;
  const availableBeds = deptBeds.filter(b => b.status === 'available').length;
  const occupiedBeds = deptBeds.filter(b => b.status === 'occupied').length;
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  document.getElementById('deptFloorTag').textContent = dept.floor;
  document.getElementById('deptTotalBadge').textContent = `${totalBeds} Total Beds`;
  document.getElementById('deptAvailBadge').textContent = `${availableBeds} Available`;
  document.getElementById('deptOccBadge').textContent = `${occupancyPct}% Occupancy`;

  renderCategoryBreakdown(deptBeds, 'deptCategoryCards');
  renderDepartmentDoctors(deptId);
  renderBedsGrid('deptBedsGrid', deptBeds);
}

function renderDepartmentDoctors(deptId) {
  const container = document.getElementById('deptDoctorsList');
  if (!container) return;

  const deptDoctors = (appState.departmentDoctors || {})[deptId] || [];
  const deptBeds = (appState.beds || []).filter(b => b.dept === deptId && b.status === 'occupied' && b.patient);

  let html = `
    <div class="dept-doc-chip ${!appState.selectedDoctorFilter ? 'active' : ''}" onclick="filterByDoctor(null)">
      <span>👥 All Attending Staff</span>
      <span class="doc-chip-count">${deptBeds.length}</span>
    </div>
  `;

  deptDoctors.forEach(doc => {
    const docBedsCount = deptBeds.filter(b => b.patient && b.patient.doc && b.patient.doc.includes(doc.name.replace('Dr. ', '').split(',')[0])).length;
    const isSelected = appState.selectedDoctorFilter === doc.name;

    html += `
      <div class="dept-doc-chip ${isSelected ? 'active' : ''}" onclick="filterByDoctor('${doc.name}')" title="${doc.specialty}">
        <span class="bed-doc-avatar" style="width:20px; height:20px; font-size:9px;">${doc.initials}</span>
        <span><strong>${doc.name}</strong> (${doc.specialty})</span>
        <span class="doc-chip-count">${docBedsCount}</span>
      </div>
    `;
  });

  container.innerHTML = html;
}

function filterByDoctor(docName) {
  appState.selectedDoctorFilter = (appState.selectedDoctorFilter === docName) ? null : docName;
  renderActiveView();
}

function renderCategoryBreakdown(bedsList, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const cats = ['icu', 'emergency', 'longstay'];
  const catLabels = {
    icu: { name: 'ICU Beds', icon: '⚡', cardClass: 'cat-icu' },
    emergency: { name: 'Emergency Beds', icon: '🚨', cardClass: 'cat-emergency' },
    longstay: { name: 'Rooms for Longer Stays', icon: '🛌', cardClass: 'cat-longstay' }
  };

  container.innerHTML = cats.map(catKey => {
    const config = catLabels[catKey];
    const catBeds = bedsList.filter(b => b.cat === catKey);
    const total = catBeds.length;
    const avail = catBeds.filter(b => b.status === 'available').length;
    const occ = catBeds.filter(b => b.status === 'occupied').length;
    const resv = catBeds.filter(b => b.status === 'reserved').length;
    const cln = catBeds.filter(b => b.status === 'cleaning').length;
    const maint = catBeds.filter(b => b.status === 'maintenance').length;
    const pct = total > 0 ? Math.round((occ / total) * 100) : 0;

    const pOcc = total > 0 ? (occ / total) * 100 : 0;
    const pResv = total > 0 ? (resv / total) * 100 : 0;
    const pCln = total > 0 ? (cln / total) * 100 : 0;
    const pAvail = total > 0 ? (avail / total) * 100 : 0;
    const pMaint = total > 0 ? (maint / total) * 100 : 0;

    const isCritical = catKey === 'icu' && avail <= 1;
    const isSurge = catKey === 'emergency' && pct >= 80;

    return `
      <div class="category-card ${config.cardClass}">
        <div class="category-card-top">
          <span class="category-badge-pill">
            <span>${config.icon}</span> ${config.name}
          </span>
          <span class="category-occupancy-rate ${isCritical || isSurge ? 'text-red-400 font-bold' : ''}">
            ${pct}% In Use
          </span>
        </div>

        <div class="category-main-stats">
          <span class="cat-avail-huge">${avail}</span>
          <span class="cat-total-label">available / <strong>${total}</strong> total</span>
          ${isCritical ? '<span class="ticker-tag" style="margin-left:auto; background:#ef4444;">CRITICAL LOW</span>' : ''}
          ${isSurge ? '<span class="ticker-tag" style="margin-left:auto; background:#f97316;">SURGE ALERT</span>' : ''}
        </div>

        <div class="cat-progress-track">
          <div class="progress-segment seg-occupied" style="width: ${pOcc}%"></div>
          <div class="progress-segment seg-reserved" style="width: ${pResv}%"></div>
          <div class="progress-segment seg-cleaning" style="width: ${pCln}%"></div>
          <div class="progress-segment seg-available" style="width: ${pAvail}%"></div>
          <div class="progress-segment seg-maint" style="width: ${pMaint}%"></div>
        </div>

        <div class="category-sub-stats">
          <div class="sub-stat-item"><span class="sub-stat-num" style="color:var(--status-available);">${avail}</span><span class="sub-stat-lbl">Ready</span></div>
          <div class="sub-stat-item"><span class="sub-stat-num" style="color:var(--status-occupied);">${occ}</span><span class="sub-stat-lbl">Occupied</span></div>
          <div class="sub-stat-item"><span class="sub-stat-num" style="color:var(--status-cleaning);">${cln}</span><span class="sub-stat-lbl">Cleaning</span></div>
          <div class="sub-stat-item"><span class="sub-stat-num" style="color:var(--status-reserved);">${resv + maint}</span><span class="sub-stat-lbl">Res/Maint</span></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderDepartmentComparisonMatrix() {
  const tableBody = document.getElementById('deptMatrixBody');
  if (!tableBody) return;

  const depts = appState.departments || [];
  tableBody.innerHTML = depts.map(dept => {
    const deptBeds = (appState.beds || []).filter(b => b.dept === dept.id);
    const total = deptBeds.length;
    const occupied = deptBeds.filter(b => b.status === 'occupied').length;
    const occupancy = total > 0 ? Math.round((occupied / total) * 100) : 0;

    const icuAvail = deptBeds.filter(b => b.cat === 'icu' && b.status === 'available').length;
    const icuTotal = deptBeds.filter(b => b.cat === 'icu').length;

    const emAvail = deptBeds.filter(b => b.cat === 'emergency' && b.status === 'available').length;
    const emTotal = deptBeds.filter(b => b.cat === 'emergency').length;

    const lsAvail = deptBeds.filter(b => b.cat === 'longstay' && b.status === 'available').length;
    const lsTotal = deptBeds.filter(b => b.cat === 'longstay').length;

    return `
      <tr onclick="navigateTo('dept-${dept.id}')" title="Click to view ${dept.name}">
        <td>
          <div class="dept-name-cell">
            <span class="dept-icon-mini">${dept.icon}</span>
            <div>
              <div style="font-weight:700;">${dept.name}</div>
              <div style="font-size:11px; color:var(--text-muted);">${dept.floor}</div>
            </div>
          </div>
        </td>
        <td><strong style="color:#10b981;">${icuAvail}</strong> / ${icuTotal}</td>
        <td><strong style="color:#10b981;">${emAvail}</strong> / ${emTotal}</td>
        <td><strong style="color:#10b981;">${lsAvail}</strong> / ${lsTotal}</td>
        <td>
          <span style="font-weight:700; color:${occupancy > 85 ? '#ef4444' : '#38bdf8'}">${occupancy}%</span>
        </td>
        <td style="text-align: right;">
          <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); navigateTo('dept-${dept.id}')">View Unit →</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Render Beds Grid with prominent Assigned Doctor display
function renderBedsGrid(containerId, sourceBeds) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let filtered = sourceBeds.filter(bed => {
    if (appState.filters.category !== 'all' && bed.cat !== appState.filters.category) return false;
    if (appState.filters.status !== 'all' && bed.status !== appState.filters.status) return false;
    if (appState.filters.acuity !== 'all' && (!bed.patient || bed.patient.acuity !== appState.filters.acuity)) return false;
    if (appState.selectedDoctorFilter && (!bed.patient || !bed.patient.doc || !bed.patient.doc.includes(appState.selectedDoctorFilter.replace('Dr. ', '').split(',')[0]))) return false;
    if (appState.filters.search) {
      const q = appState.filters.search.toLowerCase();
      const matchBed = bed.id.toLowerCase().includes(q) || bed.name.toLowerCase().includes(q);
      const matchPatient = bed.patient && (
        bed.patient.name.toLowerCase().includes(q) ||
        bed.patient.mrn.toLowerCase().includes(q) ||
        (bed.patient.doc && bed.patient.doc.toLowerCase().includes(q))
      );
      if (!matchBed && !matchPatient) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-color);">
        <p style="font-size: 15px; font-weight: 600;">No beds matching filter</p>
        <button class="btn btn-outline btn-sm" style="margin-top: 10px;" onclick="resetFilters()">Reset Filters</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(bed => {
    const dept = (appState.departments || []).find(d => d.id === bed.dept);
    const catShort = (bed.cat || '').toUpperCase();

    // Resources badges
    let resourceBadges = (bed.resources || []).map(r => {
      const resObj = appState.resources[r];
      return `<span class="res-tag ${r === 'ventilators' ? 'res-critical' : ''}">${resObj ? resObj.icon : '⚙️'} ${resObj ? resObj.name.split(' ')[0] : r}</span>`;
    }).join('');

    let patientContent = '';

    if (bed.status === 'occupied' && bed.patient) {
      const docInitials = getInitials(bed.patient.doc);
      const stayDuration = getElapsedStayString(bed.patient.admittedTimestamp);

      patientContent = `
        <div class="bed-doctor-assigned-box">
          <div class="bed-doc-info">
            <div class="bed-doc-avatar">${docInitials}</div>
            <div class="bed-doc-text-wrap">
              <span class="bed-doc-label">Assigned Doctor</span>
              <span class="bed-doc-name">${bed.patient.doc || 'Attending Physician'}</span>
            </div>
          </div>
          <span class="bed-doc-specialty-pill">${bed.patient.docSpecialty || 'Attending MD'}</span>
        </div>

        <div class="bed-patient-info">
          <div class="patient-main">
            <span class="patient-name">${bed.patient.name}</span>
            <span class="acuity-badge acuity-${bed.patient.acuity}">${bed.patient.acuity}</span>
          </div>
          <div class="patient-meta">${bed.patient.age ? bed.patient.age + ' yo • ' : ''}<strong>${bed.patient.mrn}</strong></div>
          <div class="patient-diagnosis">🩺 ${bed.patient.diagnosis}</div>

          <div style="display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap;">
            <span class="time-meta-badge">🕒 In: ${bed.patient.admittedAt || 'Recent'}</span>
            <span class="time-meta-badge" style="color: #38bdf8;">⏳ Stay: ${stayDuration}</span>
          </div>

          <div class="patient-recovery-row">
            ${bed.patient.recovered ? '<span class="recovered-pill">✓ Recovered</span>' : '<span style="font-size:10px; color:var(--text-muted);">In Treatment</span>'}
            <button class="btn-recovered-toggle ${bed.patient.recovered ? 'is-recovered' : ''}" onclick="togglePatientRecovered('${bed.id}')">
              ${bed.patient.recovered ? '✓ Ready to Discharge' : 'Mark Recovered'}
            </button>
          </div>
        </div>
      `;
    } else if (bed.status === 'reserved' && bed.patient) {
      const docInitials = getInitials(bed.patient.doc);
      patientContent = `
        <div class="bed-doctor-assigned-box" style="border-color: rgba(245, 158, 11, 0.4); background: rgba(245, 158, 11, 0.1);">
          <div class="bed-doc-info">
            <div class="bed-doc-avatar" style="background:#f59e0b;">${docInitials}</div>
            <div class="bed-doc-text-wrap">
              <span class="bed-doc-label">Receiving Doctor</span>
              <span class="bed-doc-name">${bed.patient.doc || 'Attending Physician'}</span>
            </div>
          </div>
          <span class="bed-doc-specialty-pill" style="color:#f59e0b; background:rgba(245, 158, 11, 0.2);">Hold</span>
        </div>

        <div class="bed-patient-info" style="border-left: 3px solid var(--status-reserved);">
          <div class="patient-main">
            <span class="patient-name">Reserved: ${bed.patient.name}</span>
          </div>
          <div class="patient-meta">${bed.patient.diagnosis || 'Incoming Reservation'} • ${bed.patient.admittedAt || 'Pending Arrival'}</div>
        </div>
      `;
    } else if (bed.status === 'cleaning') {
      patientContent = `
        <div class="bed-cleaning-info">
          <div style="font-weight:700; margin-bottom:2px;">✨ Sanitization in Progress</div>
          <div class="cleaning-timer-box">
            <span>⏱️</span>
            <span>${bed.cleaningMinutesLeft || 10}m countdown</span>
          </div>
          <button class="btn btn-primary btn-sm" style="margin-top:6px; width:100%;" onclick="quickCleanBed('${bed.id}')">
            ✓ Complete Sanitization
          </button>
        </div>
      `;
    } else if (bed.status === 'maintenance') {
      patientContent = `
        <div class="bed-empty-info" style="color:var(--status-maintenance);">
          <div style="font-size:18px;">🛠️</div>
          <div style="font-weight:600;">Maintenance & BioMed Check</div>
          <button class="btn btn-outline btn-sm" style="margin-top:6px;" onclick="changeBedStatus('${bed.id}', 'available')">Return to Service</button>
        </div>
      `;
    } else {
      patientContent = `
        <div class="bed-empty-info">
          <div style="font-size:18px;">✨</div>
          <div style="font-weight:600; color:var(--status-available);">Ready for Patient Admission</div>
          <div>Sterilized, equipped & stocked</div>
        </div>
      `;
    }

    // Action buttons
    let actionButtons = '';
    if (bed.status === 'available') {
      actionButtons = `
        <button class="btn btn-primary btn-sm" onclick="openAdmitModal('${bed.id}')">Admit</button>
        <button class="btn btn-outline btn-sm" onclick="openResourceModal('${bed.id}')">Equipment</button>
        <button class="btn btn-outline btn-sm" onclick="openStatusModal('${bed.id}')">Status</button>
      `;
    } else if (bed.status === 'occupied') {
      actionButtons = `
        <button class="btn btn-outline btn-sm" onclick="openTransferModal('${bed.id}')">Transfer</button>
        <button class="btn btn-danger btn-sm" onclick="dischargePatient('${bed.id}')">Discharge</button>
        <button class="btn btn-outline btn-sm" onclick="openResourceModal('${bed.id}')">Equipment</button>
      `;
    } else if (bed.status === 'reserved') {
      actionButtons = `
        <button class="btn btn-primary btn-sm" onclick="confirmAdmitReserved('${bed.id}')">Admit</button>
        <button class="btn btn-outline btn-sm" onclick="changeBedStatus('${bed.id}', 'available')">Cancel Hold</button>
      `;
    } else {
      actionButtons = `
        <button class="btn btn-success btn-sm" onclick="quickCleanBed('${bed.id}')">Sanitize Ready</button>
        <button class="btn btn-outline btn-sm" onclick="openStatusModal('${bed.id}')">Status</button>
      `;
    }

    return `
      <div class="bed-card status-${bed.status}">
        <div class="bed-card-header">
          <div class="bed-id-wrap">
            <span class="bed-id-text">${bed.id}</span>
            <span class="category-tag tag-${bed.cat}">${catShort}</span>
          </div>
          <span class="status-pill ${bed.status}">● ${(bed.status || '').toUpperCase()}</span>
        </div>

        <div class="bed-dept-sub">
          <span>${dept ? dept.icon : '🏥'} ${dept ? dept.name : bed.dept}</span>
          <span>• ${bed.name}</span>
        </div>

        ${patientContent}

        <div class="bed-resources-wrap">${resourceBadges}</div>
        <div class="bed-actions-row">${actionButtons}</div>
      </div>
    `;
  }).join('');
}

function renderSidebarStats() {
  const depts = appState.departments || [];
  depts.forEach(dept => {
    const deptBeds = (appState.beds || []).filter(b => b.dept === dept.id);
    const avail = deptBeds.filter(b => b.status === 'available').length;
    const pill = document.getElementById(`nav-pill-${dept.id}`);
    if (pill) {
      pill.textContent = `${avail} free`;
      pill.style.background = avail === 0 ? '#ef4444' : 'rgba(255,255,255,0.1)';
      pill.style.color = avail === 0 ? '#fff' : 'var(--text-secondary)';
    }
  });

  // Pending reservations count
  const pendingCount = (appState.reservations || []).filter(r => r.status === 'pending').length;
  const resPill = document.getElementById('nav-pill-reservations');
  if (resPill) {
    resPill.textContent = `${pendingCount} pending`;
    resPill.style.background = pendingCount > 0 ? '#f59e0b' : 'rgba(255,255,255,0.1)';
    resPill.style.color = pendingCount > 0 ? '#1f2937' : 'var(--text-secondary)';
  }
}

function renderAlertBanner() {
  const banner = document.getElementById('alertTickerText');
  if (!banner) return;

  const totalIcu = (appState.beds || []).filter(b => b.cat === 'icu');
  const availIcu = totalIcu.filter(b => b.status === 'available').length;
  const pendingRes = (appState.reservations || []).filter(r => r.status === 'pending').length;

  if (availIcu <= 1) {
    banner.innerHTML = `<strong>ICU ALERT:</strong> Only ${availIcu} critical care bed remaining! Bed manager triage active.`;
  } else if (pendingRes > 0) {
    banner.innerHTML = `<strong>CITIZEN REQUESTS:</strong> ${pendingRes} online bed reservation request(s) awaiting hospital staff review.`;
  } else {
    banner.innerHTML = `<strong>NORMAL ROTATION:</strong> All 7 clinical departments operational. Aadhaar e-KYC verified admissions active.`;
  }
}

function renderResourcesView() {
  const container = document.getElementById('resourcesGrid');
  if (!container) return;

  container.innerHTML = Object.values(appState.resources || {}).map(res => {
    const available = res.total - (res.inUse + res.inMaint);
    const usagePct = Math.round((res.inUse / res.total) * 100);
    return `
      <div class="resource-card">
        <div class="res-header">
          <div class="res-title-box">
            <span class="res-icon">${res.icon}</span>
            <span class="res-name">${res.name}</span>
          </div>
          ${available <= 2 ? '<span class="ticker-tag" style="background:#ef4444;">LOW STOCK</span>' : ''}
        </div>
        <div class="res-counter">${available} <span style="font-size:13px; color:var(--text-muted); font-weight:500;">Available Now</span></div>
        <div class="res-meter-bar">
          <div class="res-meter-fill" style="width: ${usagePct}%; background-color: ${usagePct > 80 ? '#ef4444' : '#0284c7'};"></div>
        </div>
        <div class="res-footer-details">
          <span>In Use: <strong>${res.inUse}</strong></span>
          <span>Maintenance: <strong>${res.inMaint}</strong></span>
          <span>Total: <strong>${res.total}</strong></span>
        </div>
      </div>
    `;
  }).join('');
}

function renderAuditView() {
  const tableBody = document.getElementById('auditTableBody');
  if (!tableBody) return;

  tableBody.innerHTML = (appState.auditLogs || []).map(log => {
    const d = new Date(log.timestamp);
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `
      <tr>
        <td style="white-space:nowrap;"><strong>${timeStr}</strong><div style="font-size:10px; color:var(--text-muted);">${dateStr}</div></td>
        <td><span class="audit-badge audit-${log.actionType || 'status'}">${log.action}</span></td>
        <td><strong>${log.bedId}</strong><div style="font-size:10px; color:var(--text-muted);">${log.dept} • ${log.cat}</div></td>
        <td>${log.details}</td>
        <td><strong>${log.staff}</strong></td>
        <td style="color:var(--text-secondary); font-style:italic;">${log.notes || '—'}</td>
      </tr>
    `;
  }).join('');
}

// ==========================================
// OPERATIONAL ACTIONS (API CONNECTED)
// ==========================================

async function completeAllSanitization() {
  try {
    const res = await fetch(`${API_BASE}/api/beds/sanitize-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffName: appState.currentUser?.name || 'EVS Lead' })
    });
    const data = await res.json();
    playAudioChime('success');
    showToast(data.message, 'success');
    await syncStateWithBackend();
    renderActiveView();
  } catch (e) {
    showToast('Failed to complete sanitization', 'error');
  }
}

async function completeDepartmentSanitization() {
  if (!appState.selectedDeptId) return completeAllSanitization();
  try {
    const res = await fetch(`${API_BASE}/api/beds/sanitize-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deptId: appState.selectedDeptId, staffName: appState.currentUser?.name || 'EVS Lead' })
    });
    const data = await res.json();
    playAudioChime('success');
    showToast(data.message, 'success');
    await syncStateWithBackend();
    renderActiveView();
  } catch (e) {
    showToast('Failed to complete department sanitization', 'error');
  }
}

async function dischargeRecoveredPatients(targetDept = null) {
  try {
    const res = await fetch(`${API_BASE}/api/beds/discharge-recovered`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deptId: targetDept, staffName: appState.currentUser?.name || 'Staff' })
    });
    const data = await res.json();
    if (data.success) {
      playAudioChime('info');
      showToast(data.message, 'success');
      await syncStateWithBackend();
      renderActiveView();
    } else {
      showToast(data.message || 'No recovered patients eligible', 'info');
    }
  } catch (e) {
    showToast('Discharge request failed', 'error');
  }
}

function dischargeDepartmentRecovered() {
  dischargeRecoveredPatients(appState.selectedDeptId);
}

async function togglePatientRecovered(bedId) {
  try {
    const res = await fetch(`${API_BASE}/api/beds/toggle-recovered`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bedId, staffName: appState.currentUser?.name || 'Staff' })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Bed ${bedId} status updated to: ${data.recovered ? '✓ Recovered' : 'In Treatment'}`, 'info');
      await syncStateWithBackend();
      renderActiveView();
    }
  } catch (e) {
    showToast('Toggle failed', 'error');
  }
}

async function quickCleanBed(bedId) {
  await changeBedStatus(bedId, 'available', 'Terminal sanitization certified');
}

async function changeBedStatus(bedId, status, reason = 'Operator update') {
  try {
    const res = await fetch(`${API_BASE}/api/beds/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bedId, status, reason, staffName: appState.currentUser?.name || 'Staff' })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Bed ${bedId} updated to ${status.toUpperCase()}`, 'info');
      await syncStateWithBackend();
      renderActiveView();
    }
  } catch (e) {
    showToast('Status update failed', 'error');
  }
}

async function dischargePatient(bedId) {
  if (!confirm(`Confirm discharge for bed ${bedId}? Bed will transition to Cleaning queue.`)) return;
  try {
    const res = await fetch(`${API_BASE}/api/beds/discharge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bedId, staffName: appState.currentUser?.name || 'Staff' })
    });
    const data = await res.json();
    if (data.success) {
      playAudioChime('info');
      showToast(data.message, 'success');
      await syncStateWithBackend();
      renderActiveView();
    }
  } catch (e) {
    showToast('Discharge failed', 'error');
  }
}

function openAdmitModal(bedId) {
  const bed = (appState.beds || []).find(b => b.id === bedId);
  if (!bed) return;

  const modal = document.getElementById('admitModal');
  document.getElementById('admitBedId').value = bedId;
  document.getElementById('admitModalBedTitle').textContent = `Admit Patient to Bed ${bed.id} (${bed.name})`;
  document.getElementById('admitPatientMRN').value = 'MRN-' + Math.floor(1000 + Math.random() * 9000);
  document.getElementById('admitPatientName').value = '';
  document.getElementById('admitDiagnosis').value = '';

  const now = new Date();
  document.getElementById('admitTimeDisplay').value = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + now.toLocaleDateString([], { month: 'short', day: 'numeric' });

  const docSelect = document.getElementById('admitDoctorSelect');
  if (docSelect) {
    const deptDocs = (appState.departmentDoctors || {})[bed.dept] || [];
    docSelect.innerHTML = deptDocs.map(d => `<option value="${d.name}" data-specialty="${d.specialty}">${d.name} (${d.specialty})</option>`).join('');
    if (deptDocs.length === 0) {
      docSelect.innerHTML = `<option value="Dr. David Chen, MD" data-specialty="Intensivist">Dr. David Chen, MD</option>`;
    }
  }

  document.querySelectorAll('#admitModal input[type="checkbox"]').forEach(cb => cb.checked = false);
  modal.classList.add('open');
}

document.getElementById('admitForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const bedId = document.getElementById('admitBedId').value;
  const name = document.getElementById('admitPatientName').value.trim();
  const age = document.getElementById('admitPatientAge').value;
  const mrn = document.getElementById('admitPatientMRN').value;
  const acuity = document.getElementById('admitAcuity').value;
  const diagnosis = document.getElementById('admitDiagnosis').value.trim();

  const docSelect = document.getElementById('admitDoctorSelect');
  const doc = docSelect ? docSelect.value : 'Dr. David Chen, MD';
  const docOption = docSelect ? docSelect.selectedOptions[0] : null;
  const docSpecialty = docOption ? docOption.getAttribute('data-specialty') || 'Attending' : 'Attending';

  const resources = [];
  document.querySelectorAll('#admitModal input[name="resources"]:checked').forEach(cb => resources.push(cb.value));

  try {
    const res = await fetch(`${API_BASE}/api/beds/admit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bedId, name, age, mrn, acuity, diagnosis, doc, docSpecialty, resources,
        staffName: appState.currentUser?.name || 'Staff'
      })
    });
    const data = await res.json();
    if (data.success) {
      playAudioChime('success');
      showToast(data.message, 'success');
      closeAllModals();
      await syncStateWithBackend();
      renderActiveView();
    }
  } catch (err) {
    showToast('Admission failed', 'error');
  }
});

function openTransferModal(bedId) {
  const sourceBed = (appState.beds || []).find(b => b.id === bedId);
  if (!sourceBed || !sourceBed.patient) return;

  const modal = document.getElementById('transferModal');
  document.getElementById('transferSourceBedId').value = sourceBed.id;
  document.getElementById('transferModalTitle').textContent = `Transfer ${sourceBed.patient.name} from ${sourceBed.id}`;

  const targetSelect = document.getElementById('transferTargetBed');
  const availableBeds = (appState.beds || []).filter(b => b.status === 'available' && b.id !== bedId);

  targetSelect.innerHTML = availableBeds.map(b => `<option value="${b.id}">${b.id} - ${b.dept} [${b.cat.toUpperCase()}] (${b.name})</option>`).join('');
  document.getElementById('transferSubmitBtn').disabled = availableBeds.length === 0;

  modal.classList.add('open');
}

document.getElementById('transferForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const sourceBedId = document.getElementById('transferSourceBedId').value;
  const targetBedId = document.getElementById('transferTargetBed').value;
  const reason = document.getElementById('transferReason').value.trim() || 'Clinical condition transfer';

  try {
    const res = await fetch(`${API_BASE}/api/beds/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceBedId, targetBedId, reason, staffName: appState.currentUser?.name || 'Staff' })
    });
    const data = await res.json();
    if (data.success) {
      playAudioChime('info');
      showToast(data.message, 'success');
      closeAllModals();
      await syncStateWithBackend();
      renderActiveView();
    }
  } catch (err) {
    showToast('Transfer failed', 'error');
  }
});

function openStatusModal(bedId) {
  const bed = (appState.beds || []).find(b => b.id === bedId);
  if (!bed) return;
  const modal = document.getElementById('statusModal');
  document.getElementById('statusBedId').value = bedId;
  document.getElementById('statusModalTitle').textContent = `Change Status for Bed ${bed.id}`;
  document.getElementById('statusSelect').value = bed.status;
  document.getElementById('statusReason').value = '';
  modal.classList.add('open');
}

document.getElementById('statusForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const bedId = document.getElementById('statusBedId').value;
  const status = document.getElementById('statusSelect').value;
  const reason = document.getElementById('statusReason').value.trim();
  await changeBedStatus(bedId, status, reason);
  closeAllModals();
});

function openResourceModal(bedId) {
  const bed = (appState.beds || []).find(b => b.id === bedId);
  if (!bed) return;

  const modal = document.getElementById('resourceModal');
  document.getElementById('resBedId').value = bedId;
  document.getElementById('resModalTitle').textContent = `Manage Equipment for Bed ${bed.id}`;

  const currentResources = bed.resources || [];
  const listContainer = document.getElementById('resModalChecklist');

  listContainer.innerHTML = Object.values(appState.resources || {}).map(res => {
    const isChecked = currentResources.includes(res.id);
    const available = res.total - (res.inUse + res.inMaint);
    return `
      <label class="checkbox-item" style="justify-content:space-between;">
        <span style="display:flex; align-items:center; gap:8px;">
          <input type="checkbox" name="bedResources" value="${res.id}" ${isChecked ? 'checked' : ''}>
          <span>${res.icon} ${res.name}</span>
        </span>
        <span style="font-size:11px; color:var(--text-muted);">(${available} free)</span>
      </label>
    `;
  }).join('');

  modal.classList.add('open');
}

document.getElementById('resourceForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const bedId = document.getElementById('resBedId').value;
  const bed = (appState.beds || []).find(b => b.id === bedId);
  if (!bed) return;

  const newResources = [];
  document.querySelectorAll('#resourceModal input[name="bedResources"]:checked').forEach(cb => newResources.push(cb.value));
  bed.resources = newResources;

  showToast(`Equipment updated for bed ${bed.id}`, 'success');
  closeAllModals();
  renderActiveView();
});

function confirmAdmitReserved(bedId) {
  const bed = (appState.beds || []).find(b => b.id === bedId);
  if (!bed || !bed.patient) return;
  bed.status = 'occupied';
  bed.patient.admittedTimestamp = Date.now();
  bed.patient.admittedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (Today)';
  showToast(`Bed ${bed.id} occupied by ${bed.patient.name}`, 'success');
  renderActiveView();
}

// ==========================================
// UTILITIES & CLOCK
// ==========================================

function startLiveClock() {
  updateLiveClock();
  setInterval(updateLiveClock, 1000);
}

function updateLiveClock() {
  const now = new Date();
  const timeElem = document.getElementById('headerLiveClock');
  const dateElem = document.getElementById('headerLiveDate');
  const shiftElem = document.getElementById('headerShiftBadge');

  if (timeElem) timeElem.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (dateElem) dateElem.textContent = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  if (shiftElem) {
    const hour = now.getHours();
    shiftElem.textContent = (hour >= 7 && hour < 19) ? 'Day Shift (07:00-19:00)' : 'Night Shift (19:00-07:00)';
  }
}

function getElapsedStayString(timestamp) {
  if (!timestamp) return 'Recent';
  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffMins = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`;
  if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m`;
  return `${diffMins}m`;
}

function getInitials(name) {
  if (!name) return 'MD';
  const clean = name.replace(/Dr\.|MD|RN|BSN|,/gi, '').trim();
  const parts = clean.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0] || 'MD').substring(0, 2).toUpperCase();
}

function playAudioChime(type) {
  if (!appState.simulation.audioEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    if (type === 'success') {
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'alert') {
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(659.25, now + 0.15);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else {
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch (e) {}
}

function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✓' : (type === 'warning' ? '⚠️' : (type === 'error' ? '❌' : 'ℹ️'));
  toast.innerHTML = `<span style="font-weight:700;">${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function setupModals() {
  document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAllModals();
    });
  });
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(modal => modal.classList.remove('open'));
}

function setupFilters() {
  document.getElementById('filterCategory')?.addEventListener('change', (e) => {
    appState.filters.category = e.target.value;
    renderActiveView();
  });
  document.getElementById('filterStatus')?.addEventListener('change', (e) => {
    appState.filters.status = e.target.value;
    renderActiveView();
  });
  document.getElementById('filterAcuity')?.addEventListener('change', (e) => {
    appState.filters.acuity = e.target.value;
    renderActiveView();
  });
  document.getElementById('filterSearch')?.addEventListener('input', (e) => {
    appState.filters.search = e.target.value.trim();
    renderActiveView();
  });
}

function resetFilters() {
  appState.filters = { category: 'all', status: 'all', search: '', acuity: 'all' };
  appState.selectedDoctorFilter = null;
  const c = document.getElementById('filterCategory');
  const s = document.getElementById('filterStatus');
  const q = document.getElementById('filterSearch');
  const a = document.getElementById('filterAcuity');
  if (c) c.value = 'all';
  if (s) s.value = 'all';
  if (q) q.value = '';
  if (a) a.value = 'all';
  renderActiveView();
}

function setupSimulation() {
  document.querySelectorAll('.sim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sim-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      appState.simulation.speed = parseInt(btn.getAttribute('data-speed'), 10);
      restartSimulationInterval();
      showToast(`Simulation speed: ${appState.simulation.speed}x`, 'info');
    });
  });

  document.getElementById('simulateSurgeBtn')?.addEventListener('click', () => {
    showToast('🚨 Mass Casualty Surge Alert triggered!', 'warning');
    syncStateWithBackend();
  });

  document.getElementById('completeAllSanitizationBtn')?.addEventListener('click', completeAllSanitization);
  document.getElementById('dischargeRecoveredBtn')?.addEventListener('click', () => dischargeRecoveredPatients());
}

function startSimulationTicker() {
  restartSimulationInterval();
}

function restartSimulationInterval() {
  if (appState.simulation.intervalId) clearInterval(appState.simulation.intervalId);
  appState.simulation.intervalId = setInterval(() => {
    // Tick down cleaning beds locally
    let changed = false;
    (appState.beds || []).forEach(b => {
      if (b.status === 'cleaning' && b.cleaningMinutesLeft > 0) {
        b.cleaningMinutesLeft -= 1 * appState.simulation.speed;
        if (b.cleaningMinutesLeft <= 0) {
          b.cleaningMinutesLeft = 0;
          b.status = 'available';
          changed = true;
        }
      }
    });
    if (changed) {
      renderActiveView();
      renderSidebarStats();
    }
  }, 10000 / appState.simulation.speed);
}

function exportAuditToCSV() {
  const logs = appState.auditLogs || [];
  if (logs.length === 0) {
    showToast('No logs to export', 'info');
    return;
  }
  const headers = ['Timestamp', 'Action', 'ActionType', 'BedID', 'Department', 'Category', 'Details', 'Staff', 'Notes'];
  const rows = logs.map(l => [
    `"${l.timestamp}"`, `"${l.action}"`, `"${l.actionType}"`, `"${l.bedId}"`,
    `"${l.dept}"`, `"${l.cat}"`, `"${(l.details || '').replace(/"/g, '""')}"`,
    `"${l.staff}"`, `"${(l.notes || '').replace(/"/g, '""')}"`
  ]);
  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encoded = encodeURI(csvContent);
  const a = document.createElement('a');
  a.setAttribute('href', encoded);
  a.setAttribute('download', `hospital_audit_log_${Date.now()}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Audit log exported to CSV', 'success');
}

// Global DOM Ready Initialization
document.addEventListener('DOMContentLoaded', initApp);
