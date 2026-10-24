/**
 * Hospital Bed Availability & Resource Coordination System
 * Enterprise Core Application Engine v2.1
 * 
 * Features:
 * - Specific Bed Categories: ICU, Emergency, Longer Stay Rooms
 * - Prominent Assigned Doctor Display at Each Bed & in Each Department
 * - Complete All Sanitization & Quick Turnover
 * - Discharge Recovered Patients Batch & Individual Workflow
 * - Comprehensive Real-Time Operational Clock, Length of Stay, & Sanitization Countdown
 * - Basic Audit History with CSV Export
 *
 * v3 (backend edition): state lives on the Flask server (shared, persistent),
 * the operator is the signed-in & KYC-verified user, and audit entries are
 * stamped by the server.
 */

// Data Structure & Seed Information
const DEPARTMENTS = [
  { id: 'ED', name: 'Emergency & Trauma Center', short: 'Emergency', icon: '🚑', floor: 'Ground Floor - Wing A', color: '#f97316' },
  { id: 'CCU', name: 'Cardiology & Critical Care', short: 'Cardiology', icon: '🫀', floor: '2nd Floor - Wing C', color: '#ec4899' },
  { id: 'NICU', name: 'Neurology & Stroke Center', short: 'Neurology', icon: '🧠', floor: '3rd Floor - Wing B', color: '#8b5cf6' },
  { id: 'PICU', name: 'Pediatrics & PICU', short: 'Pediatrics', icon: '🧸', floor: '4th Floor - Wing A', color: '#06b6d4' },
  { id: 'SURG', name: 'General Surgery & Post-Op', short: 'Surgery', icon: '🩺', floor: '2nd Floor - Wing B', color: '#10b981' },
  { id: 'RESP', name: 'Pulmonology & Respiratory Care', short: 'Pulmonology', icon: '🫁', floor: '3rd Floor - Wing D', color: '#3b82f6' },
  { id: 'ONCO', name: 'Oncology & Hematology', short: 'Oncology', icon: '🎗️', floor: '5th Floor - Wing A', color: '#a855f7' }
];

// Department Attending Doctors Registry
const DEPARTMENT_DOCTORS = {
  ED: [
    { name: 'Dr. Sarah Jenkins, MD', specialty: 'Lead Trauma & Resuscitation', initials: 'SJ' },
    { name: 'Dr. David Chen, MD', specialty: 'Emergency Critical Care', initials: 'DC' },
    { name: 'Dr. Priya Sharma, MD', specialty: 'Trauma Surgery', initials: 'PS' }
  ],
  CCU: [
    { name: 'Dr. Robert Gupta, MD', specialty: 'Chief Interventional Cardiologist', initials: 'RG' },
    { name: 'Dr. Clara Hayes, MD', specialty: 'Cardiovascular Intensivist', initials: 'CH' }
  ],
  NICU: [
    { name: 'Dr. Sarah Sterling, MD', specialty: 'Neuro-Intensivist & Stroke Lead', initials: 'SS' },
    { name: 'Dr. Arthur Vance, MD', specialty: 'Chief Neurosurgeon', initials: 'AV' }
  ],
  PICU: [
    { name: 'Dr. Maya Foster, MD', specialty: 'Pediatric Critical Care Specialist', initials: 'MF' },
    { name: 'Dr. Michael Adams, MD', specialty: 'Pediatric Pulmonology', initials: 'MA' }
  ],
  SURG: [
    { name: 'Dr. Miranda Bailey, MD', specialty: 'Chief Surgical Intensivist', initials: 'MB' },
    { name: 'Dr. Michael Weber, MD', specialty: 'Trauma & General Surgeon', initials: 'MW' }
  ],
  RESP: [
    { name: 'Dr. James Mercer, MD', specialty: 'Pulmonology & ECMO Director', initials: 'JM' },
    { name: 'Dr. David Bowman, MD', specialty: 'Respiratory Critical Care', initials: 'DB' }
  ],
  ONCO: [
    { name: 'Dr. Dana Vance, MD', specialty: 'Hematology & Oncology Director', initials: 'DV' },
    { name: 'Dr. Fox Mulder, MD', specialty: 'Protective Isolation Specialist', initials: 'FM' }
  ]
};

const CATEGORIES = {
  icu: { id: 'icu', name: 'ICU Beds', short: 'ICU', badgeClass: 'tag-icu', cardClass: 'cat-icu', icon: '⚡' },
  emergency: { id: 'emergency', name: 'Emergency Beds', short: 'Emergency', badgeClass: 'tag-emergency', cardClass: 'cat-emergency', icon: '🚨' },
  longstay: { id: 'longstay', name: 'Rooms for Longer Stays', short: 'Long Stay Room', badgeClass: 'tag-longstay', cardClass: 'cat-longstay', icon: '🛌' }
};

const STATUS_CONFIG = {
  available: { label: 'Available', class: 'available', color: '#10b981' },
  occupied: { label: 'Occupied', class: 'occupied', color: '#f43f5e' },
  reserved: { label: 'Reserved', class: 'reserved', color: '#f59e0b' },
  cleaning: { label: 'Cleaning', class: 'cleaning', color: '#38bdf8' },
  maintenance: { label: 'Maintenance', class: 'maintenance', color: '#a855f7' }
};

const INITIAL_RESOURCE_CATALOG = {
  ventilators: { id: 'ventilators', name: 'Mechanical Ventilators', icon: '🫁', total: 24, inUse: 14, inMaint: 2 },
  monitors: { id: 'monitors', name: 'Vital Signs Monitors', icon: '📈', total: 60, inUse: 38, inMaint: 3 },
  infusion_pumps: { id: 'infusion_pumps', name: 'Smart Infusion Pumps', icon: '💉', total: 75, inUse: 45, inMaint: 4 },
  oxygen_ports: { id: 'oxygen_ports', name: 'High-Flow O2 Blenders', icon: '🫧', total: 30, inUse: 18, inMaint: 1 },
  crash_carts: { id: 'crash_carts', name: 'Defibrillator Crash Carts', icon: '⚡', total: 14, inUse: 7, inMaint: 0 },
  dialysis: { id: 'dialysis', name: 'Mobile Dialysis Units', icon: '🩸', total: 8, inUse: 4, inMaint: 1 }
};

// Seed beds across departments ensuring ICU, Emergency, and Long Stay are represented with doctors & timestamps
function generateSeedBeds() {
  const now = Date.now();
  const seed = [
    // EMERGENCY DEPARTMENT (ED)
    { id: 'ED-EM-01', name: 'Trauma Bay 1', dept: 'ED', cat: 'emergency', status: 'occupied', patient: { name: 'Arthur Pendelton', age: 48, mrn: 'MRN-7821', acuity: 'critical', diagnosis: 'Polytrauma / MVA', doc: 'Dr. David Chen, MD', docSpecialty: 'Emergency Critical Care', admittedTimestamp: now - (2 * 3600 * 1000 + 15 * 60 * 1000), admittedAt: 'Today 10:15 AM', recovered: false }, resources: ['ventilators', 'monitors', 'infusion_pumps'] },
    { id: 'ED-EM-02', name: 'Acute Bay 2', dept: 'ED', cat: 'emergency', status: 'occupied', patient: { name: 'Rebecca Alvarez', age: 34, mrn: 'MRN-9014', acuity: 'urgent', diagnosis: 'Severe Asthma Exacerbation', doc: 'Dr. Sarah Jenkins, MD', docSpecialty: 'Lead Trauma & Resuscitation', admittedTimestamp: now - (1 * 3600 * 1000 + 40 * 60 * 1000), admittedAt: 'Today 10:45 AM', recovered: false }, resources: ['oxygen_ports', 'monitors'] },
    { id: 'ED-EM-03', name: 'Triage Bay 3', dept: 'ED', cat: 'emergency', status: 'available', patient: null, resources: ['monitors'] },
    { id: 'ED-EM-04', name: 'Resuscitation Bay 4', dept: 'ED', cat: 'emergency', status: 'cleaning', patient: null, cleaningMinutesLeft: 12, cleaningStartedAt: now - 3 * 60 * 1000, resources: [] },
    { id: 'ED-ICU-01', name: 'Emergency ICU 1', dept: 'ED', cat: 'icu', status: 'occupied', patient: { name: 'Thomas Wright', age: 62, mrn: 'MRN-6421', acuity: 'critical', diagnosis: 'Septic Shock / Hypotension', doc: 'Dr. David Chen, MD', docSpecialty: 'Emergency Critical Care', admittedTimestamp: now - (4 * 3600 * 1000 + 20 * 60 * 1000), admittedAt: 'Today 08:05 AM', recovered: false }, resources: ['ventilators', 'monitors', 'infusion_pumps'] },
    { id: 'ED-ICU-02', name: 'Emergency ICU 2', dept: 'ED', cat: 'icu', status: 'available', patient: null, resources: ['monitors'] },
    { id: 'ED-OBS-101', name: 'ED Obs Room 101', dept: 'ED', cat: 'longstay', status: 'occupied', patient: { name: 'Gary Miller', age: 71, mrn: 'MRN-4319', acuity: 'low', diagnosis: 'Transient Ischemic Attack Observation', doc: 'Dr. Priya Sharma, MD', docSpecialty: 'Trauma Surgery', admittedTimestamp: now - (14 * 3600 * 1000), admittedAt: 'Yesterday 22:30 PM', recovered: true }, resources: ['monitors'] },
    { id: 'ED-OBS-102', name: 'ED Obs Room 102', dept: 'ED', cat: 'longstay', status: 'available', patient: null, resources: [] },
    { id: 'ED-OBS-103', name: 'ED Obs Room 103', dept: 'ED', cat: 'longstay', status: 'reserved', patient: { name: 'Incoming Ambulance Transfer', age: 55, mrn: 'MRN-PENDING', acuity: 'urgent', diagnosis: 'Acute Abdominal Pain', doc: 'Dr. Sarah Jenkins, MD', docSpecialty: 'Lead Trauma & Resuscitation', admittedTimestamp: now, admittedAt: 'ETA in 15 mins', recovered: false }, resources: [] },

    // CARDIOLOGY & CCU
    { id: 'CCU-ICU-01', name: 'Cardiac ICU 1', dept: 'CCU', cat: 'icu', status: 'occupied', patient: { name: 'Eleanor Vance', age: 67, mrn: 'MRN-1120', acuity: 'critical', diagnosis: 'Acute STEMI / Post-PCI', doc: 'Dr. Robert Gupta, MD', docSpecialty: 'Chief Interventional Cardiologist', admittedTimestamp: now - (8 * 3600 * 1000), admittedAt: 'Today 04:25 AM', recovered: false }, resources: ['ventilators', 'monitors', 'infusion_pumps'] },
    { id: 'CCU-ICU-02', name: 'Cardiac ICU 2', dept: 'CCU', cat: 'icu', status: 'occupied', patient: { name: 'Harold Finch', age: 73, mrn: 'MRN-8842', acuity: 'critical', diagnosis: 'Decompensated Heart Failure', doc: 'Dr. Clara Hayes, MD', docSpecialty: 'Cardiovascular Intensivist', admittedTimestamp: now - (26 * 3600 * 1000), admittedAt: 'Yesterday 10:00 AM', recovered: false }, resources: ['monitors', 'infusion_pumps'] },
    { id: 'CCU-ICU-03', name: 'Cardiac ICU 3', dept: 'CCU', cat: 'icu', status: 'available', patient: null, resources: ['monitors'] },
    { id: 'CCU-ICU-04', name: 'Cardiac ICU 4', dept: 'CCU', cat: 'icu', status: 'maintenance', patient: null, resources: [] },
    { id: 'CCU-EM-01', name: 'Cardiac Intake Bay 1', dept: 'CCU', cat: 'emergency', status: 'occupied', patient: { name: 'Douglas Ross', age: 52, mrn: 'MRN-5501', acuity: 'urgent', diagnosis: 'Unstable Angina', doc: 'Dr. Robert Gupta, MD', docSpecialty: 'Chief Interventional Cardiologist', admittedTimestamp: now - (3 * 3600 * 1000), admittedAt: 'Today 09:25 AM', recovered: false }, resources: ['monitors'] },
    { id: 'CCU-EM-02', name: 'Cardiac Intake Bay 2', dept: 'CCU', cat: 'emergency', status: 'available', patient: null, resources: [] },
    { id: 'CCU-RM-201', name: 'Telemetry Room 201', dept: 'CCU', cat: 'longstay', status: 'occupied', patient: { name: 'Clara Oswald', age: 60, mrn: 'MRN-3312', acuity: 'moderate', diagnosis: 'Post-CABG Day 3 Recovery', doc: 'Dr. Clara Hayes, MD', docSpecialty: 'Cardiovascular Intensivist', admittedTimestamp: now - (72 * 3600 * 1000), admittedAt: 'Oct 21, 11:30 AM', recovered: false }, resources: ['monitors'] },
    { id: 'CCU-RM-202', name: 'Telemetry Room 202', dept: 'CCU', cat: 'longstay', status: 'occupied', patient: { name: 'Bernard Lowe', age: 69, mrn: 'MRN-9943', acuity: 'low', diagnosis: 'Arrhythmia Stabilized / Ready', doc: 'Dr. Robert Gupta, MD', docSpecialty: 'Chief Interventional Cardiologist', admittedTimestamp: now - (48 * 3600 * 1000), admittedAt: 'Oct 22, 12:00 PM', recovered: true }, resources: ['monitors'] },
    { id: 'CCU-RM-203', name: 'Telemetry Room 203', dept: 'CCU', cat: 'longstay', status: 'available', patient: null, resources: [] },
    { id: 'CCU-RM-204', name: 'Telemetry Room 204', dept: 'CCU', cat: 'longstay', status: 'cleaning', patient: null, cleaningMinutesLeft: 18, cleaningStartedAt: now - 2 * 60 * 1000, resources: [] },

    // NEUROLOGY & STROKE
    { id: 'NICU-01', name: 'Neuro ICU 1', dept: 'NICU', cat: 'icu', status: 'occupied', patient: { name: 'Walter Bishop', age: 65, mrn: 'MRN-2245', acuity: 'critical', diagnosis: 'Acute Ischemic Stroke / tPA', doc: 'Dr. Sarah Sterling, MD', docSpecialty: 'Neuro-Intensivist & Stroke Lead', admittedTimestamp: now - (5 * 3600 * 1000), admittedAt: 'Today 07:25 AM', recovered: false }, resources: ['ventilators', 'monitors', 'infusion_pumps'] },
    { id: 'NICU-02', name: 'Neuro ICU 2', dept: 'NICU', cat: 'icu', status: 'occupied', patient: { name: 'Astrid Farnsworth', age: 39, mrn: 'MRN-7731', acuity: 'urgent', diagnosis: 'Status Epilepticus Post-Ictal', doc: 'Dr. Sarah Sterling, MD', docSpecialty: 'Neuro-Intensivist & Stroke Lead', admittedTimestamp: now - (12 * 3600 * 1000), admittedAt: 'Today 00:25 AM', recovered: false }, resources: ['monitors', 'infusion_pumps'] },
    { id: 'NICU-03', name: 'Neuro ICU 3', dept: 'NICU', cat: 'icu', status: 'available', patient: null, resources: ['monitors'] },
    { id: 'NEURO-EM-01', name: 'Stroke Rapid Bay 1', dept: 'NICU', cat: 'emergency', status: 'available', patient: null, resources: ['monitors'] },
    { id: 'NEURO-EM-02', name: 'Stroke Rapid Bay 2', dept: 'NICU', cat: 'emergency', status: 'occupied', patient: { name: 'Peter Bell', age: 58, mrn: 'MRN-1940', acuity: 'urgent', diagnosis: 'Acute Hemiparesis Protocol', doc: 'Dr. Arthur Vance, MD', docSpecialty: 'Chief Neurosurgeon', admittedTimestamp: now - (45 * 60 * 1000), admittedAt: 'Today 11:40 AM', recovered: false }, resources: ['monitors'] },
    { id: 'NEURO-RM-301', name: 'Neuro Inpatient Room 301', dept: 'NICU', cat: 'longstay', status: 'occupied', patient: { name: 'Olivia Dunham', age: 41, mrn: 'MRN-5629', acuity: 'low', diagnosis: 'Post-Stroke Rehab Goals Met', doc: 'Dr. Arthur Vance, MD', docSpecialty: 'Chief Neurosurgeon', admittedTimestamp: now - (120 * 3600 * 1000), admittedAt: 'Oct 19, 14:00 PM', recovered: true }, resources: [] },
    { id: 'NEURO-RM-302', name: 'Neuro Inpatient Room 302', dept: 'NICU', cat: 'longstay', status: 'available', patient: null, resources: [] },
    { id: 'NEURO-RM-303', name: 'Neuro Inpatient Room 303', dept: 'NICU', cat: 'longstay', status: 'available', patient: null, resources: [] },
    { id: 'NEURO-RM-304', name: 'Neuro Inpatient Room 304', dept: 'NICU', cat: 'longstay', status: 'cleaning', patient: null, cleaningMinutesLeft: 8, cleaningStartedAt: now - 7 * 60 * 1000, resources: [] },

    // PEDIATRICS & PICU
    { id: 'PICU-01', name: 'Pediatric ICU 1', dept: 'PICU', cat: 'icu', status: 'occupied', patient: { name: 'Leo Martinez', age: 7, mrn: 'MRN-3011', acuity: 'critical', diagnosis: 'Severe Bronchiolitis / RSV', doc: 'Dr. Maya Foster, MD', docSpecialty: 'Pediatric Critical Care Specialist', admittedTimestamp: now - (18 * 3600 * 1000), admittedAt: 'Yesterday 18:25 PM', recovered: false }, resources: ['ventilators', 'monitors', 'infusion_pumps'] },
    { id: 'PICU-02', name: 'Pediatric ICU 2', dept: 'PICU', cat: 'icu', status: 'available', patient: null, resources: ['monitors'] },
    { id: 'PICU-03', name: 'Pediatric ICU 3', dept: 'PICU', cat: 'icu', status: 'available', patient: null, resources: ['monitors'] },
    { id: 'PEDS-EM-01', name: 'Peds Trauma Bay 1', dept: 'PICU', cat: 'emergency', status: 'occupied', patient: { name: 'Mia Chen', age: 4, mrn: 'MRN-8422', acuity: 'urgent', diagnosis: 'Febrile Seizure / Dehydration', doc: 'Dr. Maya Foster, MD', docSpecialty: 'Pediatric Critical Care Specialist', admittedTimestamp: now - (2 * 3600 * 1000), admittedAt: 'Today 10:25 AM', recovered: false }, resources: ['monitors'] },
    { id: 'PEDS-EM-02', name: 'Peds Urgent Bay 2', dept: 'PICU', cat: 'emergency', status: 'available', patient: null, resources: [] },
    { id: 'PEDS-RM-401', name: 'Peds Family Suite 401', dept: 'PICU', cat: 'longstay', status: 'occupied', patient: { name: 'Ethan Hunt Jr.', age: 9, mrn: 'MRN-4198', acuity: 'moderate', diagnosis: 'Post-Appendectomy Day 2', doc: 'Dr. Michael Adams, MD', docSpecialty: 'Pediatric Pulmonology', admittedTimestamp: now - (48 * 3600 * 1000), admittedAt: 'Oct 22, 10:00 AM', recovered: false }, resources: ['infusion_pumps'] },
    { id: 'PEDS-RM-402', name: 'Peds Family Suite 402', dept: 'PICU', cat: 'longstay', status: 'occupied', patient: { name: 'Sophia Ray', age: 11, mrn: 'MRN-7612', acuity: 'low', diagnosis: 'Pneumonia Resolved / Home Oral Meds', doc: 'Dr. Maya Foster, MD', docSpecialty: 'Pediatric Critical Care Specialist', admittedTimestamp: now - (72 * 3600 * 1000), admittedAt: 'Oct 21, 09:15 AM', recovered: true }, resources: [] },
    { id: 'PEDS-RM-403', name: 'Peds Family Suite 403', dept: 'PICU', cat: 'longstay', status: 'available', patient: null, resources: [] },
    { id: 'PEDS-RM-404', name: 'Peds Family Suite 404', dept: 'PICU', cat: 'longstay', status: 'available', patient: null, resources: [] },

    // GENERAL SURGERY & POST-OP
    { id: 'SICU-01', name: 'Surgical ICU 1', dept: 'SURG', cat: 'icu', status: 'occupied', patient: { name: 'Gordon Freeman', age: 53, mrn: 'MRN-1049', acuity: 'critical', diagnosis: 'Whipple Procedure Post-Op', doc: 'Dr. Miranda Bailey, MD', docSpecialty: 'Chief Surgical Intensivist', admittedTimestamp: now - (6 * 3600 * 1000), admittedAt: 'Today 06:25 AM', recovered: false }, resources: ['ventilators', 'monitors', 'infusion_pumps'] },
    { id: 'SICU-02', name: 'Surgical ICU 2', dept: 'SURG', cat: 'icu', status: 'occupied', patient: { name: 'Sarah Connor', age: 45, mrn: 'MRN-9210', acuity: 'urgent', diagnosis: 'Aortic Repair Monitoring', doc: 'Dr. Miranda Bailey, MD', docSpecialty: 'Chief Surgical Intensivist', admittedTimestamp: now - (10 * 3600 * 1000), admittedAt: 'Today 02:25 AM', recovered: false }, resources: ['monitors', 'infusion_pumps'] },
    { id: 'SICU-03', name: 'Surgical ICU 3', dept: 'SURG', cat: 'icu', status: 'available', patient: null, resources: ['monitors'] },
    { id: 'SURG-EM-01', name: 'OR Recovery Acute Bay 1', dept: 'SURG', cat: 'emergency', status: 'occupied', patient: { name: 'Isaac Clarke', age: 38, mrn: 'MRN-6031', acuity: 'urgent', diagnosis: 'Emergency Laparotomy Stabilization', doc: 'Dr. Michael Weber, MD', docSpecialty: 'Trauma & General Surgeon', admittedTimestamp: now - (1 * 3600 * 1000), admittedAt: 'Today 11:25 AM', recovered: false }, resources: ['monitors'] },
    { id: 'SURG-EM-02', name: 'OR Recovery Acute Bay 2', dept: 'SURG', cat: 'emergency', status: 'available', patient: null, resources: [] },
    { id: 'SURG-RM-501', name: 'Post-Surg Room 501', dept: 'SURG', cat: 'longstay', status: 'occupied', patient: { name: 'Alyx Vance', age: 31, mrn: 'MRN-4491', acuity: 'moderate', diagnosis: 'Spine Fusion Recovery', doc: 'Dr. Miranda Bailey, MD', docSpecialty: 'Chief Surgical Intensivist', admittedTimestamp: now - (96 * 3600 * 1000), admittedAt: 'Oct 20, 15:00 PM', recovered: false }, resources: ['infusion_pumps'] },
    { id: 'SURG-RM-502', name: 'Post-Surg Room 502', dept: 'SURG', cat: 'longstay', status: 'occupied', patient: { name: 'Barney Calhoun', age: 49, mrn: 'MRN-8317', acuity: 'low', diagnosis: 'Total Knee Arthroplasty Ambulating', doc: 'Dr. Michael Weber, MD', docSpecialty: 'Trauma & General Surgeon', admittedTimestamp: now - (48 * 3600 * 1000), admittedAt: 'Oct 22, 11:30 AM', recovered: true }, resources: [] },
    { id: 'SURG-RM-503', name: 'Post-Surg Room 503', dept: 'SURG', cat: 'longstay', status: 'available', patient: null, resources: [] },
    { id: 'SURG-RM-504', name: 'Post-Surg Room 504', dept: 'SURG', cat: 'longstay', status: 'available', patient: null, resources: [] },
    { id: 'SURG-RM-505', name: 'Post-Surg Room 505', dept: 'SURG', cat: 'longstay', status: 'cleaning', patient: null, cleaningMinutesLeft: 15, cleaningStartedAt: now - 1 * 60 * 1000, resources: [] },

    // PULMONOLOGY & RESPIRATORY
    { id: 'RICU-01', name: 'Respiratory ICU 1', dept: 'RESP', cat: 'icu', status: 'occupied', patient: { name: 'Elizabeth Shaw', age: 62, mrn: 'MRN-5128', acuity: 'critical', diagnosis: 'Severe ARDS / Proned', doc: 'Dr. James Mercer, MD', docSpecialty: 'Pulmonology & ECMO Director', admittedTimestamp: now - (24 * 3600 * 1000), admittedAt: 'Yesterday 12:00 PM', recovered: false }, resources: ['ventilators', 'monitors', 'infusion_pumps'] },
    { id: 'RICU-02', name: 'Respiratory ICU 2', dept: 'RESP', cat: 'icu', status: 'occupied', patient: { name: 'David Bowman', age: 59, mrn: 'MRN-3829', acuity: 'critical', diagnosis: 'COPD Exacerbation Weaning', doc: 'Dr. David Bowman, MD', docSpecialty: 'Respiratory Critical Care', admittedTimestamp: now - (48 * 3600 * 1000), admittedAt: 'Oct 22, 12:25 PM', recovered: false }, resources: ['ventilators', 'oxygen_ports', 'monitors'] },
    { id: 'RICU-03', name: 'Respiratory ICU 3', dept: 'RESP', cat: 'icu', status: 'available', patient: null, resources: ['ventilators', 'monitors'] },
    { id: 'RESP-EM-01', name: 'Acute Bronch Bay 1', dept: 'RESP', cat: 'emergency', status: 'occupied', patient: { name: 'Frank Poole', age: 68, mrn: 'MRN-7290', acuity: 'urgent', diagnosis: 'Acute Pulmonary Embolism', doc: 'Dr. James Mercer, MD', docSpecialty: 'Pulmonology & ECMO Director', admittedTimestamp: now - (3 * 3600 * 1000), admittedAt: 'Today 09:25 AM', recovered: false }, resources: ['oxygen_ports', 'monitors'] },
    { id: 'RESP-EM-02', name: 'Acute Bronch Bay 2', dept: 'RESP', cat: 'emergency', status: 'available', patient: null, resources: [] },
    { id: 'RESP-RM-601', name: 'Pulm Inpatient Room 601', dept: 'RESP', cat: 'longstay', status: 'occupied', patient: { name: 'Roy Batty', age: 70, mrn: 'MRN-4903', acuity: 'moderate', diagnosis: 'Interstitial Lung Disease / O2 Weaning', doc: 'Dr. David Bowman, MD', docSpecialty: 'Respiratory Critical Care', admittedTimestamp: now - (144 * 3600 * 1000), admittedAt: 'Oct 18, 10:00 AM', recovered: false }, resources: ['oxygen_ports'] },
    { id: 'RESP-RM-602', name: 'Pulm Inpatient Room 602', dept: 'RESP', cat: 'longstay', status: 'available', patient: null, resources: [] },
    { id: 'RESP-RM-603', name: 'Pulm Inpatient Room 603', dept: 'RESP', cat: 'longstay', status: 'available', patient: null, resources: [] },

    // ONCOLOGY & HEMATOLOGY
    { id: 'ONCO-ICU-01', name: 'Isolation ICU 1', dept: 'ONCO', cat: 'icu', status: 'occupied', patient: { name: 'Dana Scully', age: 51, mrn: 'MRN-2104', acuity: 'critical', diagnosis: 'Neutropenic Sepsis Post-Chemo', doc: 'Dr. Dana Vance, MD', docSpecialty: 'Hematology & Oncology Director', admittedTimestamp: now - (24 * 3600 * 1000), admittedAt: 'Yesterday 12:25 PM', recovered: false }, resources: ['ventilators', 'monitors', 'infusion_pumps'] },
    { id: 'ONCO-ICU-02', name: 'Isolation ICU 2', dept: 'ONCO', cat: 'icu', status: 'available', patient: null, resources: ['monitors'] },
    { id: 'ONCO-EM-01', name: 'Onco Acute Bay 1', dept: 'ONCO', cat: 'emergency', status: 'available', patient: null, resources: [] },
    { id: 'ONCO-EM-02', name: 'Onco Acute Bay 2', dept: 'ONCO', cat: 'emergency', status: 'occupied', patient: { name: 'Fox Mulder', age: 54, mrn: 'MRN-9122', acuity: 'urgent', diagnosis: 'Tumor Lysis Syndrome Alert', doc: 'Dr. Fox Mulder, MD', docSpecialty: 'Protective Isolation Specialist', admittedTimestamp: now - (2 * 3600 * 1000), admittedAt: 'Today 10:25 AM', recovered: false }, resources: ['monitors', 'infusion_pumps'] },
    { id: 'ONCO-RM-701', name: 'Onco Long Suite 701', dept: 'ONCO', cat: 'longstay', status: 'occupied', patient: { name: 'James Holden', age: 44, mrn: 'MRN-6712', acuity: 'moderate', diagnosis: 'Induction Chemotherapy Day 5', doc: 'Dr. Dana Vance, MD', docSpecialty: 'Hematology & Oncology Director', admittedTimestamp: now - (120 * 3600 * 1000), admittedAt: 'Oct 19, 11:00 AM', recovered: false }, resources: ['infusion_pumps'] },
    { id: 'ONCO-RM-702', name: 'Onco Long Suite 702', dept: 'ONCO', cat: 'longstay', status: 'occupied', patient: { name: 'Naomi Nagata', age: 39, mrn: 'MRN-8819', acuity: 'low', diagnosis: 'Stem Cell Engraftment Certified', doc: 'Dr. Dana Vance, MD', docSpecialty: 'Hematology & Oncology Director', admittedTimestamp: now - (192 * 3600 * 1000), admittedAt: 'Oct 16, 16:30 PM', recovered: true }, resources: [] },
    { id: 'ONCO-RM-703', name: 'Onco Long Suite 703', dept: 'ONCO', cat: 'longstay', status: 'available', patient: null, resources: [] },
    { id: 'ONCO-RM-704', name: 'Onco Long Suite 704', dept: 'ONCO', cat: 'longstay', status: 'available', patient: null, resources: [] }
  ];
  return seed;
}

// Global Application State
let appState = {
  beds: [],
  resources: {},
  auditLogs: [],
  currentStaff: { id: 'me', name: 'Staff', role: '', initials: 'ST' },
  isAdmin: false,
  rev: 0,            // server revision this tab last saw
  pendingAudit: [],  // audit entries not yet sent to the server
  resetPending: false,
  currentView: 'overview', // 'overview', 'dept-{id}', 'resources', 'audit'
  selectedDeptId: null,
  selectedDoctorFilter: null,
  filters: {
    category: 'all',
    status: 'all',
    search: '',
    acuity: 'all'
  },
  simulation: {
    running: true,
    speed: 1, // 1x, 5x, 15x
    intervalId: null,
    audioEnabled: true
  }
};

// ------------------------------------------------------------------
// Server API helper (session cookie + CSRF header)
// ------------------------------------------------------------------
const CLIENT_ID = 'c' + Math.random().toString(36).slice(2, 12);
const CSRF_TOKEN = document.querySelector('meta[name="csrf-token"]')?.content || '';

async function api(path, { method = 'GET', body, keepalive = false } = {}) {
  const headers = { 'X-CSRF-Token': CSRF_TOKEN };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, {
    method, headers, keepalive, credentials: 'same-origin',
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* empty body */ }
  if (res.status === 401) { location.href = '/login'; }
  if (res.status === 403 && data.code === 'kyc_required') { location.href = '/kyc'; }
  return { ok: res.ok, status: res.status, data };
}

// Initialize Application
async function initApp() {
  const ds = document.body.dataset;
  const name = ds.userName || 'Staff';
  appState.currentStaff = { id: 'me', name, role: ds.userRole || '', initials: getInitials(name) };
  appState.isAdmin = ds.isAdmin === '1';

  // Bind UI Events
  setupNavigation();
  setupSimulation();
  setupModals();
  setupFilters();
  setupActionButtons();

  // Start Real-Time Clocks
  startLiveClock();

  // Load shared state from the server (seeds it the very first time)
  const ok = await loadServerState(true);
  if (!ok) showToast('Could not load data from the server. Retrying…', 'error');

  renderActiveView();
  renderSidebarStats();
  renderAlertBanner();
  renderStaffProfile();

  startSimulationTicker();
  startStatePolling();
}

function applyServerState(d) {
  appState.rev = d.rev;
  if (!d.beds) {               // brand-new database: seed it from the demo data
    resetToDefaultState(false);
    return;
  }
  appState.beds = d.beds;
  appState.resources = d.resources || JSON.parse(JSON.stringify(INITIAL_RESOURCE_CATALOG));
  appState.auditLogs = d.auditLogs || [];
}

async function loadServerState(first = false) {
  try {
    const r = await api('/api/state' + (first ? '' : '?rev=' + appState.rev));
    if (!r.ok) return false;
    if (r.data.changed === false) return false;
    applyServerState(r.data);
    return true;
  } catch (e) {
    return false;
  }
}

function startStatePolling() {
  setInterval(async () => {
    if (document.hidden || _saveInFlight || _stateDirty) return;
    if (document.querySelector('.modal-overlay.open')) return;   // don't pull data out from under a form
    if (await loadServerState(false)) {
      renderActiveView();
      renderSidebarStats();
      renderAlertBanner();
    }
  }, 4000);
}

// Reset state to pristine seed data (admin only on the server; also used for first-time seeding)
function resetToDefaultState(showAlert = true) {
  appState.beds = generateSeedBeds();
  appState.resources = JSON.parse(JSON.stringify(INITIAL_RESOURCE_CATALOG));
  appState.selectedDoctorFilter = null;
  appState.auditLogs = [];
  appState.pendingAudit = [];
  appState.resetPending = showAlert;
  logAuditEvent(
    'SYSTEM_INIT', 'status', 'ALL', 'SYSTEM', 'system',
    'Hospital Command Center Initialized with standard baseline bed census',
    'Initial ward layout and assigned attending doctor rosters loaded'
  );
  if (showAlert) {
    showToast('Dashboard reset to standard simulation baseline.', 'info');
    renderActiveView();
    renderSidebarStats();
    renderAlertBanner();
  }
}

// ------------------------------------------------------------------
// Persistence: debounced push to the server with revision checking
// ------------------------------------------------------------------
let _saveTimer = null;
let _saveInFlight = false;
let _stateDirty = false;

// Mirror of the server's sanitiser (< > " only; never '&', so it is idempotent).
// Run before every render that follows a save so user-typed text can't become markup.
const _ESC_MAP = { '<': '&lt;', '>': '&gt;', '"': '&quot;' };
function escapeStateInPlace(node) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => {
      if (typeof v === 'string') node[i] = v.replace(/[<>"]/g, c => _ESC_MAP[c]);
      else if (v && typeof v === 'object') escapeStateInPlace(v);
    });
  } else if (node && typeof node === 'object') {
    Object.keys(node).forEach(k => {
      const v = node[k];
      if (typeof v === 'string') node[k] = v.replace(/[<>"]/g, c => _ESC_MAP[c]);
      else if (v && typeof v === 'object') escapeStateInPlace(v);
    });
  }
}

function saveState() {
  escapeStateInPlace(appState.beds);
  escapeStateInPlace(appState.pendingAudit);
  escapeStateInPlace(appState.auditLogs);
  _stateDirty = true;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(pushState, 350);
}

function buildStatePayload() {
  return {
    baseRev: appState.rev,
    beds: appState.beds,
    resources: appState.resources,
    newAuditLogs: appState.pendingAudit,
    reset: appState.resetPending
  };
}

async function pushState() {
  if (_saveInFlight) { _saveTimer = setTimeout(pushState, 300); return; }
  if (!_stateDirty) return;
  _saveInFlight = true;
  _stateDirty = false;

  const sentAudit = appState.pendingAudit.splice(0);
  const wasReset = appState.resetPending;
  appState.resetPending = false;
  const payload = { ...buildStatePayload(), newAuditLogs: sentAudit, reset: wasReset };

  try {
    const r = await api('/api/state', { method: 'PUT', body: payload });
    if (r.ok) {
      appState.rev = r.data.rev;
    } else if (r.status === 409) {
      // Someone else saved first. Take their version so nobody's data is overwritten.
      applyServerState(r.data);
      renderActiveView(); renderSidebarStats(); renderAlertBanner();
      showToast('Another user updated the dashboard at the same time. Your last change was not saved. Please review and redo it.', 'warning');
    } else {
      throw new Error(r.data.error || ('HTTP ' + r.status));
    }
  } catch (e) {
    // Network / server problem: keep the changes and retry
    appState.pendingAudit = sentAudit.concat(appState.pendingAudit);
    appState.resetPending = appState.resetPending || wasReset;
    _stateDirty = true;
    _saveTimer = setTimeout(pushState, 4000);
    showToast('Could not reach the server. Retrying…', 'error');
  } finally {
    _saveInFlight = false;
  }
}

// Best-effort flush if the tab is closed with unsaved changes
window.addEventListener('pagehide', () => {
  if (!_stateDirty || _saveInFlight) return;
  try {
    api('/api/state', { method: 'PUT', body: buildStatePayload(), keepalive: true });
  } catch (e) { /* nothing more we can do */ }
});

// Real-Time Operational Clock & Shift Detection
function startLiveClock() {
  updateLiveClock();
  setInterval(updateLiveClock, 1000);
}

function updateLiveClock() {
  const now = new Date();
  const timeElem = document.getElementById('headerLiveClock');
  const dateElem = document.getElementById('headerLiveDate');
  const shiftElem = document.getElementById('headerShiftBadge');

  if (timeElem) {
    timeElem.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  if (dateElem) {
    dateElem.textContent = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }

  if (shiftElem) {
    const hour = now.getHours();
    if (hour >= 7 && hour < 19) {
      shiftElem.textContent = 'Day Shift (07:00-19:00)';
      shiftElem.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      shiftElem.style.color = '#10b981';
    } else {
      shiftElem.textContent = 'Night Shift (19:00-07:00)';
      shiftElem.style.borderColor = 'rgba(56, 189, 248, 0.4)';
      shiftElem.style.color = '#38bdf8';
    }
  }
}

// Human-friendly stay duration calculator
function getElapsedStayString(timestamp) {
  if (!timestamp) return 'Recent';
  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffMins = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    const remHours = diffHours % 24;
    return `${diffDays}d ${remHours}h`;
  }
  if (diffHours > 0) {
    const remMins = diffMins % 60;
    return `${diffHours}h ${remMins}m`;
  }
  return `${diffMins}m`;
}

function getInitials(name) {
  if (!name) return 'MD';
  const clean = name.replace(/Dr\.|MD|RN|BSN|,/gi, '').trim();
  const parts = clean.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return 'MD';
}

// Setup Navigation
function setupNavigation() {
  const navContainer = document.getElementById('deptNavList');
  if (!navContainer) return;

  navContainer.innerHTML = DEPARTMENTS.map(dept => `
    <a class="nav-link" data-view="dept-${dept.id}" id="nav-dept-${dept.id}">
      <span class="nav-link-left">
        <span class="nav-icon">${dept.icon}</span>
        <span>${dept.short}</span>
      </span>
      <span class="nav-pill" id="nav-pill-${dept.id}">0 free</span>
    </a>
  `).join('');

  document.querySelectorAll('[data-view]').forEach(elem => {
    elem.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = elem.getAttribute('data-view');
      navigateTo(targetView);
    });
  });

  // Theme toggle
  document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    document.getElementById('themeToggleBtn').innerHTML = isLight ? '🌙' : '☀️';
  });

  // Audio toggle
  document.getElementById('audioToggleBtn')?.addEventListener('click', () => {
    appState.simulation.audioEnabled = !appState.simulation.audioEnabled;
    const btn = document.getElementById('audioToggleBtn');
    btn.innerHTML = appState.simulation.audioEnabled ? '🔔' : '🔕';
    showToast(appState.simulation.audioEnabled ? 'Audio alerts turned ON' : 'Audio alerts muted', 'info');
  });

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', logoutUser);

  // Reset button
  document.getElementById('resetSystemBtn')?.addEventListener('click', () => {
    if (confirm('Reset entire dashboard to initial demo scenario? Any custom edits will be refreshed.')) {
      resetToDefaultState(true);
    }
  });

  // Export audit log button
  document.getElementById('exportAuditCsvBtn')?.addEventListener('click', exportAuditToCSV);
}

// Bind New Action Buttons (Complete All Sanitization, Discharge Recovered Patients)
function setupActionButtons() {
  document.getElementById('completeAllSanitizationBtn')?.addEventListener('click', () => {
    completeAllSanitization();
  });

  document.getElementById('dischargeRecoveredBtn')?.addEventListener('click', () => {
    dischargeRecoveredPatients();
  });
}

function navigateTo(viewId) {
  appState.currentView = viewId;
  appState.selectedDoctorFilter = null; // reset doctor filter on tab switch

  if (viewId.startsWith('dept-')) {
    appState.selectedDeptId = viewId.replace('dept-', '');
  } else {
    appState.selectedDeptId = null;
  }

  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('data-view') === viewId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  if (viewId === 'overview') {
    document.getElementById('viewOverview').classList.add('active');
    document.getElementById('pageTitleText').textContent = 'Hospital Operations Command Center';
  } else if (viewId.startsWith('dept-')) {
    document.getElementById('viewDepartment').classList.add('active');
    const dept = DEPARTMENTS.find(d => d.id === appState.selectedDeptId);
    document.getElementById('pageTitleText').textContent = `${dept.icon} ${dept.name} Dashboard`;
  } else if (viewId === 'resources') {
    document.getElementById('viewResources').classList.add('active');
    document.getElementById('pageTitleText').textContent = 'Hospital Equipment & Resource Inventory';
  } else if (viewId === 'audit') {
    document.getElementById('viewAudit').classList.add('active');
    document.getElementById('pageTitleText').textContent = 'Operational Audit Trail & Change History';
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
  } else if (appState.currentView === 'audit') {
    renderAuditView();
  }
  renderSidebarStats();
}

// ========================================================
// CORE NEW FEATURES: COMPLETE ALL SANITIZATION & DISCHARGE
// ========================================================

/**
 * Complete All Sanitization Hospital-Wide
 */
function completeAllSanitization() {
  const cleaningBeds = appState.beds.filter(b => b.status === 'cleaning');
  if (cleaningBeds.length === 0) {
    showToast('No beds currently waiting in the sanitization queue.', 'info');
    return;
  }

  const bedIds = cleaningBeds.map(b => b.id);
  cleaningBeds.forEach(b => {
    b.status = 'available';
    b.cleaningMinutesLeft = 0;
    b.cleaningStartedAt = null;
  });

  logAuditEvent(
    'TERMINAL_SANITIZATION_ALL_COMPLETE',
    'status',
    `ALL (${bedIds.join(', ')})`,
    'HOSPITAL-WIDE',
    'all',
    `Terminal UV disinfection completed for ${bedIds.length} beds: [${bedIds.join(', ')}].`,
    'All beds certified sterile, linen prepped, and returned to AVAILABLE status.'
  );

  playAudioChime('success');
  showToast(`✨ Complete Sanitization Verified: ${bedIds.length} beds sterilized and READY!`, 'success');
  saveState();
  renderActiveView();
  renderAlertBanner();
}

/**
 * Complete Sanitization for Current Department Only
 */
function completeDepartmentSanitization() {
  if (!appState.selectedDeptId) return completeAllSanitization();
  const dept = DEPARTMENTS.find(d => d.id === appState.selectedDeptId);
  const cleaningBeds = appState.beds.filter(b => b.dept === appState.selectedDeptId && b.status === 'cleaning');

  if (cleaningBeds.length === 0) {
    showToast(`No beds in ${dept ? dept.short : 'this department'} are currently pending sanitization.`, 'info');
    return;
  }

  const count = cleaningBeds.length;
  const bedIds = cleaningBeds.map(b => b.id);

  cleaningBeds.forEach(b => {
    b.status = 'available';
    b.cleaningMinutesLeft = 0;
    b.cleaningStartedAt = null;
  });

  logAuditEvent(
    'DEPT_SANITIZATION_COMPLETE',
    'status',
    bedIds.join(', '),
    appState.selectedDeptId,
    'all',
    `Environmental Services completed sanitization of ${count} beds in ${dept.name}.`,
    'Unit turnover certified ready'
  );

  playAudioChime('success');
  showToast(`✨ Sanitized ${count} beds in ${dept.short}! All returned to AVAILABLE.`, 'success');
  saveState();
  renderActiveView();
  renderAlertBanner();
}

/**
 * Discharge Recovered Patients
 * Discharges all patients flagged as recovered or with stable discharge-ready criteria
 */
function dischargeRecoveredPatients(targetDeptId = null) {
  let eligibleBeds = appState.beds.filter(b => {
    if (b.status !== 'occupied' || !b.patient) return false;
    if (targetDeptId && b.dept !== targetDeptId) return false;
    return b.patient.recovered === true || b.patient.acuity === 'low';
  });

  if (eligibleBeds.length === 0) {
    showToast('No patients currently marked as recovered. Click "Mark Recovered" on any patient bed card first.', 'info');
    return;
  }

  const dischargedPatients = [];

  eligibleBeds.forEach(bed => {
    const patient = bed.patient;
    dischargedPatients.push({ name: patient.name, mrn: patient.mrn, bedId: bed.id, doc: patient.doc });

    // Release deployed equipment back to fleet
    if (bed.resources && bed.resources.length > 0) {
      bed.resources.forEach(r => {
        if (appState.resources[r] && appState.resources[r].inUse > 0) {
          appState.resources[r].inUse--;
        }
      });
    }

    // Bed moves to cleaning
    bed.status = 'cleaning';
    bed.patient = null;
    bed.resources = [];
    bed.cleaningMinutesLeft = 15;
    bed.cleaningStartedAt = Date.now();

    logAuditEvent(
      'PATIENT_RECOVERED_DISCHARGE',
      'discharge',
      bed.id,
      bed.dept,
      bed.cat,
      `Recovered patient ${patient.name} (${patient.mrn}) discharged home/stepdown. Attending: ${patient.doc}.`,
      `Admission length of stay completed. Bed queued for sanitization.`
    );
  });

  playAudioChime('info');
  const deptStr = targetDeptId ? ` in ${targetDeptId}` : '';
  showToast(`🩺 Discharge Complete: ${dischargedPatients.length} recovered patient(s)${deptStr} discharged! Beds queued for cleaning.`, 'success');
  saveState();
  renderActiveView();
  renderAlertBanner();
}

function dischargeDepartmentRecovered() {
  dischargeRecoveredPatients(appState.selectedDeptId);
}

// Toggle individual patient recovery status on bed card
function togglePatientRecovered(bedId) {
  const bed = appState.beds.find(b => b.id === bedId);
  if (!bed || !bed.patient) return;

  bed.patient.recovered = !bed.patient.recovered;
  const statusStr = bed.patient.recovered ? 'CLINICALLY RECOVERED (Ready for Discharge)' : 'IN ACTIVE TREATMENT';

  logAuditEvent(
    'PATIENT_RECOVERY_UPDATED',
    'status',
    bed.id,
    bed.dept,
    bed.cat,
    `Patient ${bed.patient.name} (${bed.patient.mrn}) flagged as: ${statusStr}. Attending: ${bed.patient.doc}.`,
    'Physician rounding assessment updated'
  );

  showToast(`${bed.patient.name} status updated to: ${bed.patient.recovered ? '✓ Recovered' : 'In Treatment'}`, 'info');
  saveState();
  renderActiveView();
}

// ========================================================
// RENDERERS
// ========================================================

// Render Overview View (Hospital-Wide)
function renderOverviewView() {
  const beds = appState.beds;
  const totalBeds = beds.length;
  const availableBeds = beds.filter(b => b.status === 'available').length;
  const occupiedBeds = beds.filter(b => b.status === 'occupied').length;
  const reservedBeds = beds.filter(b => b.status === 'reserved').length;
  const cleaningBeds = beds.filter(b => b.status === 'cleaning').length;
  const maintBeds = beds.filter(b => b.status === 'maintenance').length;
  const occupancyPct = Math.round((occupiedBeds / totalBeds) * 100);

  // Update KPI counters
  document.getElementById('ovTotalBeds').textContent = totalBeds;
  document.getElementById('ovAvailableBeds').textContent = availableBeds;
  document.getElementById('ovOccupiedBeds').textContent = occupiedBeds;
  document.getElementById('ovOccupancyPct').textContent = occupancyPct + '%';
  document.getElementById('ovCleaningBeds').textContent = cleaningBeds;
  document.getElementById('ovMaintBeds').textContent = maintBeds;

  // Render 3 Category Summary Cards (ICU, Emergency, Longer Stays)
  renderCategoryBreakdown(beds, 'overviewCategoryCards');

  // Render Department Matrix Table
  renderDepartmentComparisonMatrix();

  // Render All Beds Grid for overview (with filters)
  renderBedsGrid('overviewBedsGrid', beds);
}

// Render Department View (Department-Specific)
function renderDepartmentView(deptId) {
  const dept = DEPARTMENTS.find(d => d.id === deptId);
  if (!dept) return;

  const deptBeds = appState.beds.filter(b => b.dept === deptId);
  const totalBeds = deptBeds.length;
  const availableBeds = deptBeds.filter(b => b.status === 'available').length;
  const occupiedBeds = deptBeds.filter(b => b.status === 'occupied').length;
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  // Header badges
  document.getElementById('deptFloorTag').textContent = dept.floor;
  document.getElementById('deptTotalBadge').textContent = `${totalBeds} Total Beds`;
  document.getElementById('deptAvailBadge').textContent = `${availableBeds} Available`;
  document.getElementById('deptOccBadge').textContent = `${occupancyPct}% Occupancy`;

  // Render Category Breakdown for this department
  renderCategoryBreakdown(deptBeds, 'deptCategoryCards');

  // Render Assigned Doctors on duty panel for this department
  renderDepartmentDoctors(deptId);

  // Render Department Beds
  renderBedsGrid('deptBedsGrid', deptBeds);
}

// Render Department Assigned Doctors on Duty Panel
function renderDepartmentDoctors(deptId) {
  const container = document.getElementById('deptDoctorsList');
  if (!container) return;

  const deptDoctors = DEPARTMENT_DOCTORS[deptId] || [];
  const deptBeds = appState.beds.filter(b => b.dept === deptId && b.status === 'occupied' && b.patient);

  let html = '';

  // "All Doctors" reset chip
  const isAllActive = !appState.selectedDoctorFilter;
  html += `
    <div class="dept-doc-chip ${isAllActive ? 'active' : ''}" onclick="filterByDoctor(null)">
      <span>👥 All Attending Staff</span>
      <span class="doc-chip-count">${deptBeds.length}</span>
    </div>
  `;

  deptDoctors.forEach(doc => {
    // Count how many beds this doctor has in this department
    const docBedsCount = deptBeds.filter(b => b.patient && b.patient.doc && b.patient.doc.includes(doc.name.replace('Dr. ', '').split(',')[0])).length;
    const isSelected = appState.selectedDoctorFilter === doc.name;

    html += `
      <div class="dept-doc-chip ${isSelected ? 'active' : ''}" onclick="filterByDoctor('${doc.name}')" title="${doc.specialty}">
        <span class="bed-doc-avatar" style="width:20px; height:20px; font-size:9px;">${doc.initials}</span>
        <span><strong>${doc.name}</strong> (${doc.specialty})</span>
        <span class="doc-chip-count">${docBedsCount} patient${docBedsCount === 1 ? '' : 's'}</span>
      </div>
    `;
  });

  container.innerHTML = html;
}

function filterByDoctor(docName) {
  if (appState.selectedDoctorFilter === docName) {
    appState.selectedDoctorFilter = null;
  } else {
    appState.selectedDoctorFilter = docName;
  }
  renderActiveView();
}

// Render 3 Bed Category Cards (ICU, Emergency, Longer Stays)
function renderCategoryBreakdown(bedsList, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const cats = ['icu', 'emergency', 'longstay'];
  let html = '';

  cats.forEach(catKey => {
    const catConfig = CATEGORIES[catKey];
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

    html += `
      <div class="category-card ${catConfig.cardClass}">
        <div class="category-card-top">
          <span class="category-badge-pill">
            <span>${catConfig.icon}</span> ${catConfig.name}
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

        <div class="cat-progress-track" title="Occupied: ${occ}, Reserved: ${resv}, Cleaning: ${cln}, Available: ${avail}, Maint: ${maint}">
          <div class="progress-segment seg-occupied" style="width: ${pOcc}%"></div>
          <div class="progress-segment seg-reserved" style="width: ${pResv}%"></div>
          <div class="progress-segment seg-cleaning" style="width: ${pCln}%"></div>
          <div class="progress-segment seg-available" style="width: ${pAvail}%"></div>
          <div class="progress-segment seg-maint" style="width: ${pMaint}%"></div>
        </div>

        <div class="category-sub-stats">
          <div class="sub-stat-item">
            <span class="sub-stat-num" style="color:var(--status-available);">${avail}</span>
            <span class="sub-stat-lbl">Ready</span>
          </div>
          <div class="sub-stat-item">
            <span class="sub-stat-num" style="color:var(--status-occupied);">${occ}</span>
            <span class="sub-stat-lbl">Occupied</span>
          </div>
          <div class="sub-stat-item">
            <span class="sub-stat-num" style="color:var(--status-cleaning);">${cln}</span>
            <span class="sub-stat-lbl">Cleaning</span>
          </div>
          <div class="sub-stat-item">
            <span class="sub-stat-num" style="color:var(--status-reserved);">${resv + maint}</span>
            <span class="sub-stat-lbl">Res/Maint</span>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Department Comparison Matrix
function renderDepartmentComparisonMatrix() {
  const tableBody = document.getElementById('deptMatrixBody');
  if (!tableBody) return;

  let html = '';
  DEPARTMENTS.forEach(dept => {
    const deptBeds = appState.beds.filter(b => b.dept === dept.id);
    const total = deptBeds.length;
    const occupied = deptBeds.filter(b => b.status === 'occupied').length;
    const occupancy = total > 0 ? Math.round((occupied / total) * 100) : 0;

    const icuBeds = deptBeds.filter(b => b.cat === 'icu');
    const icuAvail = icuBeds.filter(b => b.status === 'available').length;
    const icuTotal = icuBeds.length;

    const emBeds = deptBeds.filter(b => b.cat === 'emergency');
    const emAvail = emBeds.filter(b => b.status === 'available').length;
    const emTotal = emBeds.length;

    const lsBeds = deptBeds.filter(b => b.cat === 'longstay');
    const lsAvail = lsBeds.filter(b => b.status === 'available').length;
    const lsTotal = lsBeds.length;

    html += `
      <tr onclick="navigateTo('dept-${dept.id}')" title="Click to view ${dept.name} dashboard">
        <td>
          <div class="dept-name-cell">
            <span class="dept-icon-mini">${dept.icon}</span>
            <div>
              <div>${dept.name}</div>
              <div style="font-size:11px; color:var(--text-muted);">${dept.floor}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="dept-stat-badge">
            <span class="stat-avail-badge font-bold">${icuAvail}</span>
            <span class="stat-total-badge">/ ${icuTotal}</span>
          </span>
        </td>
        <td>
          <span class="dept-stat-badge">
            <span class="stat-avail-badge font-bold">${emAvail}</span>
            <span class="stat-total-badge">/ ${emTotal}</span>
          </span>
        </td>
        <td>
          <span class="dept-stat-badge">
            <span class="stat-avail-badge font-bold">${lsAvail}</span>
            <span class="stat-total-badge">/ ${lsTotal}</span>
          </span>
        </td>
        <td>
          <span class="font-bold" style="color: ${occupancy > 85 ? '#ef4444' : (occupancy > 65 ? '#f59e0b' : 'var(--text-primary)')};">
            ${occupancy}%
          </span>
          <div style="width:60px; height:4px; background:var(--bg-main); border-radius:2px; overflow:hidden; margin-top:3px;">
            <div style="width:${occupancy}%; height:100%; background:${occupancy > 85 ? '#ef4444' : '#0284c7'};"></div>
          </div>
        </td>
        <td style="text-align: right;">
          <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); navigateTo('dept-${dept.id}')">
            View Unit →
          </button>
        </td>
      </tr>
    `;
  });

  tableBody.innerHTML = html;
}

// Render Beds Grid with filtering & prominent Assigned Doctor display
function renderBedsGrid(containerId, sourceBeds) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let filtered = sourceBeds.filter(bed => {
    if (appState.filters.category !== 'all' && bed.cat !== appState.filters.category) return false;
    if (appState.filters.status !== 'all' && bed.status !== appState.filters.status) return false;
    if (appState.filters.acuity !== 'all') {
      if (!bed.patient || bed.patient.acuity !== appState.filters.acuity) return false;
    }
    if (appState.selectedDoctorFilter) {
      if (!bed.patient || !bed.patient.doc || !bed.patient.doc.includes(appState.selectedDoctorFilter.replace('Dr. ', '').split(',')[0])) {
        return false;
      }
    }
    if (appState.filters.search) {
      const q = appState.filters.search.toLowerCase();
      const matchBed = bed.id.toLowerCase().includes(q) || bed.name.toLowerCase().includes(q);
      const matchPatient = bed.patient && (
        bed.patient.name.toLowerCase().includes(q) ||
        bed.patient.mrn.toLowerCase().includes(q) ||
        (bed.patient.doc && bed.patient.doc.toLowerCase().includes(q)) ||
        bed.patient.diagnosis.toLowerCase().includes(q)
      );
      if (!matchBed && !matchPatient) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-color);">
        <p style="font-size: 16px; font-weight: 600; margin-bottom: 6px;">No beds matching current filter criteria</p>
        <p style="font-size: 12px;">Try adjusting the category, doctor, or status filter.</p>
        <button class="btn btn-outline btn-sm" style="margin-top: 12px;" onclick="resetFilters()">Reset Filters</button>
      </div>
    `;
    return;
  }

  let html = '';
  filtered.forEach(bed => {
    const statusInfo = STATUS_CONFIG[bed.status] || { label: bed.status, class: 'available' };
    const catInfo = CATEGORIES[bed.cat] || { short: bed.cat, badgeClass: '' };
    const dept = DEPARTMENTS.find(d => d.id === bed.dept);

    // Resources badges
    let resourceBadges = '';
    if (bed.resources && bed.resources.length > 0) {
      resourceBadges = bed.resources.map(resKey => {
        const resObj = appState.resources[resKey];
        const isCritical = resKey === 'ventilators';
        return `<span class="res-tag ${isCritical ? 'res-critical' : ''}"><span>${resObj ? resObj.icon : '⚙️'}</span> ${resObj ? resObj.name.split(' ')[0] : resKey}</span>`;
      }).join('');
    }

    // Patient and Doctor information block
    let patientContent = '';
    if (bed.status === 'occupied' && bed.patient) {
      const stayDuration = getElapsedStayString(bed.patient.admittedTimestamp);
      const docInitials = getInitials(bed.patient.doc);

      patientContent = `
        <!-- Prominent Assigned Doctor Display -->
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

          <div class="patient-meta" style="margin-bottom: 4px;">
            ${bed.patient.age ? bed.patient.age + ' yo • ' : ''}<strong>${bed.patient.mrn}</strong>
          </div>

          <div class="patient-diagnosis">
            🩺 ${bed.patient.diagnosis || 'Clinical Inpatient Admission'}
          </div>

          <!-- Admission Time & Elapsed Length of Stay -->
          <div style="display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap;">
            <span class="time-meta-badge" title="Admission Time">
              🕒 In: ${bed.patient.admittedAt || 'Recent'}
            </span>
            <span class="time-meta-badge" style="color: #38bdf8;" title="Elapsed Duration of Stay">
              ⏳ Stay: ${stayDuration}
            </span>
          </div>

          <!-- Recovered Patient Status & Toggle -->
          <div class="patient-recovery-row">
            ${bed.patient.recovered ? '<span class="recovered-pill">✓ Recovered</span>' : '<span style="font-size:10px; color:var(--text-muted);">In Treatment</span>'}
            <button class="btn-recovered-toggle ${bed.patient.recovered ? 'is-recovered' : ''}" onclick="togglePatientRecovered('${bed.id}')" title="Click to toggle discharge readiness">
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
            <span class="acuity-badge acuity-${bed.patient.acuity || 'moderate'}">${bed.patient.acuity || 'Hold'}</span>
          </div>
          <div class="patient-meta">
            ${bed.patient.diagnosis || 'Incoming Transfer'} • ${bed.patient.admittedAt || 'Pending Arrival'}
          </div>
        </div>
      `;
    } else if (bed.status === 'cleaning') {
      patientContent = `
        <div class="bed-cleaning-info">
          <div style="font-weight:700; margin-bottom:2px;">✨ Sanitization in Progress</div>
          <div style="font-size:10px; color:var(--text-muted); margin-bottom:4px;">Terminal Sterilization Protocol</div>
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
          <div style="font-size:11px;">Electrical & calibration inspection</div>
          <button class="btn btn-outline btn-sm" style="margin-top:6px;" onclick="changeBedStatus('${bed.id}', 'available')">
            Return to Service
          </button>
        </div>
      `;
    } else {
      patientContent = `
        <div class="bed-empty-info">
          <div style="font-size:18px;">✨</div>
          <div style="font-weight:600; color:var(--status-available);">Ready for Patient Admission</div>
          <div>Terminal cleaned & stocked</div>
        </div>
      `;
    }

    // Action buttons based on status
    let actionButtons = '';
    if (bed.status === 'available') {
      actionButtons = `
        <button class="btn btn-primary btn-sm" onclick="openAdmitModal('${bed.id}')">Admit Patient</button>
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
    } else if (bed.status === 'cleaning') {
      actionButtons = `
        <button class="btn btn-success btn-sm" onclick="quickCleanBed('${bed.id}')">Sanitize Ready</button>
        <button class="btn btn-outline btn-sm" onclick="openStatusModal('${bed.id}')">Status</button>
      `;
    } else {
      actionButtons = `
        <button class="btn btn-primary btn-sm" onclick="changeBedStatus('${bed.id}', 'available')">Set Available</button>
        <button class="btn btn-outline btn-sm" onclick="openStatusModal('${bed.id}')">Status</button>
      `;
    }

    html += `
      <div class="bed-card status-${bed.status}">
        <div class="bed-card-header">
          <div class="bed-id-wrap">
            <span class="bed-id-text">${bed.id}</span>
            <span class="category-tag ${catInfo.badgeClass}">${catInfo.short}</span>
          </div>
          <span class="status-pill ${statusInfo.class}">
            ● ${statusInfo.label}
          </span>
        </div>

        <div class="bed-dept-sub">
          <span>${dept ? dept.icon : '🏥'} ${dept ? dept.name : bed.dept}</span>
          <span>• ${bed.name}</span>
        </div>

        ${patientContent}

        <div class="bed-resources-wrap">
          ${resourceBadges}
        </div>

        <div class="bed-actions-row">
          ${actionButtons}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Render Sidebar Stats
function renderSidebarStats() {
  DEPARTMENTS.forEach(dept => {
    const deptBeds = appState.beds.filter(b => b.dept === dept.id);
    const avail = deptBeds.filter(b => b.status === 'available').length;
    const pill = document.getElementById(`nav-pill-${dept.id}`);
    if (pill) {
      pill.textContent = `${avail} free`;
      if (avail === 0) {
        pill.style.background = '#ef4444';
        pill.style.color = '#fff';
      } else {
        pill.style.background = 'rgba(255,255,255,0.1)';
        pill.style.color = 'var(--text-secondary)';
      }
    }
  });
}

// Render Top Alert Banner
function renderAlertBanner() {
  const banner = document.getElementById('alertTickerText');
  if (!banner) return;

  const totalIcu = appState.beds.filter(b => b.cat === 'icu');
  const availIcu = totalIcu.filter(b => b.status === 'available').length;
  
  const edBeds = appState.beds.filter(b => b.dept === 'ED');
  const edOccupied = edBeds.filter(b => b.status === 'occupied').length;
  const edPct = edBeds.length > 0 ? Math.round((edOccupied / edBeds.length) * 100) : 0;

  const cleaningBedsCount = appState.beds.filter(b => b.status === 'cleaning').length;
  const recoveredPatientsCount = appState.beds.filter(b => b.status === 'occupied' && b.patient && b.patient.recovered).length;

  if (availIcu <= 2) {
    banner.innerHTML = `<strong>ICU ALERT:</strong> Only ${availIcu} critical care bed${availIcu === 1 ? '' : 's'} remaining hospital-wide! Bed manager review requested.`;
  } else if (recoveredPatientsCount >= 3) {
    banner.innerHTML = `<strong>DISCHARGE READY:</strong> ${recoveredPatientsCount} patients have completed recovery protocol and are ready for discharge.`;
  } else if (cleaningBedsCount >= 4) {
    banner.innerHTML = `<strong>TURNOVER QUEUE:</strong> ${cleaningBedsCount} beds currently awaiting sanitization. Use 'Complete All Sanitization' to return to service.`;
  } else if (edPct >= 80) {
    banner.innerHTML = `<strong>EMERGENCY SURGE:</strong> ED is at ${edPct}% capacity. Long stay transition requested for observation patients.`;
  } else {
    banner.innerHTML = `<strong>NORMAL ROTATION:</strong> All departments operational. ${appState.beds.filter(b => b.status === 'available').length} total beds available across the hospital network.`;
  }
}

// Render Resources View
function renderResourcesView() {
  const container = document.getElementById('resourcesGrid');
  if (!container) return;

  let html = '';
  Object.values(appState.resources).forEach(res => {
    const available = res.total - (res.inUse + res.inMaint);
    const usagePct = Math.round((res.inUse / res.total) * 100);
    const isCritical = available <= 2;

    html += `
      <div class="resource-card">
        <div class="res-header">
          <div class="res-title-box">
            <span class="res-icon">${res.icon}</span>
            <span class="res-name">${res.name}</span>
          </div>
          ${isCritical ? '<span class="ticker-tag" style="background:#ef4444;">LOW STOCK</span>' : ''}
        </div>

        <div class="res-counter">${available} <span style="font-size:14px; color:var(--text-muted); font-weight:500;">Available Now</span></div>

        <div class="res-meter-bar">
          <div class="res-meter-fill" style="width: ${usagePct}%; background-color: ${usagePct > 80 ? '#ef4444' : '#0284c7'};"></div>
        </div>

        <div class="res-footer-details">
          <span>In Use: <strong>${res.inUse}</strong></span>
          <span>Maintenance: <strong>${res.inMaint}</strong></span>
          <span>Total Fleet: <strong>${res.total}</strong></span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Render Audit View
function renderAuditView() {
  const tableBody = document.getElementById('auditTableBody');
  if (!tableBody) return;

  const logs = appState.auditLogs;
  if (logs.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">No audit events recorded yet.</td></tr>`;
    return;
  }

  let html = '';
  logs.forEach(log => {
    const date = new Date(log.timestamp);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

    html += `
      <tr>
        <td style="white-space:nowrap;">
          <strong>${timeStr}</strong>
          <div style="font-size:10px; color:var(--text-muted);">${dateStr}</div>
        </td>
        <td>
          <span class="audit-badge audit-${log.actionType || 'status'}">${log.action}</span>
        </td>
        <td>
          <strong>${log.bedId}</strong>
          <div style="font-size:10px; color:var(--text-muted);">${log.dept} • ${log.cat}</div>
        </td>
        <td>${log.details}</td>
        <td>
          <span style="font-weight:600;">${log.staff}</span>
        </td>
        <td style="color:var(--text-secondary); font-style:italic;">${log.notes || '—'}</td>
      </tr>
    `;
  });

  tableBody.innerHTML = html;
}

// Log an Operational Audit Event
function logAuditEvent(action, actionType, bedId, dept, cat, details, notes = '') {
  const entry = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    timestamp: new Date().toISOString(),
    staff: appState.currentStaff.name,     // display only: the server re-stamps this from the login
    action: action,
    actionType: actionType, // 'admit', 'discharge', 'transfer', 'status', 'resource', 'surge'
    bedId: bedId,
    dept: dept,
    cat: cat,
    details: details,
    notes: notes
  };

  appState.auditLogs.unshift(entry);
  if (appState.auditLogs.length > 500) appState.auditLogs.pop();
  appState.pendingAudit.push(entry);
  saveState();
}

// Signed-in user card + logout
function renderStaffProfile() {
  const staff = appState.currentStaff;
  document.getElementById('currentStaffName').textContent = staff.name;
  document.getElementById('currentStaffRole').textContent = staff.role;
  document.getElementById('currentStaffAvatar').textContent = staff.initials;
}

async function logoutUser() {
  if (_stateDirty) await pushState();
  await api('/api/logout', { method: 'POST' });
  location.href = '/login';
}

// Admit Patient Action
function openAdmitModal(bedId) {
  const bed = appState.beds.find(b => b.id === bedId);
  if (!bed) return;

  const modal = document.getElementById('admitModal');
  document.getElementById('admitBedId').value = bedId;
  document.getElementById('admitModalBedTitle').textContent = `Admit Patient to Bed ${bed.id} (${bed.name})`;
  
  // Random MRN generator
  document.getElementById('admitPatientMRN').value = 'MRN-' + Math.floor(1000 + Math.random() * 9000);
  document.getElementById('admitPatientName').value = '';
  document.getElementById('admitPatientAge').value = '';
  document.getElementById('admitDiagnosis').value = '';

  // Current admission time display
  const now = new Date();
  const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const timeDisplayElem = document.getElementById('admitTimeDisplay');
  if (timeDisplayElem) timeDisplayElem.value = timeFormatted;

  // Populate doctor select for this bed's department
  const docSelect = document.getElementById('admitDoctorSelect');
  if (docSelect) {
    const deptDocs = DEPARTMENT_DOCTORS[bed.dept] || [];
    docSelect.innerHTML = deptDocs.map(d => `<option value="${d.name}" data-specialty="${d.specialty}">${d.name} (${d.specialty})</option>`).join('');
    if (deptDocs.length === 0) {
      docSelect.innerHTML = `<option value="Dr. David Chen, MD">Dr. David Chen, MD (Intensivist)</option>`;
    }
  }
  
  // Reset checkboxes
  document.querySelectorAll('#admitModal input[type="checkbox"]').forEach(cb => cb.checked = false);

  modal.classList.add('open');
}

function submitAdmitForm(e) {
  e.preventDefault();
  const bedId = document.getElementById('admitBedId').value;
  const bed = appState.beds.find(b => b.id === bedId);
  if (!bed) return;

  const name = document.getElementById('admitPatientName').value.trim() || 'Anonymous Patient';
  const age = document.getElementById('admitPatientAge').value || '45';
  const mrn = document.getElementById('admitPatientMRN').value || 'MRN-NEW';
  const acuity = document.getElementById('admitAcuity').value;
  const diagnosis = document.getElementById('admitDiagnosis').value.trim() || 'Clinical Admission';

  const docSelect = document.getElementById('admitDoctorSelect');
  const doc = docSelect ? docSelect.value : 'Dr. David Chen, MD';
  const docOption = docSelect ? docSelect.selectedOptions[0] : null;
  const docSpecialty = docOption ? docOption.getAttribute('data-specialty') || 'Attending' : 'Attending';

  const now = new Date();
  const admittedAtStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (Today)';

  // Selected resources
  const selectedResources = [];
  document.querySelectorAll('#admitModal input[name="resources"]:checked').forEach(cb => {
    selectedResources.push(cb.value);
    if (appState.resources[cb.value]) {
      appState.resources[cb.value].inUse++;
    }
  });

  bed.status = 'occupied';
  bed.patient = {
    name,
    age: parseInt(age, 10),
    mrn,
    acuity,
    diagnosis,
    doc,
    docSpecialty,
    admittedTimestamp: Date.now(),
    admittedAt: admittedAtStr,
    recovered: false
  };
  bed.resources = selectedResources;

  logAuditEvent(
    'PATIENT_ADMIT',
    'admit',
    bed.id,
    bed.dept,
    bed.cat,
    `Admitted ${name} (${mrn}) - Acuity: ${acuity.toUpperCase()} - Assigned: ${doc}`,
    `Diagnosis: ${diagnosis}; Equipment: [${selectedResources.join(', ') || 'Standard'}]`
  );

  playAudioChime('success');
  showToast(`Patient ${name} admitted to ${bed.id} under ${doc}!`, 'success');
  closeAllModals();
  saveState();
  renderActiveView();
  renderAlertBanner();
}

function confirmAdmitReserved(bedId) {
  const bed = appState.beds.find(b => b.id === bedId);
  if (!bed || !bed.patient) return;

  bed.status = 'occupied';
  bed.patient.admittedTimestamp = Date.now();
  bed.patient.admittedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (Today)';

  logAuditEvent(
    'RESERVATION_ACTIVATED',
    'admit',
    bed.id,
    bed.dept,
    bed.cat,
    `Reserved hold activated for ${bed.patient.name}. Assigned Doctor: ${bed.patient.doc}.`,
    `Patient has arrived at unit and occupied bed.`
  );

  playAudioChime('success');
  showToast(`Bed ${bed.id} is now occupied by ${bed.patient.name}`, 'success');
  saveState();
  renderActiveView();
}

// Single Bed Discharge Patient Action
function dischargePatient(bedId) {
  const bed = appState.beds.find(b => b.id === bedId);
  if (!bed || !bed.patient) return;

  const patientName = bed.patient.name;
  const mrn = bed.patient.mrn;
  const doc = bed.patient.doc;

  if (!confirm(`Discharge patient ${patientName} (${mrn}) from bed ${bed.id}? Bed will transition to Cleaning queue.`)) {
    return;
  }

  // Release resources back to pool
  if (bed.resources && bed.resources.length > 0) {
    bed.resources.forEach(resKey => {
      if (appState.resources[resKey] && appState.resources[resKey].inUse > 0) {
        appState.resources[resKey].inUse--;
      }
    });
  }

  bed.status = 'cleaning';
  bed.patient = null;
  bed.resources = [];
  bed.cleaningMinutesLeft = 15;
  bed.cleaningStartedAt = Date.now();

  logAuditEvent(
    'PATIENT_DISCHARGE',
    'discharge',
    bed.id,
    bed.dept,
    bed.cat,
    `Discharged ${patientName} (${mrn}) overseen by ${doc}. Bed moved to sanitization queue.`,
    'Discharge orders finalized and clinical criteria met.'
  );

  playAudioChime('info');
  showToast(`${patientName} discharged. ${bed.id} moved to Cleaning queue.`, 'info');
  saveState();
  renderActiveView();
  renderAlertBanner();
}

// Quick Clean Single Bed (Transition Cleaning -> Available)
function quickCleanBed(bedId) {
  const bed = appState.beds.find(b => b.id === bedId);
  if (!bed) return;

  bed.status = 'available';
  bed.cleaningMinutesLeft = 0;
  bed.cleaningStartedAt = null;

  logAuditEvent(
    'BED_SANITIZED',
    'status',
    bed.id,
    bed.dept,
    bed.cat,
    `Terminal UV disinfection and cleaning verified for ${bed.id}.`,
    'Bed inspected and stocked for immediate occupancy.'
  );

  playAudioChime('success');
  showToast(`Bed ${bed.id} sanitized and ready for patient!`, 'success');
  saveState();
  renderActiveView();
  renderAlertBanner();
}

// Transfer Patient
function openTransferModal(bedId) {
  const sourceBed = appState.beds.find(b => b.id === bedId);
  if (!sourceBed || !sourceBed.patient) return;

  const modal = document.getElementById('transferModal');
  document.getElementById('transferSourceBedId').value = sourceBed.id;
  document.getElementById('transferModalTitle').textContent = `Transfer ${sourceBed.patient.name} from ${sourceBed.id}`;

  const targetSelect = document.getElementById('transferTargetBed');
  const availableBeds = appState.beds.filter(b => b.status === 'available' && b.id !== bedId);

  if (availableBeds.length === 0) {
    targetSelect.innerHTML = '<option value="">No available beds anywhere in the hospital!</option>';
    document.getElementById('transferSubmitBtn').disabled = true;
  } else {
    document.getElementById('transferSubmitBtn').disabled = false;
    targetSelect.innerHTML = availableBeds.map(b => {
      const dept = DEPARTMENTS.find(d => d.id === b.dept);
      const cat = CATEGORIES[b.cat];
      return `<option value="${b.id}">${b.id} - ${dept ? dept.name : b.dept} [${cat ? cat.short : b.cat}] (${b.name})</option>`;
    }).join('');
  }

  modal.classList.add('open');
}

function submitTransferForm(e) {
  e.preventDefault();
  const sourceId = document.getElementById('transferSourceBedId').value;
  const targetId = document.getElementById('transferTargetBed').value;
  const reason = document.getElementById('transferReason').value.trim() || 'Clinical condition change / Ward transfer';

  const sourceBed = appState.beds.find(b => b.id === sourceId);
  const targetBed = appState.beds.find(b => b.id === targetId);

  if (!sourceBed || !targetBed || !sourceBed.patient) return;

  const patient = sourceBed.patient;
  const resources = sourceBed.resources || [];

  // Update target bed
  targetBed.status = 'occupied';
  targetBed.patient = patient;
  targetBed.resources = resources;

  // Set source bed to cleaning
  sourceBed.status = 'cleaning';
  sourceBed.patient = null;
  sourceBed.resources = [];
  sourceBed.cleaningMinutesLeft = 15;
  sourceBed.cleaningStartedAt = Date.now();

  logAuditEvent(
    'PATIENT_TRANSFER',
    'transfer',
    `${sourceBed.id} -> ${targetBed.id}`,
    targetBed.dept,
    targetBed.cat,
    `Transferred ${patient.name} (${patient.mrn}) from ${sourceBed.id} to ${targetBed.id}. Attending: ${patient.doc}.`,
    reason
  );

  playAudioChime('info');
  showToast(`Transferred ${patient.name} to ${targetBed.id}! Source bed queued for cleaning.`, 'success');
  closeAllModals();
  saveState();
  renderActiveView();
  renderAlertBanner();
}

// Manual Status Change Modal
function openStatusModal(bedId) {
  const bed = appState.beds.find(b => b.id === bedId);
  if (!bed) return;

  const modal = document.getElementById('statusModal');
  document.getElementById('statusBedId').value = bedId;
  document.getElementById('statusModalTitle').textContent = `Change Status for Bed ${bed.id}`;
  document.getElementById('statusSelect').value = bed.status;
  document.getElementById('statusReason').value = '';

  modal.classList.add('open');
}

function submitStatusForm(e) {
  e.preventDefault();
  const bedId = document.getElementById('statusBedId').value;
  const newStatus = document.getElementById('statusSelect').value;
  const reason = document.getElementById('statusReason').value.trim() || 'Manual status update';

  changeBedStatus(bedId, newStatus, reason);
  closeAllModals();
}

function changeBedStatus(bedId, newStatus, reason = 'Operator status override') {
  const bed = appState.beds.find(b => b.id === bedId);
  if (!bed) return;

  const oldStatus = bed.status;
  bed.status = newStatus;

  if (newStatus === 'available') {
    bed.patient = null;
    bed.cleaningMinutesLeft = 0;
    bed.cleaningStartedAt = null;
  } else if (newStatus === 'cleaning') {
    bed.cleaningMinutesLeft = 15;
    bed.cleaningStartedAt = Date.now();
  }

  logAuditEvent(
    'STATUS_CHANGE',
    'status',
    bed.id,
    bed.dept,
    bed.cat,
    `Status changed from ${oldStatus.toUpperCase()} to ${newStatus.toUpperCase()}`,
    reason
  );

  showToast(`Bed ${bed.id} updated to ${newStatus.toUpperCase()}`, 'info');
  saveState();
  renderActiveView();
  renderAlertBanner();
}

// Resource Allocation Modal for Bed
function openResourceModal(bedId) {
  const bed = appState.beds.find(b => b.id === bedId);
  if (!bed) return;

  const modal = document.getElementById('resourceModal');
  document.getElementById('resBedId').value = bedId;
  document.getElementById('resModalTitle').textContent = `Manage Equipment for Bed ${bed.id}`;

  const currentResources = bed.resources || [];
  const listContainer = document.getElementById('resModalChecklist');

  listContainer.innerHTML = Object.values(appState.resources).map(res => {
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

function submitResourceForm(e) {
  e.preventDefault();
  const bedId = document.getElementById('resBedId').value;
  const bed = appState.beds.find(b => b.id === bedId);
  if (!bed) return;

  const oldResources = bed.resources || [];
  const newResources = [];
  document.querySelectorAll('#resourceModal input[name="bedResources"]:checked').forEach(cb => {
    newResources.push(cb.value);
  });

  // Calculate changes and update catalog inventory
  newResources.forEach(resId => {
    if (!oldResources.includes(resId) && appState.resources[resId]) {
      appState.resources[resId].inUse++;
    }
  });

  oldResources.forEach(resId => {
    if (!newResources.includes(resId) && appState.resources[resId] && appState.resources[resId].inUse > 0) {
      appState.resources[resId].inUse--;
    }
  });

  bed.resources = newResources;

  logAuditEvent(
    'RESOURCE_ALLOCATION',
    'resource',
    bed.id,
    bed.dept,
    bed.cat,
    `Equipment updated: [${newResources.join(', ') || 'None'}]`,
    `Previous equipment: [${oldResources.join(', ') || 'None'}]`
  );

  showToast(`Equipment assigned to bed ${bed.id}`, 'success');
  closeAllModals();
  saveState();
  renderActiveView();
}

// Modals Management
function setupModals() {
  document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAllModals();
    });
  });

  document.getElementById('admitForm')?.addEventListener('submit', submitAdmitForm);
  document.getElementById('transferForm')?.addEventListener('submit', submitTransferForm);
  document.getElementById('statusForm')?.addEventListener('submit', submitStatusForm);
  document.getElementById('resourceForm')?.addEventListener('submit', submitResourceForm);
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.classList.remove('open');
  });
}

// Filters Management
function setupFilters() {
  const catFilter = document.getElementById('filterCategory');
  const statusFilter = document.getElementById('filterStatus');
  const searchInput = document.getElementById('filterSearch');
  const acuityFilter = document.getElementById('filterAcuity');

  if (catFilter) {
    catFilter.addEventListener('change', (e) => {
      appState.filters.category = e.target.value;
      renderActiveView();
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      appState.filters.status = e.target.value;
      renderActiveView();
    });
  }

  if (acuityFilter) {
    acuityFilter.addEventListener('change', (e) => {
      appState.filters.acuity = e.target.value;
      renderActiveView();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      appState.filters.search = e.target.value.trim();
      renderActiveView();
    });
  }
}

function resetFilters() {
  appState.filters = { category: 'all', status: 'all', search: '', acuity: 'all' };
  appState.selectedDoctorFilter = null;

  const cat = document.getElementById('filterCategory');
  const stat = document.getElementById('filterStatus');
  const search = document.getElementById('filterSearch');
  const acuity = document.getElementById('filterAcuity');
  if (cat) cat.value = 'all';
  if (stat) stat.value = 'all';
  if (search) search.value = '';
  if (acuity) acuity.value = 'all';

  renderActiveView();
}

// Simulation Controls
function setupSimulation() {
  document.querySelectorAll('.sim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sim-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const speed = parseInt(btn.getAttribute('data-speed'), 10);
      appState.simulation.speed = speed;
      restartSimulationInterval();
      showToast(`Simulation clock adjusted to ${speed}x`, 'info');
    });
  });

  document.getElementById('simulateSurgeBtn')?.addEventListener('click', triggerEmergencySurge);
  document.getElementById('simulateDischargeBtn')?.addEventListener('click', () => dischargeRecoveredPatients());
  document.getElementById('simulateCleanBtn')?.addEventListener('click', () => completeAllSanitization());
}

function startSimulationTicker() {
  restartSimulationInterval();
}

function restartSimulationInterval() {
  if (appState.simulation.intervalId) {
    clearInterval(appState.simulation.intervalId);
  }

  const baseInterval = 10000;
  const intervalMs = Math.max(1000, baseInterval / appState.simulation.speed);

  appState.simulation.intervalId = setInterval(simulationTick, intervalMs);
}

// Only one browser tab (across all users) may drive the demo simulation at a time.
let _leaderUntil = 0, _followerUntil = 0;
async function isSimulationLeader() {
  const now = Date.now();
  if (now < _leaderUntil) return true;
  if (now < _followerUntil) return false;
  try {
    const r = await api('/api/sim/lease', { method: 'POST', body: { client: CLIENT_ID } });
    if (r.ok && r.data.leader) { _leaderUntil = now + 15000; return true; }
  } catch (e) { /* offline: don't tick */ }
  _followerUntil = now + 8000;
  return false;
}

async function simulationTick() {
  if (_saveInFlight || _stateDirty) return;
  if (!(await isSimulationLeader())) return;
  applySimulationTick();
}

// Simulation Tick: counts down cleaning timers
function applySimulationTick() {
  let stateModified = false;

  appState.beds.forEach(bed => {
    if (bed.status === 'cleaning' && bed.cleaningMinutesLeft > 0) {
      bed.cleaningMinutesLeft -= 1 * appState.simulation.speed;
      if (bed.cleaningMinutesLeft <= 0) {
        bed.cleaningMinutesLeft = 0;
        bed.status = 'available';
        bed.cleaningStartedAt = null;
        stateModified = true;
        logAuditEvent(
          'AUTO_CLEANING_CYCLE_COMPLETE',
          'status',
          bed.id,
          bed.dept,
          bed.cat,
          `Automated environmental cleaning and terminal disinfection verified. Bed ready.`,
          'Automated EVS cycle signed off'
        );
      }
    }
  });

  if (stateModified) {
    saveState();
    renderActiveView();
    renderSidebarStats();
    renderAlertBanner();
  }
}

// Trigger Emergency Surge Event
function triggerEmergencySurge() {
  const surgePatients = [
    { name: 'Marcus Vance', age: 29, mrn: 'MRN-' + Math.floor(1000 + Math.random() * 9000), acuity: 'critical', diagnosis: 'MVA Multiple Rib Fractures & Tension Pneumothorax', doc: 'Dr. David Chen, MD', docSpecialty: 'Emergency Critical Care', resources: ['ventilators', 'monitors'] },
    { name: 'Diana Prince', age: 34, mrn: 'MRN-' + Math.floor(1000 + Math.random() * 9000), acuity: 'urgent', diagnosis: 'Blunt Abdominal Trauma / Splenic Lac', doc: 'Dr. Sarah Jenkins, MD', docSpecialty: 'Lead Trauma & Resuscitation', resources: ['monitors', 'infusion_pumps'] },
    { name: 'Lucas Scott', age: 52, mrn: 'MRN-' + Math.floor(1000 + Math.random() * 9000), acuity: 'critical', diagnosis: 'Traumatic Brain Injury Subdural', doc: 'Dr. Priya Sharma, MD', docSpecialty: 'Trauma Surgery', resources: ['ventilators', 'monitors'] }
  ];

  let assignedCount = 0;
  const now = Date.now();

  surgePatients.forEach(p => {
    let target = appState.beds.find(b => b.dept === 'ED' && b.status === 'available') ||
                 appState.beds.find(b => b.cat === 'icu' && b.status === 'available');

    if (target) {
      target.status = 'occupied';
      target.patient = {
        ...p,
        admittedTimestamp: now,
        admittedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (Today)',
        recovered: false
      };
      target.resources = p.resources;
      p.resources.forEach(r => {
        if (appState.resources[r]) appState.resources[r].inUse++;
      });
      assignedCount++;
    }
  });

  logAuditEvent(
    'EMERGENCY_SURGE_CODE_AMBER',
    'surge',
    'ED / TRAUMA',
    'ED',
    'emergency',
    `Code Amber: Mass Casualty Influx. ${surgePatients.length} acute patients admitted, ${assignedCount} beds rapidly allocated.`,
    'Triage protocol activated'
  );

  playAudioChime('alert');
  showToast(`🚨 MASS CASUALTY SURGE: ${assignedCount} emergency beds allocated immediately!`, 'warning');
  saveState();
  renderActiveView();
  renderAlertBanner();
}

// Web Audio API Sound Chimes
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
  } catch (e) {
    // Graceful fallback for audio restrictions
  }
}

// Toast Notifications
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
  const iconEl = document.createElement('span');
  iconEl.style.fontWeight = '700';
  iconEl.textContent = icon;
  const msgEl = document.createElement('span');
  msgEl.textContent = message;          // text, not HTML: messages can contain patient-entered text
  toast.append(iconEl, document.createTextNode(' '), msgEl);
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Export Audit Logs to CSV
function exportAuditToCSV() {
  const logs = appState.auditLogs;
  if (!logs || logs.length === 0) {
    showToast('No logs to export', 'info');
    return;
  }

  // Quote every cell; prefix risky leading characters so Excel/Sheets never run them as formulas
  const cell = (v) => {
    let t = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
    return '"' + t.replace(/"/g, '""') + '"';
  };

  const headers = ['Timestamp', 'Action', 'ActionType', 'BedID', 'Department', 'Category', 'Details', 'Staff', 'Notes'];
  const rows = logs.map(l => [l.timestamp, l.action, l.actionType, l.bedId, l.dept, l.cat, l.details, l.staff, l.notes].map(cell));
  const csv = [headers.map(cell).join(','), ...rows.map(r => r.join(','))].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `hospital_audit_log_${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  showToast('Audit log downloaded as CSV', 'success');
}

// Global initialization
document.addEventListener('DOMContentLoaded', initApp);
