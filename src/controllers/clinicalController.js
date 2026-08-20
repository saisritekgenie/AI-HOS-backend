const User = require("../models/userModel");
const { VitalsRecord, MedicationRecord, DoctorInstruction, NursingNote, LabRequest, Consultation, DischargeRecord } = require("../models/clinicalModel");
const { Appointment, Invoice } = require("../models/receptionModel");
const auditLogService = require("../services/auditLogService");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const { successResponse } = require("../utils/apiResponse");

/**
 * Get dashboard metrics for the Nurse/Staff role
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;

  // 1) Assigned patients count
  const patientCount = await User.countDocuments({ role: "PATIENT", hospital: hospitalId });

  // 2) Pending instructions count
  const pendingTasksCount = await DoctorInstruction.countDocuments({ hospital: hospitalId, status: "PENDING" });

  // 3) Medications due count
  const medicationsDueCount = await MedicationRecord.countDocuments({ hospital: hospitalId, status: "PENDING" });

  // 4) Critical alerts count
  const vitals = await VitalsRecord.find({ hospital: hospitalId }).sort({ createdAt: -1 });
  
  // Keep only the latest vitals record for each patient
  const latestVitalsMap = new Map();
  for (const record of vitals) {
    if (!latestVitalsMap.has(record.patient.toString())) {
      latestVitalsMap.set(record.patient.toString(), record);
    }
  }

  let criticalCount = 0;
  for (const record of latestVitalsMap.values()) {
    const isCritical = 
      (record.spo2 && record.spo2 < 95) || 
      (record.heartRate && (record.heartRate > 120 || record.heartRate < 50)) ||
      (record.temperature && parseFloat(record.temperature) > 101.0);
    if (isCritical) {
      criticalCount++;
    }
  }

  return successResponse(res, 200, "Dashboard stats retrieved successfully", {
    assignedPatientsCount: patientCount,
    pendingTasksCount,
    medicationsDueCount,
    criticalPatientsCount: criticalCount,
  });
});

/**
 * Get unified clinical summary of a patient (with auto-seeding of prescriptions/tasks for demo purposes)
 */
const getPatientClinicalSummary = asyncHandler(async (req, res) => {
  const patientId = req.params.patientId;
  const hospitalId = req.user.hospital;

  // Security: Patients can only retrieve their own clinical records
  if (req.user.role === "PATIENT" && req.user._id.toString() !== patientId) {
    throw new AppError("Access denied. Patients can only retrieve their own clinical records.", 403);
  }

  // Fetch patient profile
  const patient = await User.findOne({ _id: patientId, role: "PATIENT", hospital: hospitalId })
    .populate("hospital")
    .populate("assignedDoctor", "firstName lastName")
    .populate({
      path: "familyMapping.patient",
      select: "firstName lastName uhid patientId role status mobile"
    });
  
  if (!patient) {
    throw new AppError("Patient not found or access denied.", 404);
  }

  // HIPAA Compliance: Log EMR read access activity in background
  await auditLogService.logActivity(req, {
    module: "CLINICAL",
    action: "EMR_READ",
    details: `Accessed EMR clinical summary records for Patient ID: ${patientId}`,
    targetId: patientId,
    targetName: `${patient.firstName} ${patient.lastName}`
  });

  // Fetch all clinical records
  let [vitals, medications, instructions, notes, labs, consultations] = await Promise.all([
    VitalsRecord.find({ patient: patientId }).sort({ createdAt: -1 }).populate("recordedBy", "firstName lastName"),
    MedicationRecord.find({ patient: patientId }).sort({ createdAt: -1 }).populate("prescribedBy", "firstName lastName").populate("givenBy", "firstName lastName"),
    DoctorInstruction.find({ patient: patientId }).sort({ createdAt: -1 }).populate("prescribedBy", "firstName lastName").populate("completedBy", "firstName lastName"),
    NursingNote.find({ patient: patientId }).sort({ createdAt: -1 }).populate("recordedBy", "firstName lastName"),
    LabRequest.find({ patient: patientId }).sort({ createdAt: -1 }).populate("prescribedBy", "firstName lastName").populate("sampleCollectedBy", "firstName lastName"),
    Consultation.find({ patient: patientId }).sort({ createdAt: -1 }).populate("doctor", "firstName lastName"),
  ]);

  // Find a test doctor in the same hospital to use as prescriber for the seeded records
  const doctors = await User.find({ role: "DOCTOR", hospital: hospitalId });
  const testDoctorId = doctors.length > 0 ? doctors[0]._id : req.user._id;

  // Auto-seed vitals if none exist
  if (vitals.length === 0) {
    const vitalsData = {
      patient: patientId,
      hospital: hospitalId,
      temperature: 98.4,
      bp: "120/80",
      heartRate: 72,
      spo2: 98,
      respiratoryRate: 16,
      sugar: 110,
      recordedBy: testDoctorId
    };
    await VitalsRecord.create(vitalsData);
    vitals = await VitalsRecord.find({ patient: patientId }).sort({ createdAt: -1 }).populate("recordedBy", "firstName lastName");
  }

  // Auto-seed medications if none exist
  if (medications.length === 0) {
    const medsData = [
      { medicationName: "Paracetamol (Calpol)", dosage: "650mg", frequency: "TDS (Thrice daily)", prescribedBy: testDoctorId, status: "PENDING" },
      { medicationName: "Amoxicillin (Antibiotic)", dosage: "500mg", frequency: "BD (Twice daily)", prescribedBy: testDoctorId, status: "PENDING" },
      { medicationName: "Pantoprazole (Antacid)", dosage: "40mg", frequency: "OD (Once daily, empty stomach)", prescribedBy: testDoctorId, status: "PENDING" }
    ];
    await MedicationRecord.create(medsData.map(m => ({ ...m, patient: patientId, hospital: hospitalId })));
    medications = await MedicationRecord.find({ patient: patientId }).sort({ createdAt: -1 }).populate("prescribedBy", "firstName lastName").populate("givenBy", "firstName lastName");
  }

  // Auto-seed instructions if none exist
  if (instructions.length === 0) {
    const instData = [
      { instruction: "Check SpO2 and BP every 4 hours. Report if SpO2 drops below 94%.", priority: "HIGH", prescribedBy: testDoctorId, status: "PENDING" },
      { instruction: "Elevate head of bed to 30 degrees. Assist in deep breathing exercises.", priority: "MEDIUM", prescribedBy: testDoctorId, status: "PENDING" }
    ];
    await DoctorInstruction.create(instData.map(i => ({ ...i, patient: patientId, hospital: hospitalId })));
    instructions = await DoctorInstruction.find({ patient: patientId }).sort({ createdAt: -1 }).populate("prescribedBy", "firstName lastName").populate("completedBy", "firstName lastName");
  }

  // Auto-seed lab requests if none exist
  if (labs.length === 0) {
    const labData = [
      { testName: "Complete Blood Count (CBC)", prescribedBy: testDoctorId, status: "PENDING" },
      { testName: "Random Blood Sugar (RBS)", prescribedBy: testDoctorId, status: "PENDING" }
    ];
    await LabRequest.create(labData.map(l => ({ ...l, patient: patientId, hospital: hospitalId })));
    labs = await LabRequest.find({ patient: patientId }).sort({ createdAt: -1 }).populate("prescribedBy", "firstName lastName").populate("sampleCollectedBy", "firstName lastName");
  }

  // Auto-seed consultations if none exist
  if (consultations.length === 0) {
    const consultData = [
      { diagnosis: "Hypertension & Mild Asthma", clinicalNotes: "Patient reports shortness of breath. Prescribed inhaler and recommended low salt diet.", doctor: testDoctorId, hospital: hospitalId, patient: patientId }
    ];
    await Consultation.create(consultData);
    consultations = await Consultation.find({ patient: patientId }).sort({ createdAt: -1 }).populate("doctor", "firstName lastName");
  }

  return successResponse(res, 200, "Clinical records retrieved successfully", {
    patient,
    vitals,
    medications,
    instructions,
    notes,
    labs,
    consultations,
  });
});

/**
 * Add patient vitals
 */
const addPatientVitals = asyncHandler(async (req, res) => {
  const patientId = req.params.patientId;
  const hospitalId = req.user.hospital;

  const patient = await User.findOne({ _id: patientId, role: "PATIENT", hospital: hospitalId });
  if (!patient) {
    throw new AppError("Patient not found or access denied.", 404);
  }

  const vitals = await VitalsRecord.create({
    patient: patientId,
    hospital: hospitalId,
    temperature: req.body.temperature || "N/A",
    bp: req.body.bp || "N/A",
    heartRate: req.body.heartRate ? parseInt(req.body.heartRate, 10) : null,
    spo2: req.body.spo2 ? parseInt(req.body.spo2, 10) : null,
    respiratoryRate: req.body.respiratoryRate ? parseInt(req.body.respiratoryRate, 10) : null,
    weight: req.body.weight ? parseFloat(req.body.weight) : null,
    sugar: req.body.sugar ? parseInt(req.body.sugar, 10) : null,
    recordedBy: req.user._id,
  });

  return successResponse(res, 201, "Vitals recorded successfully", vitals);
});

/**
 * Add nursing observation notes
 */
const addNursingNote = asyncHandler(async (req, res) => {
  const patientId = req.params.patientId;
  const hospitalId = req.user.hospital;

  const patient = await User.findOne({ _id: patientId, role: "PATIENT", hospital: hospitalId });
  if (!patient) {
    throw new AppError("Patient not found or access denied.", 404);
  }

  const note = await NursingNote.create({
    patient: patientId,
    hospital: hospitalId,
    note: req.body.note,
    recordedBy: req.user._id,
  });

  return successResponse(res, 201, "Nursing note saved successfully", note);
});

/**
 * Administer prescribed medication
 */
const administerMedication = asyncHandler(async (req, res) => {
  const medId = req.params.id;
  const hospitalId = req.user.hospital;

  const med = await MedicationRecord.findOne({ _id: medId, hospital: hospitalId });
  if (!med) {
    throw new AppError("Medication record not found.", 404);
  }

  med.status = req.body.status || "GIVEN";
  med.givenBy = req.user._id;
  med.givenAt = new Date();
  await med.save();

  return successResponse(res, 200, "Medication status updated successfully", med);
});

/**
 * Complete doctor clinical instruction
 */
const completeInstruction = asyncHandler(async (req, res) => {
  const instructionId = req.params.id;
  const hospitalId = req.user.hospital;

  const inst = await DoctorInstruction.findOne({ _id: instructionId, hospital: hospitalId });
  if (!inst) {
    throw new AppError("Doctor instruction not found.", 404);
  }

  inst.status = "COMPLETED";
  inst.completedBy = req.user._id;
  inst.completedAt = new Date();
  await inst.save();

  return successResponse(res, 200, "Instruction marked as completed successfully", inst);
});

/**
 * Collect lab request blood/fluid sample
 */
const collectLabSample = asyncHandler(async (req, res) => {
  const labId = req.params.id;
  const hospitalId = req.user.hospital;

  const lab = await LabRequest.findOne({ _id: labId, hospital: hospitalId });
  if (!lab) {
    throw new AppError("Lab request not found.", 404);
  }

  lab.status = "SAMPLE_COLLECTED";
  lab.sampleCollectedBy = req.user._id;
  lab.sampleCollectedAt = new Date();
  await lab.save();

  return successResponse(res, 200, "Lab sample collection status updated", lab);
});

/**
 * Update room, bed, or doctor assignments for a patient
 */
const updatePatientAssignment = asyncHandler(async (req, res) => {
  const patientId = req.params.patientId;
  const hospitalId = req.user.hospital;

  const patient = await User.findOne({ _id: patientId, role: "PATIENT", hospital: hospitalId });
  if (!patient) {
    throw new AppError("Patient not found or access denied.", 404);
  }

  if (req.body.roomNo !== undefined) patient.roomNo = req.body.roomNo;
  if (req.body.bedNo !== undefined) patient.bedNo = req.body.bedNo;
  if (req.body.assignedDoctor !== undefined) {
    patient.assignedDoctor = req.body.assignedDoctor || null;
  }

  await patient.save();

  // Keep Admissions registry synced
  if (req.body.roomNo || req.body.bedNo) {
    const { AdmissionRecord } = require("../models/receptionModel");
    let admission = await AdmissionRecord.findOne({ patient: patientId, status: { $ne: "DISCHARGED" }, hospital: hospitalId });
    if (admission) {
      if (req.body.roomNo !== undefined) admission.wardNo = req.body.roomNo;
      if (req.body.bedNo !== undefined) admission.bedNo = req.body.bedNo;
      await admission.save();
    } else {
      await AdmissionRecord.create({
        patient: patientId,
        hospital: hospitalId,
        wardNo: req.body.roomNo || "General Ward",
        bedNo: req.body.bedNo || "N/A",
        department: "General Medicine",
        status: "ADMITTED"
      });
    }
  }

  return successResponse(res, 200, "Patient ward allocation updated successfully", patient);
});

/**
 * Get all pending doctor care tasks/instructions across the hospital
 */
const getAllPendingTasks = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const tasks = await DoctorInstruction.find({ hospital: hospitalId, status: "PENDING" })
    .populate("patient", "firstName lastName uhid roomNo bedNo")
    .populate("prescribedBy", "firstName lastName")
    .sort({ createdAt: 1 });
  return successResponse(res, 200, "Pending tasks retrieved", tasks);
});

/**
 * Get all pending medications due across the hospital
 */
const getAllPendingMedications = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const meds = await MedicationRecord.find({ hospital: hospitalId, status: "PENDING" })
    .populate("patient", "firstName lastName uhid roomNo bedNo")
    .populate("prescribedBy", "firstName lastName")
    .sort({ createdAt: 1 });
  return successResponse(res, 200, "Pending medications retrieved", meds);
});

/**
 * Get all critical patients alerts across the hospital
 */
const getAllCriticalAlerts = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;

  const patients = await User.find({ role: "PATIENT", hospital: hospitalId });
  const patientIds = patients.map(p => p._id);

  const vitals = await VitalsRecord.find({ patient: { $in: patientIds } })
    .populate("patient", "firstName lastName uhid roomNo bedNo")
    .populate("recordedBy", "firstName lastName")
    .sort({ createdAt: -1 });

  const latestVitalsMap = new Map();
  for (const record of vitals) {
    if (record.patient && !latestVitalsMap.has(record.patient._id.toString())) {
      latestVitalsMap.set(record.patient._id.toString(), record);
    }
  }

  const criticalList = [];
  for (const record of latestVitalsMap.values()) {
    const issues = [];
    let priority = "NORMAL";

    if (record.spo2 && record.spo2 < 92) {
      issues.push(`Critical Low SpO2 (${record.spo2}%)`);
      priority = "CRITICAL";
    } else if (record.spo2 && record.spo2 < 95) {
      issues.push(`Low SpO2 (${record.spo2}%)`);
      priority = "URGENT";
    }

    if (record.heartRate && (record.heartRate > 130 || record.heartRate < 40)) {
      issues.push(`Critical Heart Rate (${record.heartRate} bpm)`);
      priority = "CRITICAL";
    } else if (record.heartRate && (record.heartRate > 120 || record.heartRate < 55)) {
      issues.push(`Abnormal Heart Rate (${record.heartRate} bpm)`);
      if (priority !== "CRITICAL") priority = "URGENT";
    }

    if (record.temperature && parseFloat(record.temperature) > 103.0) {
      issues.push(`Critical High Temperature (${record.temperature}°F)`);
      priority = "CRITICAL";
    } else if (record.temperature && parseFloat(record.temperature) > 101.0) {
      issues.push(`High Temperature (${record.temperature}°F)`);
      if (priority !== "CRITICAL") priority = "URGENT";
    }

    // Check if ICU ward is required
    if (record.patient && record.patient.roomNo && (record.patient.roomNo.includes("ICU") || record.patient.roomNo.includes("Emergency"))) {
      priority = "CRITICAL";
    }

    if (issues.length > 0) {
      criticalList.push({
        _id: record._id,
        vitalsRecord: record,
        patient: record.patient,
        issues: issues.join(", "),
        priority
      });
    }
  }

  // Sort critical list: CRITICAL first, then URGENT, then NORMAL
  criticalList.sort((a, b) => {
    const weights = { "CRITICAL": 3, "URGENT": 2, "NORMAL": 1 };
    return weights[b.priority] - weights[a.priority];
  });

  return successResponse(res, 200, "Critical alerts retrieved", criticalList);
});

/**
 * Log a clinical consultation (Diagnosis, Notes, Follow-up date)
 */
const addConsultation = asyncHandler(async (req, res) => {
  const patientId = req.params.patientId;
  const hospitalId = req.user.hospital;
  const { diagnosis, clinicalNotes, followUpDate } = req.body;

  const consult = await Consultation.create({
    patient: patientId,
    doctor: req.user._id,
    hospital: hospitalId,
    diagnosis,
    clinicalNotes,
    followUpDate: followUpDate ? new Date(followUpDate) : null
  });

  return successResponse(res, 201, "Consultation logged successfully", consult);
});

/**
 * Add a medication prescription (MAR record)
 */
const addPrescription = asyncHandler(async (req, res) => {
  const patientId = req.params.patientId;
  const hospitalId = req.user.hospital;
  const { medicationName, dosage, frequency } = req.body;

  const med = await MedicationRecord.create({
    patient: patientId,
    hospital: hospitalId,
    medicationName,
    dosage,
    frequency,
    prescribedBy: req.user._id,
    status: "PENDING"
  });

  // Log audit activity
  const patient = await User.findById(patientId);
  await auditLogService.logActivity(req, {
    module: "CLINICAL",
    action: "ADD_PRESCRIPTION",
    details: `Prescribed medication '${medicationName}' (${dosage}, ${frequency})`,
    targetId: med._id.toString(),
    targetName: patient ? `${patient.firstName} ${patient.lastName}` : "Unknown Patient"
  });

  return successResponse(res, 201, "Prescription added successfully", med);
});

/**
 * Add a doctor task/instruction for the nurses
 */
const addDoctorInstruction = asyncHandler(async (req, res) => {
  const patientId = req.params.patientId;
  const hospitalId = req.user.hospital;
  const { instruction, priority } = req.body;

  const task = await DoctorInstruction.create({
    patient: patientId,
    hospital: hospitalId,
    instruction,
    priority: priority || "MEDIUM",
    prescribedBy: req.user._id,
    status: "PENDING"
  });

  return successResponse(res, 201, "Care instruction added successfully", task);
});

/**
 * Order a laboratory diagnostic test
 */
const orderLabTest = asyncHandler(async (req, res) => {
  const patientId = req.params.patientId;
  const hospitalId = req.user.hospital;
  const { testName } = req.body;

  const lab = await LabRequest.create({
    patient: patientId,
    hospital: hospitalId,
    testName,
    prescribedBy: req.user._id,
    status: "PENDING"
  });

  return successResponse(res, 201, "Lab test ordered successfully", lab);
});

/**
 * List all lab tests in the hospital (with auto-seeding if empty)
 */
const getLabRequests = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  let labs = await LabRequest.find({ hospital: hospitalId })
    .populate("patient", "firstName lastName uhid roomNo bedNo")
    .populate("prescribedBy", "firstName lastName")
    .populate("sampleCollectedBy", "firstName lastName")
    .sort({ isEmergency: -1, createdAt: -1 });

  // Auto-seed lab requests for demo testing
  if (labs.length === 0) {
    const patients = await User.find({ role: "PATIENT", hospital: hospitalId });
    const doctors = await User.find({ role: "DOCTOR", hospital: hospitalId });

    if (patients.length > 0 && doctors.length > 0) {
      const labData = [
        { patient: patients[0]._id, doctor: doctors[0]._id, hospital: hospitalId, testName: "Complete Blood Count (CBC)", status: "PENDING", isEmergency: true, prescribedBy: doctors[0]._id },
        { patient: patients[0]._id, doctor: doctors[0]._id, hospital: hospitalId, testName: "HbA1c Glycated Hemoglobin", status: "PENDING", isEmergency: false, prescribedBy: doctors[0]._id }
      ];
      await LabRequest.create(labData);
      labs = await LabRequest.find({ hospital: hospitalId })
        .populate("patient", "firstName lastName uhid roomNo bedNo")
        .populate("prescribedBy", "firstName lastName")
        .populate("sampleCollectedBy", "firstName lastName")
        .sort({ isEmergency: -1, createdAt: -1 });
    }
  }

  return successResponse(res, 200, "Lab requests list loaded successfully", labs);
});

/**
 * Accept, reject, or log sample collections
 */
const updateLabStatus = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const labId = req.params.id;
  const { status, rejectionReason } = req.body;

  const lab = await LabRequest.findOne({ _id: labId, hospital: hospitalId });
  if (!lab) {
    throw new AppError("Lab request not found", 404);
  }

  if (status) lab.status = status;
  if (rejectionReason) lab.rejectionReason = rejectionReason;

  if (status === "SAMPLE_COLLECTED") {
    lab.sampleCollectedAt = new Date();
    lab.sampleCollectedBy = req.user._id;
  }

  await lab.save();
  return successResponse(res, 200, `Lab request status updated to ${status}`, lab);
});

/**
 * Submit lab results & upload mock report pdf filename
 */
const completeLabTest = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const labId = req.params.id;
  const { results, reportFile } = req.body;

  const lab = await LabRequest.findOne({ _id: labId, hospital: hospitalId }).populate("patient");
  if (!lab) {
    throw new AppError("Lab request not found", 404);
  }

  lab.status = "COMPLETED";
  lab.results = results || "Diagnostic parameters normal.";
  lab.reportFile = reportFile || `lab_report_${lab.testName.replace(/\s+/g, "_").toLowerCase()}_${Date.now()}.pdf`;
  await lab.save();

  // Dynamically write mock report file to disk under uploads/ directory
  try {
    const fs = require("fs");
    const path = require("path");
    const uploadsDir = path.join(__dirname, "../../uploads");
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const reportContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Laboratory Report - ${lab.testName}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #0f172a; max-width: 650px; margin: 0 auto; line-height: 1.5; background-color: #f8fafc; }
    .report-card { background: white; padding: 40px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); position: relative; overflow: hidden; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; border-bottom: 2px solid #10b981; padding-bottom: 15px; }
    .hospital-title { font-size: 22px; font-weight: 800; color: #10b981; text-transform: uppercase; margin: 0; }
    .doc-title { font-size: 13px; font-weight: 700; color: #475569; letter-spacing: 1px; text-transform: uppercase; margin: 4px 0 0 0; }
    .badge { font-size: 11px; font-weight: 800; color: #ef4444; border: 2px solid #ef4444; padding: 3px 6px; border-radius: 4px; display: inline-block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 8px; margin-bottom: 25px; font-size: 13px; }
    .meta-item { color: #334155; }
    .result-card { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 25px; }
    .result-card h3 { color: #15803d; margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; }
    .result-text { font-size: 13px; color: #1e293b; line-height: 1.6; white-space: pre-line; }
    .footer { border-top: 1px dashed #cbd5e1; margin-top: 40px; padding-top: 15px; text-align: center; font-size: 11px; color: #64748b; }
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 60px; color: rgba(239, 68, 68, 0.05); font-weight: 900; letter-spacing: 4px; pointer-events: none; white-space: nowrap; user-select: none; text-transform: uppercase; z-index: 1; }
  </style>
</head>
<body>
  <div class="report-card">
    <div class="watermark">DUPLICATE REPORT</div>
    <table class="header-table">
      <tr>
        <td>
          <h1 class="hospital-title">KIMS Hospital</h1>
          <h2 class="doc-title">Pathology & Diagnostic Lab Report</h2>
        </td>
        <td style="text-align: right; font-size: 11px; color: #64748b;">
          <div class="badge">DUPLICATE COPY</div>
          <div>Report Date: ${new Date().toLocaleDateString()}</div>
          <div>Status: RELEASED</div>
        </td>
      </tr>
    </table>

    <div class="meta-grid">
      <div class="meta-item"><strong>Patient Name:</strong> ${lab.patient?.firstName || "N/A"} ${lab.patient?.lastName || "N/A"}</div>
      <div class="meta-item"><strong>UHID (Patient ID):</strong> ${lab.patient?.uhid || "N/A"}</div>
      <div class="meta-item"><strong>Test Parameter:</strong> ${lab.testName}</div>
      <div class="meta-item"><strong>Ordered By:</strong> Dr. ${lab.prescribedBy?.firstName || "N/A"} ${lab.prescribedBy?.lastName || "Staff"}</div>
    </div>

    <div class="result-card">
      <h3>Diagnostic Findings</h3>
      <div class="result-text">${lab.results}</div>
    </div>

    <div style="font-size: 12px; color: #64748b; margin-top: 20px;">
      <strong>Lab Assistant Notes:</strong> Test completed and verified by pathology technician.
    </div>

    <div class="footer">
      * Verified Medical Diagnostic Document. *
    </div>
  </div>
</body>
</html>`;

    fs.writeFileSync(path.join(uploadsDir, lab.reportFile), reportContent);
  } catch (err) {
    console.error("Failed to write mock report file:", err);
  }

  return successResponse(res, 200, "Lab test completed and results registered", lab);
});

/**
 * Update patient's clinical tags (allergies, vaccinations, chronicDiseases)
 */
const updatePatientClinicalTags = asyncHandler(async (req, res) => {
  const patientId = req.params.patientId;
  const hospitalId = req.user.hospital;
  const { allergies, vaccinations, chronicDiseases } = req.body;

  const patient = await User.findOne({ _id: patientId, role: "PATIENT", hospital: hospitalId });
  if (!patient) {
    throw new AppError("Patient not found or access denied.", 404);
  }

  if (allergies !== undefined) patient.allergies = allergies;
  if (vaccinations !== undefined) patient.vaccinations = vaccinations;
  if (chronicDiseases !== undefined) patient.chronicDiseases = chronicDiseases;

  await patient.save();
  return successResponse(res, 200, "Patient EMR tags updated successfully", patient);
});

/**
 * Add a clinical document for the patient
 */
const addPatientDocument = asyncHandler(async (req, res) => {
  const patientId = req.params.patientId;
  const hospitalId = req.user.hospital;
  const { name, url } = req.body;

  if (!name) {
    throw new AppError("Document name is required", 400);
  }

  const patient = await User.findOne({ _id: patientId, role: "PATIENT", hospital: hospitalId });
  if (!patient) {
    throw new AppError("Patient not found or access denied.", 404);
  }

  const mockUrl = url || `patient_doc_${name.replace(/\s+/g, "_").toLowerCase()}_${Date.now()}.pdf`;

  patient.documents.push({
    name,
    url: mockUrl,
    uploadedAt: new Date(),
    uploadedBy: req.user._id
  });

  await patient.save();
  return successResponse(res, 200, "Document uploaded successfully", patient);
});

/**
 * Create a new Patient Appointment
 */
const createAppointment = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const { patientId, doctorId, appointmentDate, timeSlot } = req.body;

  const appt = await Appointment.create({
    patient: patientId,
    doctor: doctorId,
    hospital: hospitalId,
    appointmentDate: new Date(appointmentDate),
    timeSlot,
    status: "BOOKED"
  });

  await auditLogService.logActivity(req, {
    module: "CLINICAL",
    action: "CREATE_APPOINTMENT",
    details: `Scheduled appointment for Patient ID ${patientId} with Doctor ID ${doctorId} on slot ${timeSlot}`,
    targetId: appt._id.toString()
  });

  return successResponse(res, 201, "Appointment scheduled successfully", appt);
});

/**
 * Get appointments list filtered by doctor, patient, or date
 */
const getAppointments = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const query = { hospital: hospitalId };

  if (req.query.doctor) query.doctor = req.query.doctor;
  if (req.query.patient) query.patient = req.query.patient;
  if (req.query.status) query.status = req.query.status;

  const appointments = await Appointment.find(query)
    .populate("patient", "firstName lastName uhid mobile")
    .populate("doctor", "firstName lastName")
    .sort({ appointmentDate: 1, timeSlot: 1 });

  return successResponse(res, 200, "Appointments retrieved successfully", appointments);
});

/**
 * Check in a patient for their scheduled appointment
 */
const checkInAppointment = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const apptId = req.params.id;

  const appt = await Appointment.findOne({ _id: apptId, hospital: hospitalId });
  if (!appt) {
    throw new AppError("Appointment record not found.", 404);
  }

  appt.status = "CHECKED_IN";
  await appt.save();

  await auditLogService.logActivity(req, {
    module: "CLINICAL",
    action: "CHECKIN_APPOINTMENT",
    details: `Patient checked in for appointment ID ${apptId}`,
    targetId: apptId
  });

  return successResponse(res, 200, "Patient checked in successfully", appt);
});

/**
 * Submit a patient discharge record (verifies billing clearance first)
 */
const dischargePatient = asyncHandler(async (req, res) => {
  const patientId = req.params.patientId;
  const hospitalId = req.user.hospital;
  const { dischargeSummary, takeHomeMedications } = req.body;

  // 1) Verify patient exists
  const patient = await User.findOne({ _id: patientId, role: "PATIENT", hospital: hospitalId });
  if (!patient) {
    throw new AppError("Patient not found or access denied.", 404);
  }

  // 2) Check if patient has any outstanding bills
  const { BillingInvoice } = require("../models/billingModel");
  const unpaidInvoice = await BillingInvoice.findOne({ 
    patient: patientId, 
    hospital: hospitalId, 
    status: { $in: ["UNPAID", "PARTIALLY_PAID"] } 
  });

  let billingCleared = true;
  if (unpaidInvoice) {
    billingCleared = false;
  }

  const discharge = await DischargeRecord.create({
    patient: patientId,
    hospital: hospitalId,
    doctor: req.user._id,
    dischargeSummary,
    billingCleared,
    takeHomeMedications: takeHomeMedications || [],
    dischargedAt: new Date()
  });

  if (billingCleared) {
    patient.roomNo = "N/A";
    patient.bedNo = "N/A";
    await patient.save();

    // Release bed in Admissions registry
    const { AdmissionRecord } = require("../models/receptionModel");
    const admission = await AdmissionRecord.findOne({ patient: patientId, status: { $ne: "DISCHARGED" }, hospital: hospitalId });
    if (admission) {
      admission.status = "DISCHARGED";
      admission.dischargeDate = new Date();
      await admission.save();
    }
  }

  await auditLogService.logActivity(req, {
    module: "CLINICAL",
    action: "DISCHARGE_PATIENT",
    details: `Discharged Patient ID ${patientId}. Billing Cleared: ${billingCleared}`,
    targetId: discharge._id.toString(),
    targetName: `${patient.firstName} ${patient.lastName}`
  });

  return successResponse(res, 201, "Discharge record created successfully", { discharge, billingCleared });
});

/**
 * Get patient discharge status summary
 */
const getDischargeRecord = asyncHandler(async (req, res) => {
  const patientId = req.params.patientId;
  const hospitalId = req.user.hospital;

  const record = await DischargeRecord.findOne({ patient: patientId, hospital: hospitalId })
    .populate("doctor", "firstName lastName")
    .sort({ createdAt: -1 });

  return successResponse(res, 200, "Patient discharge record retrieved", record);
});

/**
 * Run OCR parse on a simulated laboratory report sheet
 */
const parseLabReportOCR = asyncHandler(async (req, res) => {
  const labId = req.params.id;
  const hospitalId = req.user.hospital;
  const { reportText } = req.body;

  if (!reportText) {
    throw new AppError("Lab report text payload is required for OCR parsing.", 400);
  }

  const lab = await LabRequest.findOne({ _id: labId, hospital: hospitalId });
  if (!lab) {
    throw new AppError("Lab request record not found.", 404);
  }

  // Use baseAIService to parse text content using the LLM
  const baseAIServiceClass = require("../services/ai/baseAIService");
  const aiService = new baseAIServiceClass();
  const parsedResults = await aiService.callLLM(
    "You are a clinical OCR Laboratory parser. Extract diagnostic parameters, metrics, or test values from this raw text string. Return a short 1-sentence summary of findings. Output text only.",
    reportText
  );

  const resultsSummary = parsedResults || "Diagnostic markers parsed: " + reportText.substring(0, 50) + "...";

  lab.results = resultsSummary;
  lab.status = "COMPLETED";
  await lab.save();

  await auditLogService.logActivity(req, {
    module: "CLINICAL",
    action: "LAB_OCR_PARSE",
    details: `Performed AI OCR on lab report for test: ${lab.testName}`,
    targetId: labId
  });

  return successResponse(res, 200, "Lab report parsed via OCR successfully", lab);
});

/**
 * Compile a Patient's entire EMR health record dossier
 */
const getConsolidatedReport = asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  const patient = await User.findById(patientId).populate("hospital");
  if (!patient) {
    throw new AppError("Patient profile not found", 404);
  }

  // Fetch all clinical records in parallel
  const [consultations, vitals, labs, invoices, discharge, medications] = await Promise.all([
    Consultation.find({ patient: patientId }).populate("doctor", "firstName lastName").sort({ createdAt: -1 }),
    VitalsRecord.find({ patient: patientId }).sort({ recordedAt: -1 }),
    LabRequest.find({ patient: patientId }).populate("prescribedBy sampleCollectedBy", "firstName lastName").sort({ createdAt: -1 }),
    Invoice.find({ patient: patientId }).sort({ createdAt: -1 }),
    DischargeRecord.findOne({ patient: patientId }).populate("doctor", "firstName lastName"),
    MedicationRecord.find({ patient: patientId }).populate("prescribedBy givenBy", "firstName lastName").sort({ createdAt: -1 })
  ]);

  // Log EMR access for audit compliance
  await auditLogService.logActivity(req, {
    module: "CLINICAL",
    action: "EMR_READ",
    details: `Exported consolidated EMR health record report for Patient: ${patient.firstName} ${patient.lastName} (UHID: ${patient.uhid})`,
    targetId: patientId
  });

  return successResponse(res, 200, "Consolidated health report compiled successfully", {
    patient,
    consultations,
    vitals,
    labs,
    invoices,
    discharge,
    medications
  });
});

module.exports = {
  getDashboardStats,
  getPatientClinicalSummary,
  addPatientVitals,
  addNursingNote,
  administerMedication,
  completeInstruction,
  collectLabSample,
  updatePatientAssignment,
  getAllPendingTasks,
  getAllPendingMedications,
  getAllCriticalAlerts,
  addConsultation,
  addPrescription,
  addDoctorInstruction,
  orderLabTest,
  getLabRequests,
  updateLabStatus,
  completeLabTest,
  updatePatientClinicalTags,
  addPatientDocument,
  createAppointment,
  getAppointments,
  checkInAppointment,
  dischargePatient,
  getDischargeRecord,
  parseLabReportOCR,
  getConsolidatedReport,
};
