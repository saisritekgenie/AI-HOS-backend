const User = require("../models/userModel");
const { Appointment, Invoice, AdmissionRecord } = require("../models/receptionModel");
const auditLogService = require("../services/auditLogService");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const { successResponse } = require("../utils/apiResponse");

/**
 * Get dashboard statistics for the Receptionist role
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // 1. Today's Appointments Count
  const todayAppointments = await Appointment.countDocuments({
    hospital: hospitalId,
    appointmentDate: { $gte: startOfDay, $lte: endOfDay }
  });

  // 2. Checked-in Patients Today
  const checkedInPatients = await Appointment.countDocuments({
    hospital: hospitalId,
    status: "CHECKED_IN",
    appointmentDate: { $gte: startOfDay, $lte: endOfDay }
  });

  // 3. Today's Walk-in Patients
  const todayWalkIn = await User.countDocuments({
    hospital: hospitalId,
    role: "PATIENT",
    registrationType: "WALK_IN",
    createdAt: { $gte: startOfDay, $lte: endOfDay }
  });

  // 4. Today's Online Patients
  const todayOnline = await User.countDocuments({
    hospital: hospitalId,
    role: "PATIENT",
    registrationType: "ONLINE",
    createdAt: { $gte: startOfDay, $lte: endOfDay }
  });

  // 5. Available Doctors (total doctors in hospital)
  const doctorsCount = await User.countDocuments({
    hospital: hospitalId,
    role: "DOCTOR",
    status: "ACTIVE"
  });

  // 6. Emergency Admissions
  const emergencyCases = await AdmissionRecord.countDocuments({
    hospital: hospitalId,
    status: "ADMITTED",
    $or: [
      { department: /ICU/i },
      { department: /Emergency/i },
      { wardNo: /ICU/i },
      { wardNo: /Emergency/i }
    ]
  });

  return successResponse(res, 200, "Reception stats loaded successfully", {
    todayAppointments,
    patientVisits: todayAppointments - (todayAppointments - checkedInPatients),
    pendingCheckins: todayAppointments - checkedInPatients,
    availableDoctors: doctorsCount || 3,
    emergencyCases,
    todayWalkIn,
    todayOnline,
    checkedInPatients
  });
});

/**
 * List all appointments (with auto-seeding for demo)
 */
const getAppointments = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  let appointments = await Appointment.find({ hospital: hospitalId })
    .populate("patient", "firstName lastName uhid mobile")
    .populate("doctor", "firstName lastName")
    .sort({ appointmentDate: 1 });

  // Auto-seed if empty to make the demo instantly testable
  if (appointments.length === 0) {
    const patients = await User.find({ role: "PATIENT", hospital: hospitalId });
    const doctors = await User.find({ role: "DOCTOR", hospital: hospitalId });

    if (patients.length > 0 && doctors.length > 0) {
      const today = new Date();
      const apptData = [
        { patient: patients[0]._id, doctor: doctors[0]._id, hospital: hospitalId, appointmentDate: today, timeSlot: "09:30 AM", status: "BOOKED", tokenNumber: "T-101", notes: "Regular blood pressure review" },
        { patient: patients[0]._id, doctor: doctors[0]._id, hospital: hospitalId, appointmentDate: today, timeSlot: "11:00 AM", status: "BOOKED", tokenNumber: "T-102", notes: "Consultation on lab results" }
      ];
      if (patients.length > 1) {
        const docIndex = doctors.length > 1 ? 1 : 0;
        apptData.push({ patient: patients[1]._id, doctor: doctors[docIndex]._id, hospital: hospitalId, appointmentDate: today, timeSlot: "02:00 PM", status: "BOOKED", tokenNumber: "T-103", notes: "General health physical checkup" });
      }
      await Appointment.create(apptData);
      appointments = await Appointment.find({ hospital: hospitalId })
        .populate("patient", "firstName lastName uhid mobile")
        .populate("doctor", "firstName lastName")
        .sort({ appointmentDate: 1 });
    }
  }

  return successResponse(res, 200, "Appointments list loaded", appointments);
});

/**
 * Book an appointment and generate a queue token
 */
const bookAppointment = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const { patientId, doctorId, appointmentDate, timeSlot, notes } = req.body;

  const startOfDay = new Date(appointmentDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(appointmentDate);
  endOfDay.setHours(23, 59, 59, 999);

  const countToday = await Appointment.countDocuments({
    hospital: hospitalId,
    doctor: doctorId,
    appointmentDate: { $gte: startOfDay, $lte: endOfDay }
  });

  const tokenNumber = `T-${101 + countToday}`;

  const appointment = await Appointment.create({
    patient: patientId,
    doctor: doctorId,
    hospital: hospitalId,
    appointmentDate,
    timeSlot,
    tokenNumber,
    notes,
    status: "BOOKED"
  });

  // Log audit activity
  const patient = await User.findById(patientId);
  await auditLogService.logActivity(req, {
    module: "APPOINTMENT",
    action: "BOOK_APPOINTMENT",
    details: `Scheduled appointment (Token #${tokenNumber}) with doctor ${doctor.firstName} ${doctor.lastName}`,
    targetId: appointment._id.toString(),
    targetName: patient ? `${patient.firstName} ${patient.lastName}` : "Unknown Patient"
  });

  return successResponse(res, 201, "Appointment scheduled successfully", appointment);
});

/**
 * Reschedule, cancel, or check-in an appointment
 */
const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const appointmentId = req.params.id;
  const { status, appointmentDate, timeSlot } = req.body;

  const appt = await Appointment.findOne({ _id: appointmentId, hospital: hospitalId });
  if (!appt) {
    throw new AppError("Appointment not found", 404);
  }

  if (status) {
    appt.status = status;
    if (status === "CHECKED_IN") {
      appt.checkInTime = new Date();
    } else if (status === "COMPLETED") {
      appt.completionTime = new Date();
    }
  }
  if (appointmentDate) appt.appointmentDate = appointmentDate;
  if (timeSlot) appt.timeSlot = timeSlot;

  await appt.save();
  return successResponse(res, 200, "Appointment updated successfully", appt);
});

const getInvoices = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const query = { hospital: hospitalId };
  if (req.user.role === "PATIENT") {
    query.patient = req.user._id;
  }
  let invoices = await Invoice.find(query)
    .populate("patient", "firstName lastName uhid")
    .populate("doctor", "firstName lastName")
    .sort({ createdAt: -1 });

  // Auto-seed if empty
  if (invoices.length === 0) {
    const patients = await User.find({ role: "PATIENT", hospital: hospitalId });
    const doctors = await User.find({ role: "DOCTOR", hospital: hospitalId });

    if (patients.length > 0 && doctors.length > 0) {
      const invData = [
        { patient: patients[0]._id, doctor: doctors[0]._id, hospital: hospitalId, billAmount: 500, paymentStatus: "PAID", invoiceNumber: `INV-${new Date().getFullYear()}-10001`, paymentMethod: "UPI" },
        { patient: patients[0]._id, doctor: doctors[0]._id, hospital: hospitalId, billAmount: 500, paymentStatus: "UNPAID", invoiceNumber: `INV-${new Date().getFullYear()}-10002`, paymentMethod: "N/A" }
      ];
      await Invoice.create(invData);
      invoices = await Invoice.find(query)
        .populate("patient", "firstName lastName uhid")
        .populate("doctor", "firstName lastName")
        .sort({ createdAt: -1 });
    }
  }

  return successResponse(res, 200, "Invoices loaded successfully", invoices);
});

/**
 * Create a consultation invoice
 */
const createInvoice = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const { patientId, doctorId, billAmount, paymentMethod, paymentStatus } = req.body;

  const count = await Invoice.countDocuments({ hospital: hospitalId });
  const invoiceNumber = `INV-${new Date().getFullYear()}-${10001 + count}`;

  const invoice = await Invoice.create({
    patient: patientId,
    doctor: doctorId,
    hospital: hospitalId,
    billAmount: billAmount || 500,
    paymentStatus: paymentStatus || "UNPAID",
    invoiceNumber,
    paymentMethod: paymentMethod || "N/A"
  });

  return successResponse(res, 201, "Consultation invoice generated", invoice);
});

/**
 * Pay an invoice
 */
const payInvoice = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const invoiceId = req.params.id;
  const { paymentMethod } = req.body;

  const invoice = await Invoice.findOne({ _id: invoiceId, hospital: hospitalId });
  if (!invoice) {
    throw new AppError("Invoice not found", 404);
  }

  invoice.paymentStatus = "PAID";
  invoice.paymentMethod = paymentMethod || "CASH";
  await invoice.save();

  return successResponse(res, 200, "Invoice payment processed successfully", invoice);
});

/**
 * List all inpatient admissions (with auto-seeding)
 */
const getAdmissions = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  let admissions = await AdmissionRecord.find({ hospital: hospitalId })
    .populate("patient", "firstName lastName uhid roomNo bedNo")
    .sort({ admissionDate: -1 });

  // Auto-seed if empty
  if (admissions.length === 0) {
    const patients = await User.find({ role: "PATIENT", hospital: hospitalId });
    if (patients.length > 0) {
      const admData = [
        { patient: patients[0]._id, hospital: hospitalId, department: "ICU & Nursing", wardNo: "ICU Ward A", bedNo: "Bed 4", status: "ADMITTED" }
      ];
      await AdmissionRecord.create(admData);

      // Link ward details to User profile
      patients[0].roomNo = "ICU Ward A";
      patients[0].bedNo = "Bed 4";
      await patients[0].save();

      admissions = await AdmissionRecord.find({ hospital: hospitalId })
        .populate("patient", "firstName lastName uhid roomNo bedNo")
        .sort({ admissionDate: -1 });
    }
  }

  return successResponse(res, 200, "Admission records loaded", admissions);
});

/**
 * Admit a patient and assign bed/ward
 */
const createAdmission = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const { patientId, department, wardNo, bedNo } = req.body;

  const admission = await AdmissionRecord.create({
    patient: patientId,
    hospital: hospitalId,
    department,
    wardNo,
    bedNo,
    status: "ADMITTED"
  });

  // Automatically update room & bed number on patient (User model)
  const patient = await User.findOne({ _id: patientId, role: "PATIENT", hospital: hospitalId });
  if (patient) {
    patient.roomNo = wardNo;
    patient.bedNo = bedNo;
    await patient.save();
  }

  // Log audit activity
  await auditLogService.logActivity(req, {
    module: "PATIENT",
    action: "ADMIT_PATIENT",
    details: `Admitted patient to ward '${wardNo}' (Bed: ${bedNo}, Department: ${department})`,
    targetId: admission._id.toString(),
    targetName: patient ? `${patient.firstName} ${patient.lastName}` : "Unknown Patient"
  });

  return successResponse(res, 201, "Patient admitted successfully and bed assigned", admission);
});

/**
 * Discharge patient and release bed
 */
const dischargePatient = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const admissionId = req.params.id;

  const admission = await AdmissionRecord.findOne({ _id: admissionId, hospital: hospitalId });
  if (!admission) {
    throw new AppError("Admission record not found", 404);
  }

  admission.status = "DISCHARGED";
  admission.dischargeDate = new Date();
  await admission.save();

  // Remove room/bed allocation on patient (User model)
  const patient = await User.findOne({ _id: admission.patient, role: "PATIENT", hospital: hospitalId });
  if (patient) {
    patient.roomNo = "N/A";
    patient.bedNo = "N/A";
    await patient.save();
  }

  return successResponse(res, 200, "Patient discharged and bed released", admission);
});

module.exports = {
  getDashboardStats,
  getAppointments,
  bookAppointment,
  updateAppointmentStatus,
  getInvoices,
  createInvoice,
  payInvoice,
  getAdmissions,
  createAdmission,
  dischargePatient,
};
