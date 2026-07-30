const User = require("../models/userModel");
const { VitalsRecord, MedicationRecord, DoctorInstruction, NursingNote, LabRequest, Consultation } = require("../models/clinicalModel");
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
    .populate("assignedDoctor", "firstName lastName")
    .populate({
      path: "familyMapping.patient",
      select: "firstName lastName uhid patientId role status mobile"
    });
  
  if (!patient) {
    throw new AppError("Patient not found or access denied.", 404);
  }

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
    if (record.spo2 && record.spo2 < 95) {
      issues.push(`Low SpO2 (${record.spo2}%)`);
    }
    if (record.heartRate && (record.heartRate > 120 || record.heartRate < 50)) {
      issues.push(`Abnormal Heart Rate (${record.heartRate} bpm)`);
    }
    if (record.temperature && parseFloat(record.temperature) > 101.0) {
      issues.push(`High Temperature (${record.temperature}°F)`);
    }

    if (issues.length > 0) {
      criticalList.push({
        _id: record._id,
        vitalsRecord: record,
        patient: record.patient,
        issues: issues.join(", ")
      });
    }
  }

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

  const lab = await LabRequest.findOne({ _id: labId, hospital: hospitalId });
  if (!lab) {
    throw new AppError("Lab request not found", 404);
  }

  lab.status = "COMPLETED";
  lab.results = results || "Diagnostic parameters normal.";
  lab.reportFile = reportFile || `lab_report_${lab.testName.replace(/\s+/g, "_").toLowerCase()}_${Date.now()}.pdf`;
  await lab.save();

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
};
