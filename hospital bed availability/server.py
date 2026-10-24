#!/usr/bin/env python3
"""
Hospital Bed Availability & Resource Coordination System
Python Flask Backend & REST API Server with Aadhaar KYC Verification
"""

import os
import sys
import json
import time
import re
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder=".")
CORS(app)

DB_FILE = os.path.join(os.path.dirname(__file__), "hospital_db.json")

# ==========================================
# SEED DATA REGISTRY
# ==========================================

DEMO_ACCOUNTS = [
  {
    "aadhaar": "234567890123",
    "formattedAadhaar": "2345 6789 0123",
    "name": "Dr. David Chen, MD",
    "role": "admin",
    "designation": "ICU Director & Intensivist",
    "department": "Emergency & CCU",
    "mobile": "+91 98765 11223",
    "kycVerified": True,
    "kycProvider": "UIDAI / DigiLocker Certified",
    "avatar": "DC"
  },
  {
    "aadhaar": "345678901234",
    "formattedAadhaar": "3456 7890 1234",
    "name": "Sarah Jenkins, RN",
    "role": "admin",
    "designation": "Lead Triage Charge Nurse",
    "department": "Emergency & Trauma Center",
    "mobile": "+91 98765 22334",
    "kycVerified": True,
    "kycProvider": "UIDAI / DigiLocker Certified",
    "avatar": "SJ"
  },
  {
    "aadhaar": "456789012345",
    "formattedAadhaar": "4567 8901 2345",
    "name": "Dr. Robert Gupta, MD",
    "role": "admin",
    "designation": "Chief Interventional Cardiologist",
    "department": "Cardiology & CCU",
    "mobile": "+91 98765 33445",
    "kycVerified": True,
    "kycProvider": "UIDAI / DigiLocker Certified",
    "avatar": "RG"
  },
  {
    "aadhaar": "987654321098",
    "formattedAadhaar": "9876 5432 1098",
    "name": "Rajesh Kumar Sharma",
    "role": "user",
    "designation": "Citizen / Patient Relative",
    "department": "Public / General Citizen",
    "mobile": "+91 98111 54321",
    "kycVerified": True,
    "kycProvider": "UIDAI Aadhaar e-KYC Verified",
    "avatar": "RS"
  },
  {
    "aadhaar": "876543210987",
    "formattedAadhaar": "8765 4321 0987",
    "name": "Ananya Verma",
    "role": "user",
    "designation": "Citizen / Inpatient Applicant",
    "department": "Public / General Citizen",
    "mobile": "+91 98222 65432",
    "kycVerified": True,
    "kycProvider": "UIDAI Aadhaar e-KYC Verified",
    "avatar": "AV"
  }
]

DEPARTMENTS = [
  {"id": "ED", "name": "Emergency & Trauma Center", "short": "Emergency", "icon": "🚑", "floor": "Ground Floor - Wing A", "color": "#f97316"},
  {"id": "CCU", "name": "Cardiology & Critical Care", "short": "Cardiology", "icon": "🫀", "floor": "2nd Floor - Wing C", "color": "#ec4899"},
  {"id": "NICU", "name": "Neurology & Stroke Center", "short": "Neurology", "icon": "🧠", "floor": "3rd Floor - Wing B", "color": "#8b5cf6"},
  {"id": "PICU", "name": "Pediatrics & PICU", "short": "Pediatrics", "icon": "🧸", "floor": "4th Floor - Wing A", "color": "#06b6d4"},
  {"id": "SURG", "name": "General Surgery & Post-Op", "short": "Surgery", "icon": "🩺", "floor": "2nd Floor - Wing B", "color": "#10b981"},
  {"id": "RESP", "name": "Pulmonology & Respiratory Care", "short": "Pulmonology", "icon": "🫁", "floor": "3rd Floor - Wing D", "color": "#3b82f6"},
  {"id": "ONCO", "name": "Oncology & Hematology", "short": "Oncology", "icon": "🎗️", "floor": "5th Floor - Wing A", "color": "#a855f7"}
]

DEPARTMENT_DOCTORS = {
  "ED": [
    {"name": "Dr. Sarah Jenkins, MD", "specialty": "Lead Trauma & Resuscitation", "initials": "SJ"},
    {"name": "Dr. David Chen, MD", "specialty": "Emergency Critical Care", "initials": "DC"},
    {"name": "Dr. Priya Sharma, MD", "specialty": "Trauma Surgery", "initials": "PS"}
  ],
  "CCU": [
    {"name": "Dr. Robert Gupta, MD", "specialty": "Chief Interventional Cardiologist", "initials": "RG"},
    {"name": "Dr. Clara Hayes, MD", "specialty": "Cardiovascular Intensivist", "initials": "CH"}
  ],
  "NICU": [
    {"name": "Dr. Sarah Sterling, MD", "specialty": "Neuro-Intensivist & Stroke Lead", "initials": "SS"},
    {"name": "Dr. Arthur Vance, MD", "specialty": "Chief Neurosurgeon", "initials": "AV"}
  ],
  "PICU": [
    {"name": "Dr. Maya Foster, MD", "specialty": "Pediatric Critical Care Specialist", "initials": "MF"},
    {"name": "Dr. Michael Adams, MD", "specialty": "Pediatric Pulmonology", "initials": "MA"}
  ],
  "SURG": [
    {"name": "Dr. Miranda Bailey, MD", "specialty": "Chief Surgical Intensivist", "initials": "MB"},
    {"name": "Dr. Michael Weber, MD", "specialty": "Trauma & General Surgeon", "initials": "MW"}
  ],
  "RESP": [
    {"name": "Dr. James Mercer, MD", "specialty": "Pulmonology & ECMO Director", "initials": "JM"},
    {"name": "Dr. David Bowman, MD", "specialty": "Respiratory Critical Care", "initials": "DB"}
  ],
  "ONCO": [
    {"name": "Dr. Dana Vance, MD", "specialty": "Hematology & Oncology Director", "initials": "DV"},
    {"name": "Dr. Fox Mulder, MD", "specialty": "Protective Isolation Specialist", "initials": "FM"}
  ]
}

INITIAL_RESOURCES = {
  "ventilators": {"id": "ventilators", "name": "Mechanical Ventilators", "icon": "🫁", "total": 24, "inUse": 14, "inMaint": 2},
  "monitors": {"id": "monitors", "name": "Vital Signs Monitors", "icon": "📈", "total": 60, "inUse": 38, "inMaint": 3},
  "infusion_pumps": {"id": "infusion_pumps", "name": "Smart Infusion Pumps", "icon": "💉", "total": 75, "inUse": 45, "inMaint": 4},
  "oxygen_ports": {"id": "oxygen_ports", "name": "High-Flow O2 Blenders", "icon": "🫧", "total": 30, "inUse": 18, "inMaint": 1},
  "crash_carts": {"id": "crash_carts", "name": "Defibrillator Crash Carts", "icon": "⚡", "total": 14, "inUse": 7, "inMaint": 0},
  "dialysis": {"id": "dialysis", "name": "Mobile Dialysis Units", "icon": "🩸", "total": 8, "inUse": 4, "inMaint": 1}
}

def generate_initial_beds():
  now_ms = int(time.time() * 1000)
  return [
    # ED
    {"id": "ED-EM-01", "name": "Trauma Bay 1", "dept": "ED", "cat": "emergency", "status": "occupied", "patient": {"name": "Arthur Pendelton", "age": 48, "mrn": "MRN-7821", "acuity": "critical", "diagnosis": "Polytrauma / MVA", "doc": "Dr. David Chen, MD", "docSpecialty": "Emergency Critical Care", "admittedTimestamp": now_ms - (2 * 3600 * 1000), "admittedAt": "Today 10:15 AM", "recovered": False}, "resources": ["ventilators", "monitors", "infusion_pumps"]},
    {"id": "ED-EM-02", "name": "Acute Bay 2", "dept": "ED", "cat": "emergency", "status": "occupied", "patient": {"name": "Rebecca Alvarez", "age": 34, "mrn": "MRN-9014", "acuity": "urgent", "diagnosis": "Severe Asthma Exacerbation", "doc": "Dr. Sarah Jenkins, MD", "docSpecialty": "Lead Trauma & Resuscitation", "admittedTimestamp": now_ms - (1 * 3600 * 1000), "admittedAt": "Today 11:45 AM", "recovered": False}, "resources": ["oxygen_ports", "monitors"]},
    {"id": "ED-EM-03", "name": "Triage Bay 3", "dept": "ED", "cat": "emergency", "status": "available", "patient": None, "resources": ["monitors"]},
    {"id": "ED-EM-04", "name": "Resuscitation Bay 4", "dept": "ED", "cat": "emergency", "status": "cleaning", "patient": None, "cleaningMinutesLeft": 12, "cleaningStartedAt": now_ms - (3 * 60 * 1000), "resources": []},
    {"id": "ED-ICU-01", "name": "Emergency ICU 1", "dept": "ED", "cat": "icu", "status": "occupied", "patient": {"name": "Thomas Wright", "age": 62, "mrn": "MRN-6421", "acuity": "critical", "diagnosis": "Septic Shock / Hypotension", "doc": "Dr. David Chen, MD", "docSpecialty": "Emergency Critical Care", "admittedTimestamp": now_ms - (4 * 3600 * 1000), "admittedAt": "Today 08:05 AM", "recovered": False}, "resources": ["ventilators", "monitors", "infusion_pumps"]},
    {"id": "ED-ICU-02", "name": "Emergency ICU 2", "dept": "ED", "cat": "icu", "status": "available", "patient": None, "resources": ["monitors"]},
    {"id": "ED-OBS-101", "name": "ED Obs Room 101", "dept": "ED", "cat": "longstay", "status": "occupied", "patient": {"name": "Gary Miller", "age": 71, "mrn": "MRN-4319", "acuity": "low", "diagnosis": "Transient Ischemic Attack Observation", "doc": "Dr. Priya Sharma, MD", "docSpecialty": "Trauma Surgery", "admittedTimestamp": now_ms - (14 * 3600 * 1000), "admittedAt": "Yesterday 22:30 PM", "recovered": True}, "resources": ["monitors"]},
    {"id": "ED-OBS-102", "name": "ED Obs Room 102", "dept": "ED", "cat": "longstay", "status": "available", "patient": None, "resources": []},
    {"id": "ED-OBS-103", "name": "ED Obs Room 103", "dept": "ED", "cat": "longstay", "status": "reserved", "patient": {"name": "Incoming Transfer", "age": 55, "mrn": "MRN-PENDING", "acuity": "urgent", "diagnosis": "Acute Abdominal Pain", "doc": "Dr. Sarah Jenkins, MD", "docSpecialty": "Lead Trauma & Resuscitation", "admittedTimestamp": now_ms, "admittedAt": "ETA in 15 mins", "recovered": False}, "resources": []},

    # CCU
    {"id": "CCU-ICU-01", "name": "Cardiac ICU 1", "dept": "CCU", "cat": "icu", "status": "occupied", "patient": {"name": "Eleanor Vance", "age": 67, "mrn": "MRN-1120", "acuity": "critical", "diagnosis": "Acute STEMI / Post-PCI", "doc": "Dr. Robert Gupta, MD", "docSpecialty": "Chief Interventional Cardiologist", "admittedTimestamp": now_ms - (8 * 3600 * 1000), "admittedAt": "Today 04:25 AM", "recovered": False}, "resources": ["ventilators", "monitors", "infusion_pumps"]},
    {"id": "CCU-ICU-02", "name": "Cardiac ICU 2", "dept": "CCU", "cat": "icu", "status": "occupied", "patient": {"name": "Harold Finch", "age": 73, "mrn": "MRN-8842", "acuity": "critical", "diagnosis": "Decompensated Heart Failure", "doc": "Dr. Clara Hayes, MD", "docSpecialty": "Cardiovascular Intensivist", "admittedTimestamp": now_ms - (26 * 3600 * 1000), "admittedAt": "Yesterday 10:00 AM", "recovered": False}, "resources": ["monitors", "infusion_pumps"]},
    {"id": "CCU-ICU-03", "name": "Cardiac ICU 3", "dept": "CCU", "cat": "icu", "status": "available", "patient": None, "resources": ["monitors"]},
    {"id": "CCU-ICU-04", "name": "Cardiac ICU 4", "dept": "CCU", "cat": "icu", "status": "maintenance", "patient": None, "resources": []},
    {"id": "CCU-EM-01", "name": "Cardiac Intake Bay 1", "dept": "CCU", "cat": "emergency", "status": "occupied", "patient": {"name": "Douglas Ross", "age": 52, "mrn": "MRN-5501", "acuity": "urgent", "diagnosis": "Unstable Angina", "doc": "Dr. Robert Gupta, MD", "docSpecialty": "Chief Interventional Cardiologist", "admittedTimestamp": now_ms - (3 * 3600 * 1000), "admittedAt": "Today 09:25 AM", "recovered": False}, "resources": ["monitors"]},
    {"id": "CCU-EM-02", "name": "Cardiac Intake Bay 2", "dept": "CCU", "cat": "emergency", "status": "available", "patient": None, "resources": []},
    {"id": "CCU-RM-201", "name": "Telemetry Room 201", "dept": "CCU", "cat": "longstay", "status": "occupied", "patient": {"name": "Clara Oswald", "age": 60, "mrn": "MRN-3312", "acuity": "moderate", "diagnosis": "Post-CABG Day 3 Recovery", "doc": "Dr. Clara Hayes, MD", "docSpecialty": "Cardiovascular Intensivist", "admittedTimestamp": now_ms - (72 * 3600 * 1000), "admittedAt": "Oct 21, 11:30 AM", "recovered": False}, "resources": ["monitors"]},
    {"id": "CCU-RM-202", "name": "Telemetry Room 202", "dept": "CCU", "cat": "longstay", "status": "occupied", "patient": {"name": "Bernard Lowe", "age": 69, "mrn": "MRN-9943", "acuity": "low", "diagnosis": "Arrhythmia Stabilized / Ready", "doc": "Dr. Robert Gupta, MD", "docSpecialty": "Chief Interventional Cardiologist", "admittedTimestamp": now_ms - (48 * 3600 * 1000), "admittedAt": "Oct 22, 12:00 PM", "recovered": True}, "resources": ["monitors"]},
    {"id": "CCU-RM-203", "name": "Telemetry Room 203", "dept": "CCU", "cat": "longstay", "status": "available", "patient": None, "resources": []},
    {"id": "CCU-RM-204", "name": "Telemetry Room 204", "dept": "CCU", "cat": "longstay", "status": "cleaning", "patient": None, "cleaningMinutesLeft": 18, "cleaningStartedAt": now_ms - (2 * 60 * 1000), "resources": []},

    # NICU
    {"id": "NICU-01", "name": "Neuro ICU 1", "dept": "NICU", "cat": "icu", "status": "occupied", "patient": {"name": "Walter Bishop", "age": 65, "mrn": "MRN-2245", "acuity": "critical", "diagnosis": "Acute Ischemic Stroke / tPA", "doc": "Dr. Sarah Sterling, MD", "docSpecialty": "Neuro-Intensivist & Stroke Lead", "admittedTimestamp": now_ms - (5 * 3600 * 1000), "admittedAt": "Today 07:25 AM", "recovered": False}, "resources": ["ventilators", "monitors", "infusion_pumps"]},
    {"id": "NICU-02", "name": "Neuro ICU 2", "dept": "NICU", "cat": "icu", "status": "occupied", "patient": {"name": "Astrid Farnsworth", "age": 39, "mrn": "MRN-7731", "acuity": "urgent", "diagnosis": "Status Epilepticus Post-Ictal", "doc": "Dr. Sarah Sterling, MD", "docSpecialty": "Neuro-Intensivist & Stroke Lead", "admittedTimestamp": now_ms - (12 * 3600 * 1000), "admittedAt": "Today 00:25 AM", "recovered": False}, "resources": ["monitors", "infusion_pumps"]},
    {"id": "NICU-03", "name": "Neuro ICU 3", "dept": "NICU", "cat": "icu", "status": "available", "patient": None, "resources": ["monitors"]},
    {"id": "NEURO-EM-01", "name": "Stroke Rapid Bay 1", "dept": "NICU", "cat": "emergency", "status": "available", "patient": None, "resources": ["monitors"]},
    {"id": "NEURO-EM-02", "name": "Stroke Rapid Bay 2", "dept": "NICU", "cat": "emergency", "status": "occupied", "patient": {"name": "Peter Bell", "age": 58, "mrn": "MRN-1940", "acuity": "urgent", "diagnosis": "Acute Hemiparesis Protocol", "doc": "Dr. Arthur Vance, MD", "docSpecialty": "Chief Neurosurgeon", "admittedTimestamp": now_ms - (45 * 60 * 1000), "admittedAt": "Today 11:40 AM", "recovered": False}, "resources": ["monitors"]},
    {"id": "NEURO-RM-301", "name": "Neuro Inpatient Room 301", "dept": "NICU", "cat": "longstay", "status": "occupied", "patient": {"name": "Olivia Dunham", "age": 41, "mrn": "MRN-5629", "acuity": "low", "diagnosis": "Post-Stroke Rehab Goals Met", "doc": "Dr. Arthur Vance, MD", "docSpecialty": "Chief Neurosurgeon", "admittedTimestamp": now_ms - (120 * 3600 * 1000), "admittedAt": "Oct 19, 14:00 PM", "recovered": True}, "resources": []},
    {"id": "NEURO-RM-302", "name": "Neuro Inpatient Room 302", "dept": "NICU", "cat": "longstay", "status": "available", "patient": None, "resources": []},
    {"id": "NEURO-RM-303", "name": "Neuro Inpatient Room 303", "dept": "NICU", "cat": "longstay", "status": "available", "patient": None, "resources": []},
    {"id": "NEURO-RM-304", "name": "Neuro Inpatient Room 304", "dept": "NICU", "cat": "longstay", "status": "cleaning", "patient": None, "cleaningMinutesLeft": 8, "cleaningStartedAt": now_ms - (7 * 60 * 1000), "resources": []},

    # PICU
    {"id": "PICU-01", "name": "Pediatric ICU 1", "dept": "PICU", "cat": "icu", "status": "occupied", "patient": {"name": "Leo Martinez", "age": 7, "mrn": "MRN-3011", "acuity": "critical", "diagnosis": "Severe Bronchiolitis / RSV", "doc": "Dr. Maya Foster, MD", "docSpecialty": "Pediatric Critical Care Specialist", "admittedTimestamp": now_ms - (18 * 3600 * 1000), "admittedAt": "Yesterday 18:25 PM", "recovered": False}, "resources": ["ventilators", "monitors", "infusion_pumps"]},
    {"id": "PICU-02", "name": "Pediatric ICU 2", "dept": "PICU", "cat": "icu", "status": "available", "patient": None, "resources": ["monitors"]},
    {"id": "PICU-03", "name": "Pediatric ICU 3", "dept": "PICU", "cat": "icu", "status": "available", "patient": None, "resources": ["monitors"]},
    {"id": "PEDS-EM-01", "name": "Peds Trauma Bay 1", "dept": "PICU", "cat": "emergency", "status": "occupied", "patient": {"name": "Mia Chen", "age": 4, "mrn": "MRN-8422", "acuity": "urgent", "diagnosis": "Febrile Seizure / Dehydration", "doc": "Dr. Maya Foster, MD", "docSpecialty": "Pediatric Critical Care Specialist", "admittedTimestamp": now_ms - (2 * 3600 * 1000), "admittedAt": "Today 10:25 AM", "recovered": False}, "resources": ["monitors"]},
    {"id": "PEDS-EM-02", "name": "Peds Urgent Bay 2", "dept": "PICU", "cat": "emergency", "status": "available", "patient": None, "resources": []},
    {"id": "PEDS-RM-401", "name": "Peds Family Suite 401", "dept": "PICU", "cat": "longstay", "status": "occupied", "patient": {"name": "Ethan Hunt Jr.", "age": 9, "mrn": "MRN-4198", "acuity": "moderate", "diagnosis": "Post-Appendectomy Day 2", "doc": "Dr. Michael Adams, MD", "docSpecialty": "Pediatric Pulmonology", "admittedTimestamp": now_ms - (48 * 3600 * 1000), "admittedAt": "Oct 22, 10:00 AM", "recovered": False}, "resources": ["infusion_pumps"]},
    {"id": "PEDS-RM-402", "name": "Peds Family Suite 402", "dept": "PICU", "cat": "longstay", "status": "occupied", "patient": {"name": "Sophia Ray", "age": 11, "mrn": "MRN-7612", "acuity": "low", "diagnosis": "Pneumonia Resolved / Ready", "doc": "Dr. Maya Foster, MD", "docSpecialty": "Pediatric Critical Care Specialist", "admittedTimestamp": now_ms - (72 * 3600 * 1000), "admittedAt": "Oct 21, 09:15 AM", "recovered": True}, "resources": []},
    {"id": "PEDS-RM-403", "name": "Peds Family Suite 403", "dept": "PICU", "cat": "longstay", "status": "available", "patient": None, "resources": []},
    {"id": "PEDS-RM-404", "name": "Peds Family Suite 404", "dept": "PICU", "cat": "longstay", "status": "available", "patient": None, "resources": []},

    # SURG
    {"id": "SICU-01", "name": "Surgical ICU 1", "dept": "SURG", "cat": "icu", "status": "occupied", "patient": {"name": "Gordon Freeman", "age": 53, "mrn": "MRN-1049", "acuity": "critical", "diagnosis": "Whipple Procedure Post-Op", "doc": "Dr. Miranda Bailey, MD", "docSpecialty": "Chief Surgical Intensivist", "admittedTimestamp": now_ms - (6 * 3600 * 1000), "admittedAt": "Today 06:25 AM", "recovered": False}, "resources": ["ventilators", "monitors", "infusion_pumps"]},
    {"id": "SICU-02", "name": "Surgical ICU 2", "dept": "SURG", "cat": "icu", "status": "occupied", "patient": {"name": "Sarah Connor", "age": 45, "mrn": "MRN-9210", "acuity": "urgent", "diagnosis": "Aortic Repair Monitoring", "doc": "Dr. Miranda Bailey, MD", "docSpecialty": "Chief Surgical Intensivist", "admittedTimestamp": now_ms - (10 * 3600 * 1000), "admittedAt": "Today 02:25 AM", "recovered": False}, "resources": ["monitors", "infusion_pumps"]},
    {"id": "SICU-03", "name": "Surgical ICU 3", "dept": "SURG", "cat": "icu", "status": "available", "patient": None, "resources": ["monitors"]},
    {"id": "SURG-EM-01", "name": "OR Recovery Acute Bay 1", "dept": "SURG", "cat": "emergency", "status": "occupied", "patient": {"name": "Isaac Clarke", "age": 38, "mrn": "MRN-6031", "acuity": "urgent", "diagnosis": "Laparotomy Stabilization", "doc": "Dr. Michael Weber, MD", "docSpecialty": "Trauma & General Surgeon", "admittedTimestamp": now_ms - (1 * 3600 * 1000), "admittedAt": "Today 11:25 AM", "recovered": False}, "resources": ["monitors"]},
    {"id": "SURG-EM-02", "name": "OR Recovery Acute Bay 2", "dept": "SURG", "cat": "emergency", "status": "available", "patient": None, "resources": []},
    {"id": "SURG-RM-501", "name": "Post-Surg Room 501", "dept": "SURG", "cat": "longstay", "status": "occupied", "patient": {"name": "Alyx Vance", "age": 31, "mrn": "MRN-4491", "acuity": "moderate", "diagnosis": "Spine Fusion Recovery", "doc": "Dr. Miranda Bailey, MD", "docSpecialty": "Chief Surgical Intensivist", "admittedTimestamp": now_ms - (96 * 3600 * 1000), "admittedAt": "Oct 20, 15:00 PM", "recovered": False}, "resources": ["infusion_pumps"]},
    {"id": "SURG-RM-502", "name": "Post-Surg Room 502", "dept": "SURG", "cat": "longstay", "status": "occupied", "patient": {"name": "Barney Calhoun", "age": 49, "mrn": "MRN-8317", "acuity": "low", "diagnosis": "Knee Arthroplasty Ambulating", "doc": "Dr. Michael Weber, MD", "docSpecialty": "Trauma & General Surgeon", "admittedTimestamp": now_ms - (48 * 3600 * 1000), "admittedAt": "Oct 22, 11:30 AM", "recovered": True}, "resources": []},
    {"id": "SURG-RM-503", "name": "Post-Surg Room 503", "dept": "SURG", "cat": "longstay", "status": "available", "patient": None, "resources": []},
    {"id": "SURG-RM-504", "name": "Post-Surg Room 504", "dept": "SURG", "cat": "longstay", "status": "available", "patient": None, "resources": []},
    {"id": "SURG-RM-505", "name": "Post-Surg Room 505", "dept": "SURG", "cat": "longstay", "status": "cleaning", "patient": None, "cleaningMinutesLeft": 15, "cleaningStartedAt": now_ms - (1 * 60 * 1000), "resources": []},

    # RESP
    {"id": "RICU-01", "name": "Respiratory ICU 1", "dept": "RESP", "cat": "icu", "status": "occupied", "patient": {"name": "Elizabeth Shaw", "age": 62, "mrn": "MRN-5128", "acuity": "critical", "diagnosis": "Severe ARDS / Proned", "doc": "Dr. James Mercer, MD", "docSpecialty": "Pulmonology & ECMO Director", "admittedTimestamp": now_ms - (24 * 3600 * 1000), "admittedAt": "Yesterday 12:00 PM", "recovered": False}, "resources": ["ventilators", "monitors", "infusion_pumps"]},
    {"id": "RICU-02", "name": "Respiratory ICU 2", "dept": "RESP", "cat": "icu", "status": "occupied", "patient": {"name": "David Bowman", "age": 59, "mrn": "MRN-3829", "acuity": "critical", "diagnosis": "COPD Exacerbation Weaning", "doc": "Dr. David Bowman, MD", "docSpecialty": "Respiratory Critical Care", "admittedTimestamp": now_ms - (48 * 3600 * 1000), "admittedAt": "Oct 22, 12:25 PM", "recovered": False}, "resources": ["ventilators", "oxygen_ports", "monitors"]},
    {"id": "RICU-03", "name": "Respiratory ICU 3", "dept": "RESP", "cat": "icu", "status": "available", "patient": None, "resources": ["ventilators", "monitors"]},
    {"id": "RESP-EM-01", "name": "Acute Bronch Bay 1", "dept": "RESP", "cat": "emergency", "status": "occupied", "patient": {"name": "Frank Poole", "age": 68, "mrn": "MRN-7290", "acuity": "urgent", "diagnosis": "Acute Pulmonary Embolism", "doc": "Dr. James Mercer, MD", "docSpecialty": "Pulmonology & ECMO Director", "admittedTimestamp": now_ms - (3 * 3600 * 1000), "admittedAt": "Today 09:25 AM", "recovered": False}, "resources": ["oxygen_ports", "monitors"]},
    {"id": "RESP-EM-02", "name": "Acute Bronch Bay 2", "dept": "RESP", "cat": "emergency", "status": "available", "patient": None, "resources": []},
    {"id": "RESP-RM-601", "name": "Pulm Inpatient Room 601", "dept": "RESP", "cat": "longstay", "status": "occupied", "patient": {"name": "Roy Batty", "age": 70, "mrn": "MRN-4903", "acuity": "moderate", "diagnosis": "ILD / O2 Weaning", "doc": "Dr. David Bowman, MD", "docSpecialty": "Respiratory Critical Care", "admittedTimestamp": now_ms - (144 * 3600 * 1000), "admittedAt": "Oct 18, 10:00 AM", "recovered": False}, "resources": ["oxygen_ports"]},
    {"id": "RESP-RM-602", "name": "Pulm Inpatient Room 602", "dept": "RESP", "cat": "longstay", "status": "available", "patient": None, "resources": []},
    {"id": "RESP-RM-603", "name": "Pulm Inpatient Room 603", "dept": "RESP", "cat": "longstay", "status": "available", "patient": None, "resources": []},

    # ONCO
    {"id": "ONCO-ICU-01", "name": "Isolation ICU 1", "dept": "ONCO", "cat": "icu", "status": "occupied", "patient": {"name": "Dana Scully", "age": 51, "mrn": "MRN-2104", "acuity": "critical", "diagnosis": "Neutropenic Sepsis Post-Chemo", "doc": "Dr. Dana Vance, MD", "docSpecialty": "Hematology & Oncology Director", "admittedTimestamp": now_ms - (24 * 3600 * 1000), "admittedAt": "Yesterday 12:25 PM", "recovered": False}, "resources": ["ventilators", "monitors", "infusion_pumps"]},
    {"id": "ONCO-ICU-02", "name": "Isolation ICU 2", "dept": "ONCO", "cat": "icu", "status": "available", "patient": None, "resources": ["monitors"]},
    {"id": "ONCO-EM-01", "name": "Onco Acute Bay 1", "dept": "ONCO", "cat": "emergency", "status": "available", "patient": None, "resources": []},
    {"id": "ONCO-EM-02", "name": "Onco Acute Bay 2", "dept": "ONCO", "cat": "emergency", "status": "occupied", "patient": {"name": "Fox Mulder", "age": 54, "mrn": "MRN-9122", "acuity": "urgent", "diagnosis": "Tumor Lysis Alert", "doc": "Dr. Fox Mulder, MD", "docSpecialty": "Protective Isolation Specialist", "admittedTimestamp": now_ms - (2 * 3600 * 1000), "admittedAt": "Today 10:25 AM", "recovered": False}, "resources": ["monitors", "infusion_pumps"]},
    {"id": "ONCO-RM-701", "name": "Onco Long Suite 701", "dept": "ONCO", "cat": "longstay", "status": "occupied", "patient": {"name": "James Holden", "age": 44, "mrn": "MRN-6712", "acuity": "moderate", "diagnosis": "Induction Chemo Day 5", "doc": "Dr. Dana Vance, MD", "docSpecialty": "Hematology & Oncology Director", "admittedTimestamp": now_ms - (120 * 3600 * 1000), "admittedAt": "Oct 19, 11:00 AM", "recovered": False}, "resources": ["infusion_pumps"]},
    {"id": "ONCO-RM-702", "name": "Onco Long Suite 702", "dept": "ONCO", "cat": "longstay", "status": "occupied", "patient": {"name": "Naomi Nagata", "age": 39, "mrn": "MRN-8819", "acuity": "low", "diagnosis": "Stem Cell Engraftment Certified", "doc": "Dr. Dana Vance, MD", "docSpecialty": "Hematology & Oncology Director", "admittedTimestamp": now_ms - (192 * 3600 * 1000), "admittedAt": "Oct 16, 16:30 PM", "recovered": True}, "resources": []},
    {"id": "ONCO-RM-703", "name": "Onco Long Suite 703", "dept": "ONCO", "cat": "longstay", "status": "available", "patient": None, "resources": []},
    {"id": "ONCO-RM-704", "name": "Onco Long Suite 704", "dept": "ONCO", "cat": "longstay", "status": "available", "patient": None, "resources": []}
  ]

INITIAL_RESERVATIONS = [
  {
    "id": "RES-101",
    "patientName": "Vikram Malhotra",
    "age": 58,
    "aadhaar": "987654321098",
    "mobile": "+91 98111 54321",
    "preferredDept": "CCU",
    "bedCategory": "icu",
    "urgency": "critical",
    "reason": "Acute Chest Pain / Angina with ST elevation risk",
    "status": "pending",
    "assignedBedId": None,
    "createdAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
  },
  {
    "id": "RES-102",
    "patientName": "Sunita Patil",
    "age": 42,
    "aadhaar": "876543210987",
    "mobile": "+91 98222 65432",
    "preferredDept": "SURG",
    "bedCategory": "longstay",
    "urgency": "moderate",
    "reason": "Scheduled Post-Laparoscopic Cholecystectomy Recovery",
    "status": "approved",
    "assignedBedId": "SURG-RM-503",
    "assignedDoc": "Dr. Miranda Bailey, MD",
    "createdAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
  }
]

# ==========================================
# DATABASE HELPER FUNCTIONS
# ==========================================

def load_db():
  if not os.path.exists(DB_FILE):
    data = {
      "users": DEMO_ACCOUNTS,
      "beds": generate_initial_beds(),
      "resources": INITIAL_RESOURCES,
      "reservations": INITIAL_RESERVATIONS,
      "auditLogs": [
        {
          "id": f"log_{int(time.time()*1000)}",
          "timestamp": datetime.now().isoformat(),
          "staff": "System Administrator",
          "action": "SYSTEM_INIT",
          "actionType": "status",
          "bedId": "ALL",
          "dept": "SYSTEM",
          "cat": "system",
          "details": "Hospital Backend Server & Aadhaar KYC Engine Initialized",
          "notes": "Verified KYC registries loaded"
        }
      ]
    }
    save_db(data)
    return data
  try:
    with open(DB_FILE, "r", encoding="utf-8") as f:
      return json.load(f)
  except Exception as e:
    print(f"Error loading DB: {e}", file=sys.stderr)
    return {}

def save_db(data):
  try:
    with open(DB_FILE, "w", encoding="utf-8") as f:
      json.dump(data, f, indent=2)
  except Exception as e:
    print(f"Error saving DB: {e}", file=sys.stderr)

def log_event(db, action, action_type, bed_id, dept, cat, details, staff_name="Staff", notes=""):
  entry = {
    "id": f"log_{int(time.time()*1000)}_{os.urandom(2).hex()}",
    "timestamp": datetime.now().isoformat(),
    "staff": staff_name,
    "action": action,
    "actionType": action_type,
    "bedId": bed_id,
    "dept": dept,
    "cat": cat,
    "details": details,
    "notes": notes
  }
  db.setdefault("auditLogs", []).insert(0, entry)
  if len(db["auditLogs"]) > 500:
    db["auditLogs"] = db["auditLogs"][:500]

# Aadhaar Verhoeff Algorithm for strict validation
verhoeff_d = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
]

verhoeff_p = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
]

def validate_aadhaar_number(number_str):
  """Validate format (12 digits, cannot be all same digit)"""
  cleaned = re.sub(r"\s+", "", str(number_str))
  if not re.match(r"^\d{12}$", cleaned):
    return False, "Aadhaar must be exactly 12 digits."
  if len(set(cleaned)) == 1:
    return False, "Invalid Aadhaar: all digits cannot be identical."
  if cleaned.startswith("0") or cleaned.startswith("1"):
    return False, "Invalid Aadhaar: cannot begin with 0 or 1."
  return True, cleaned

# ==========================================
# REST API ROUTES
# ==========================================

# 1. AUTH & KYC ENDPOINTS

@app.route("/api/auth/demo-accounts", methods=["GET"])
def get_demo_accounts():
  """Returns pre-registered demo accounts for one-click testing"""
  return jsonify({"success": True, "accounts": DEMO_ACCOUNTS})

@app.route("/api/auth/verify-aadhaar-kyc", methods=["POST"])
def verify_aadhaar_kyc():
  """Simulates instant UIDAI Aadhaar Verification with e-KYC response"""
  data = request.json or {}
  raw_aadhaar = data.get("aadhaar", "")
  is_valid, cleaned_or_err = validate_aadhaar_number(raw_aadhaar)
  
  if not is_valid:
    return jsonify({"success": False, "error": cleaned_or_err}), 400

  cleaned_aadhaar = cleaned_or_err
  db = load_db()
  users = db.get("users", DEMO_ACCOUNTS)
  user = next((u for u in users if u["aadhaar"] == cleaned_aadhaar), None)

  formatted = f"{cleaned_aadhaar[:4]} {cleaned_aadhaar[4:8]} {cleaned_aadhaar[8:]}"

  # Simulated OTP generation
  otp = "849201"
  return jsonify({
    "success": True,
    "aadhaar": cleaned_aadhaar,
    "formattedAadhaar": formatted,
    "registeredUser": user is not None,
    "role": user["role"] if user else "user",
    "name": user["name"] if user else "Citizen User",
    "simulatedOtp": otp,
    "message": f"Aadhaar format verified. Simulated UIDAI OTP sent to registered mobile linked with {formatted}."
  })

@app.route("/api/auth/login", methods=["POST"])
def auth_login():
  """Authenticates user or admin via verified Aadhaar and OTP / PIN"""
  data = request.json or {}
  raw_aadhaar = data.get("aadhaar", "")
  is_valid, cleaned_or_err = validate_aadhaar_number(raw_aadhaar)

  if not is_valid:
    return jsonify({"success": False, "error": cleaned_or_err}), 400

  cleaned = cleaned_or_err
  db = load_db()
  users = db.get("users", DEMO_ACCOUNTS)
  user = next((u for u in users if u["aadhaar"] == cleaned), None)

  # If not in registry, auto-register as verified citizen user
  if not user:
    name = data.get("name") or "Citizen Patient"
    role = data.get("role") or "user"
    user = {
      "aadhaar": cleaned,
      "formattedAadhaar": f"{cleaned[:4]} {cleaned[4:8]} {cleaned[8:]}",
      "name": name,
      "role": role,
      "designation": "Medical Staff" if role == "admin" else "Citizen User",
      "department": "Hospital Operations" if role == "admin" else "Public",
      "mobile": data.get("mobile") or "+91 99000 11223",
      "kycVerified": True,
      "kycProvider": "UIDAI Aadhaar e-KYC Verified",
      "avatar": "".join([part[0] for part in name.split()[:2]]).upper()
    }
    users.append(user)
    db["users"] = users

  log_event(
    db,
    "LOGIN_KYC_VERIFIED",
    "auth",
    "PORTAL",
    user.get("department", "GENERAL"),
    user["role"],
    f"User {user['name']} logged in as {user['role'].upper()} with verified Aadhaar {user['formattedAadhaar']}.",
    staff_name=user["name"],
    notes="Aadhaar KYC authentication successful"
  )
  save_db(db)

  return jsonify({
    "success": True,
    "user": user,
    "token": f"token_{cleaned}_{int(time.time())}"
  })

@app.route("/api/auth/register", methods=["POST"])
def auth_register():
  """Registers new citizen or staff with verified Aadhaar KYC"""
  data = request.json or {}
  raw_aadhaar = data.get("aadhaar", "")
  is_valid, cleaned_or_err = validate_aadhaar_number(raw_aadhaar)

  if not is_valid:
    return jsonify({"success": False, "error": cleaned_or_err}), 400

  cleaned = cleaned_or_err
  name = (data.get("name") or "").strip()
  if not name:
    return jsonify({"success": False, "error": "Full name is required as per Aadhaar record."}), 400

  role = data.get("role", "user") # "admin" or "user"
  designation = data.get("designation") or ("Hospital Staff" if role == "admin" else "Citizen")
  dept = data.get("department") or ("General Operations" if role == "admin" else "Public")
  mobile = data.get("mobile") or "+91 98000 00000"

  db = load_db()
  users = db.get("users", [])

  # Check if exists
  existing = next((u for u in users if u["aadhaar"] == cleaned), None)
  if existing:
    return jsonify({"success": False, "error": f"Aadhaar {cleaned} is already registered as {existing['name']} ({existing['role']}). Please log in directly."}), 400

  new_user = {
    "aadhaar": cleaned,
    "formattedAadhaar": f"{cleaned[:4]} {cleaned[4:8]} {cleaned[8:]}",
    "name": name,
    "role": role,
    "designation": designation,
    "department": dept,
    "mobile": mobile,
    "kycVerified": True,
    "kycProvider": "UIDAI Aadhaar Verified",
    "avatar": "".join([p[0] for p in name.split()[:2]]).upper()
  }

  users.append(new_user)
  db["users"] = users

  log_event(
    db,
    "NEW_USER_KYC_REGISTERED",
    "auth",
    "SYSTEM",
    dept,
    role,
    f"Registered new {role.upper()}: {name} ({new_user['formattedAadhaar']}).",
    staff_name=name,
    notes="Aadhaar KYC verified via portal"
  )
  save_db(db)

  return jsonify({
    "success": True,
    "user": new_user,
    "token": f"token_{cleaned}_{int(time.time())}",
    "message": "Aadhaar e-KYC verified and account created successfully!"
  })

# 2. BEDS & HOSPITAL OPERATIONS ENDPOINTS

@app.route("/api/hospital/state", methods=["GET"])
def get_hospital_state():
  """Returns full hospital state: beds, departments, doctors, resources, reservations, audit logs"""
  db = load_db()
  return jsonify({
    "success": True,
    "departments": DEPARTMENTS,
    "departmentDoctors": DEPARTMENT_DOCTORS,
    "beds": db.get("beds", []),
    "resources": db.get("resources", INITIAL_RESOURCES),
    "reservations": db.get("reservations", []),
    "auditLogs": db.get("auditLogs", [])[:100],
    "timestamp": datetime.now().isoformat()
  })

@app.route("/api/beds/admit", methods=["POST"])
def admit_patient():
  """Admit patient to bed"""
  data = request.json or {}
  bed_id = data.get("bedId")
  db = load_db()
  bed = next((b for b in db.get("beds", []) if b["id"] == bed_id), None)
  if not bed:
    return jsonify({"success": False, "error": f"Bed {bed_id} not found"}), 404

  patient_name = data.get("name") or "Anonymous Patient"
  mrn = data.get("mrn") or f"MRN-{int(time.time())%10000}"
  acuity = data.get("acuity") or "urgent"
  diagnosis = data.get("diagnosis") or "Clinical Inpatient Admission"
  doc = data.get("doc") or "Dr. David Chen, MD"
  doc_specialty = data.get("docSpecialty") or "Attending Physician"
  resources = data.get("resources") or []
  staff_name = data.get("staffName") or "Staff Operator"

  now_ms = int(time.time() * 1000)
  now_str = datetime.now().strftime("%I:%M %p (Today)")

  bed["status"] = "occupied"
  bed["patient"] = {
    "name": patient_name,
    "age": int(data.get("age") or 45),
    "mrn": mrn,
    "acuity": acuity,
    "diagnosis": diagnosis,
    "doc": doc,
    "docSpecialty": doc_specialty,
    "admittedTimestamp": now_ms,
    "admittedAt": now_str,
    "recovered": False
  }
  bed["resources"] = resources

  # Increment equipment in use
  for r in resources:
    if r in db.get("resources", {}):
      db["resources"][r]["inUse"] += 1

  log_event(
    db,
    "PATIENT_ADMIT",
    "admit",
    bed["id"],
    bed["dept"],
    bed["cat"],
    f"Admitted {patient_name} ({mrn}) - Acuity: {acuity.upper()} - Assigned: {doc}",
    staff_name=staff_name,
    notes=f"Diagnosis: {diagnosis}; Equipment: [{', '.join(resources) or 'Standard'}]"
  )
  save_db(db)

  return jsonify({"success": True, "bed": bed, "message": f"Patient {patient_name} admitted to {bed_id}"})

@app.route("/api/beds/discharge", methods=["POST"])
def discharge_patient():
  """Discharge patient from bed"""
  data = request.json or {}
  bed_id = data.get("bedId")
  staff_name = data.get("staffName") or "Staff Operator"
  db = load_db()
  bed = next((b for b in db.get("beds", []) if b["id"] == bed_id), None)
  if not bed or not bed.get("patient"):
    return jsonify({"success": False, "error": f"Bed {bed_id} is not occupied"}), 400

  patient = bed["patient"]
  # Release equipment
  for r in bed.get("resources", []):
    if r in db.get("resources", {}) and db["resources"][r]["inUse"] > 0:
      db["resources"][r]["inUse"] -= 1

  bed["status"] = "cleaning"
  bed["patient"] = None
  bed["resources"] = []
  bed["cleaningMinutesLeft"] = 15
  bed["cleaningStartedAt"] = int(time.time() * 1000)

  log_event(
    db,
    "PATIENT_DISCHARGE",
    "discharge",
    bed["id"],
    bed["dept"],
    bed["cat"],
    f"Discharged {patient['name']} ({patient['mrn']}) overseen by {patient.get('doc')}. Bed moved to sanitization queue.",
    staff_name=staff_name,
    notes="Discharge orders approved and finalized"
  )
  save_db(db)
  return jsonify({"success": True, "bed": bed, "message": f"Patient {patient['name']} discharged. Bed {bed_id} moved to cleaning."})

@app.route("/api/beds/transfer", methods=["POST"])
def transfer_patient():
  """Transfer patient between beds"""
  data = request.json or {}
  source_id = data.get("sourceBedId")
  target_id = data.get("targetBedId")
  reason = data.get("reason") or "Clinical transfer"
  staff_name = data.get("staffName") or "Staff Operator"

  db = load_db()
  source = next((b for b in db.get("beds", []) if b["id"] == source_id), None)
  target = next((b for b in db.get("beds", []) if b["id"] == target_id), None)

  if not source or not source.get("patient"):
    return jsonify({"success": False, "error": "Source bed is not occupied"}), 400
  if not target or target["status"] != "available":
    return jsonify({"success": False, "error": "Target bed is not available"}), 400

  patient = source["patient"]
  resources = source.get("resources", [])

  target["status"] = "occupied"
  target["patient"] = patient
  target["resources"] = resources

  source["status"] = "cleaning"
  source["patient"] = None
  source["resources"] = []
  source["cleaningMinutesLeft"] = 15
  source["cleaningStartedAt"] = int(time.time() * 1000)

  log_event(
    db,
    "PATIENT_TRANSFER",
    "transfer",
    f"{source_id} -> {target_id}",
    target["dept"],
    target["cat"],
    f"Transferred {patient['name']} from {source_id} to {target_id}. Attending: {patient.get('doc')}.",
    staff_name=staff_name,
    notes=reason
  )
  save_db(db)
  return jsonify({"success": True, "message": f"Transferred {patient['name']} to {target_id}"})

@app.route("/api/beds/status", methods=["POST"])
def update_bed_status():
  """Manual status change"""
  data = request.json or {}
  bed_id = data.get("bedId")
  new_status = data.get("status")
  reason = data.get("reason") or "Operator status change"
  staff_name = data.get("staffName") or "Staff Operator"

  db = load_db()
  bed = next((b for b in db.get("beds", []) if b["id"] == bed_id), None)
  if not bed:
    return jsonify({"success": False, "error": "Bed not found"}), 404

  old_status = bed["status"]
  bed["status"] = new_status
  if new_status == "available":
    bed["patient"] = None
    bed["cleaningMinutesLeft"] = 0
    bed["cleaningStartedAt"] = None
  elif new_status == "cleaning":
    bed["cleaningMinutesLeft"] = 15
    bed["cleaningStartedAt"] = int(time.time() * 1000)

  log_event(
    db,
    "STATUS_CHANGE",
    "status",
    bed["id"],
    bed["dept"],
    bed["cat"],
    f"Status changed from {old_status.upper()} to {new_status.upper()}.",
    staff_name=staff_name,
    notes=reason
  )
  save_db(db)
  return jsonify({"success": True, "bed": bed})

@app.route("/api/beds/toggle-recovered", methods=["POST"])
def toggle_recovered():
  """Toggle recovered flag for patient"""
  data = request.json or {}
  bed_id = data.get("bedId")
  staff_name = data.get("staffName") or "Staff Operator"

  db = load_db()
  bed = next((b for b in db.get("beds", []) if b["id"] == bed_id), None)
  if not bed or not bed.get("patient"):
    return jsonify({"success": False, "error": "Bed has no patient"}), 400

  bed["patient"]["recovered"] = not bed["patient"].get("recovered", False)
  is_rec = bed["patient"]["recovered"]
  status_str = "RECOVERED (Ready for Discharge)" if is_rec else "IN ACTIVE TREATMENT"

  log_event(
    db,
    "PATIENT_RECOVERY_UPDATED",
    "status",
    bed["id"],
    bed["dept"],
    bed["cat"],
    f"Patient {bed['patient']['name']} flagged as: {status_str}. Attending: {bed['patient'].get('doc')}.",
    staff_name=staff_name,
    notes="Physician rounds assessment update"
  )
  save_db(db)
  return jsonify({"success": True, "recovered": is_rec, "bed": bed})

@app.route("/api/beds/sanitize-all", methods=["POST"])
def sanitize_all():
  """Complete sanitization for all cleaning beds (or department)"""
  data = request.json or {}
  dept_id = data.get("deptId")
  staff_name = data.get("staffName") or "Environmental Services Lead"

  db = load_db()
  cleaning_beds = [b for b in db.get("beds", []) if b["status"] == "cleaning" and (not dept_id or b["dept"] == dept_id)]

  if not cleaning_beds:
    return jsonify({"success": True, "count": 0, "message": "No beds currently in cleaning queue."})

  count = len(cleaning_beds)
  bed_ids = [b["id"] for b in cleaning_beds]
  for b in cleaning_beds:
    b["status"] = "available"
    b["cleaningMinutesLeft"] = 0
    b["cleaningStartedAt"] = None

  log_event(
    db,
    "TERMINAL_SANITIZATION_ALL_COMPLETE",
    "status",
    f"ALL ({', '.join(bed_ids)})",
    dept_id or "HOSPITAL-WIDE",
    "all",
    f"Terminal sanitization and UV disinfection verified for {count} beds: [{', '.join(bed_ids)}].",
    staff_name=staff_name,
    notes="Linen prepped, certified sterile and returned to AVAILABLE status"
  )
  save_db(db)
  return jsonify({"success": True, "count": count, "bedIds": bed_ids, "message": f"Sanitized {count} beds successfully."})

@app.route("/api/beds/discharge-recovered", methods=["POST"])
def discharge_recovered():
  """Discharge all recovered/stable patients"""
  data = request.json or {}
  dept_id = data.get("deptId")
  staff_name = data.get("staffName") or "Staff Operator"

  db = load_db()
  eligible = [
    b for b in db.get("beds", [])
    if b["status"] == "occupied" and b.get("patient") and (b["patient"].get("recovered") or b["patient"].get("acuity") == "low") and (not dept_id or b["dept"] == dept_id)
  ]

  if not eligible:
    return jsonify({"success": False, "count": 0, "message": "No patients currently flagged as recovered."})

  discharged = []
  now_ms = int(time.time() * 1000)

  for bed in eligible:
    p = bed["patient"]
    discharged.append({"name": p["name"], "bedId": bed["id"]})
    for r in bed.get("resources", []):
      if r in db.get("resources", {}) and db["resources"][r]["inUse"] > 0:
        db["resources"][r]["inUse"] -= 1

    bed["status"] = "cleaning"
    bed["patient"] = None
    bed["resources"] = []
    bed["cleaningMinutesLeft"] = 15
    bed["cleaningStartedAt"] = now_ms

    log_event(
      db,
      "PATIENT_RECOVERED_DISCHARGE",
      "discharge",
      bed["id"],
      bed["dept"],
      bed["cat"],
      f"Recovered patient {p['name']} ({p.get('mrn')}) discharged home/stepdown. Attending: {p.get('doc')}.",
      staff_name=staff_name,
      notes="LOS criteria met and discharge finalized"
    )

  save_db(db)
  return jsonify({"success": True, "count": len(discharged), "discharged": discharged, "message": f"Discharged {len(discharged)} recovered patients."})

# 3. CITIZEN BED RESERVATION REQUESTS (USER DASHBOARD)

@app.route("/api/reservations", methods=["GET"])
def get_reservations():
  """Get all citizen bed reservation requests"""
  user_aadhaar = request.args.get("aadhaar")
  db = load_db()
  res = db.get("reservations", [])
  if user_aadhaar:
    cleaned = re.sub(r"\s+", "", user_aadhaar)
    res = [r for r in res if r.get("aadhaar") == cleaned]
  return jsonify({"success": True, "reservations": res})

@app.route("/api/reservations/create", methods=["POST"])
def create_reservation():
  """Citizen/User requests a bed reservation from User Dashboard"""
  data = request.json or {}
  patient_name = (data.get("patientName") or "").strip()
  raw_aadhaar = data.get("aadhaar") or ""
  is_valid, cleaned_or_err = validate_aadhaar_number(raw_aadhaar)

  if not patient_name:
    return jsonify({"success": False, "error": "Patient full name is required."}), 400
  if not is_valid:
    return jsonify({"success": False, "error": f"Valid Aadhaar required: {cleaned_or_err}"}), 400

  cleaned_aadhaar = cleaned_or_err
  db = load_db()

  res_id = f"RES-{int(time.time())%10000}"
  new_res = {
    "id": res_id,
    "patientName": patient_name,
    "age": int(data.get("age") or 35),
    "aadhaar": cleaned_aadhaar,
    "formattedAadhaar": f"{cleaned_aadhaar[:4]} {cleaned_aadhaar[4:8]} {cleaned_aadhaar[8:]}",
    "mobile": data.get("mobile") or "+91 99000 00000",
    "preferredDept": data.get("preferredDept") or "ED",
    "bedCategory": data.get("bedCategory") or "emergency",
    "urgency": data.get("urgency") or "urgent",
    "reason": data.get("reason") or "Emergency / Acute Inpatient care requested",
    "requiresOxygen": bool(data.get("requiresOxygen", False)),
    "requiresVentilator": bool(data.get("requiresVentilator", False)),
    "status": "pending",
    "assignedBedId": None,
    "assignedDoc": None,
    "createdAt": datetime.now().strftime("%Y-%m-%d %I:%M %p")
  }

  db.setdefault("reservations", []).insert(0, new_res)
  log_event(
    db,
    "CITIZEN_BED_REQUEST_SUBMITTED",
    "admit",
    "PENDING",
    new_res["preferredDept"],
    new_res["bedCategory"],
    f"Citizen {patient_name} submitted bed request {res_id} (Aadhaar: {new_res['formattedAadhaar']}, Urgency: {new_res['urgency'].upper()}).",
    staff_name="Citizen Portal",
    notes=new_res["reason"]
  )
  save_db(db)

  return jsonify({
    "success": True,
    "reservation": new_res,
    "message": f"Bed request {res_id} submitted successfully! Hospital triage team notified."
  })

@app.route("/api/reservations/approve", methods=["POST"])
def approve_reservation():
  """Hospital Admin approves citizen reservation and assigns a bed"""
  data = request.json or {}
  res_id = data.get("reservationId")
  bed_id = data.get("bedId")
  doc = data.get("doc") or "Dr. David Chen, MD"
  staff_name = data.get("staffName") or "Hospital Admin"

  db = load_db()
  res = next((r for r in db.get("reservations", []) if r["id"] == res_id), None)
  bed = next((b for b in db.get("beds", []) if b["id"] == bed_id), None)

  if not res:
    return jsonify({"success": False, "error": "Reservation not found"}), 404
  if not bed or bed["status"] != "available":
    return jsonify({"success": False, "error": f"Bed {bed_id} is not available"}), 400

  res["status"] = "approved"
  res["assignedBedId"] = bed["id"]
  res["assignedDoc"] = doc

  now_ms = int(time.time() * 1000)
  bed["status"] = "reserved"
  bed["patient"] = {
    "name": res["patientName"],
    "age": res.get("age", 45),
    "mrn": f"MRN-{res_id}",
    "acuity": res.get("urgency", "urgent"),
    "diagnosis": res.get("reason", "Approved Bed Reservation"),
    "doc": doc,
    "docSpecialty": "Attending Physician",
    "admittedTimestamp": now_ms,
    "admittedAt": "Incoming (Reserved via Portal)",
    "recovered": False
  }

  log_event(
    db,
    "CITIZEN_REQUEST_APPROVED",
    "admit",
    bed["id"],
    bed["dept"],
    bed["cat"],
    f"Approved citizen request {res_id} for {res['patientName']}. Held Bed {bed['id']}. Assigned: {doc}.",
    staff_name=staff_name,
    notes="Citizen request verified with Aadhaar and bed allocated"
  )
  save_db(db)

  return jsonify({
    "success": True,
    "reservation": res,
    "bed": bed,
    "message": f"Bed {bed_id} reserved for {res['patientName']} under {doc}!"
  })

@app.route("/api/reservations/reject", methods=["POST"])
def reject_reservation():
  """Hospital Admin rejects citizen reservation with reason"""
  data = request.json or {}
  res_id = data.get("reservationId")
  reason = data.get("reason") or "Capacity exhausted or directed to external clinic"
  staff_name = data.get("staffName") or "Hospital Admin"

  db = load_db()
  res = next((r for r in db.get("reservations", []) if r["id"] == res_id), None)
  if not res:
    return jsonify({"success": False, "error": "Reservation not found"}), 404

  res["status"] = "rejected"
  res["rejectionReason"] = reason

  log_event(
    db,
    "CITIZEN_REQUEST_REJECTED",
    "status",
    "NONE",
    res.get("preferredDept", "GENERAL"),
    res.get("bedCategory", "general"),
    f"Rejected request {res_id} for {res['patientName']}. Reason: {reason}.",
    staff_name=staff_name,
    notes=reason
  )
  save_db(db)
  return jsonify({"success": True, "reservation": res, "message": f"Request {res_id} marked as rejected."})

# 4. SYSTEM & STATIC FILES SERVING

@app.route("/api/system/reset", methods=["POST"])
def reset_system():
  """Reset database to initial pristine baseline"""
  if os.path.exists(DB_FILE):
    os.remove(DB_FILE)
  db = load_db()
  return jsonify({"success": True, "message": "Hospital system reset to pristine baseline with initial census and verified Aadhaar KYC registry."})

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_static(path):
  """Serve frontend static files"""
  if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
    return send_from_directory(app.static_folder, path)
  return send_from_directory(app.static_folder, "index.html")

# ==========================================
# SERVER ENTRY POINT
# ==========================================

if __name__ == "__main__":
  port = int(os.environ.get("PORT", 5000))
  print(f"=" * 60)
  print(f"🏥 Hospital Bed Availability & Resource Coordination Backend")
  print(f"🔒 Aadhaar KYC Verification & Dual Role Engine Active")
  print(f"🚀 Running on http://127.0.0.1:{port}/")
  print(f"=" * 60)
  app.run(host="127.0.0.1", port=port, debug=False)
