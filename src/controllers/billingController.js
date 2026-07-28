const User = require("../models/userModel");
const { BillingInvoice } = require("../models/billingModel");
const AdvancePayment = require("../models/advancePaymentModel");
const { PharmacyBill } = require("../models/pharmacyModel");
const { LabRequest } = require("../models/clinicalModel");
const { Invoice, AdmissionRecord } = require("../models/receptionModel");
const auditLogService = require("../services/auditLogService");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const { successResponse } = require("../utils/apiResponse");


// Helper to determine price for standard lab tests if not in model
const getLabTestPrice = (testName) => {
  const name = (testName || "").toUpperCase();
  if (name.includes("CBC") || name.includes("BLOOD COUNT")) return 350;
  if (name.includes("SUGAR") || name.includes("GLUCOSE")) return 150;
  if (name.includes("METABOLIC") || name.includes("FMP")) return 1200;
  if (name.includes("LIPID") || name.includes("CHOLESTEROL")) return 600;
  if (name.includes("THYROID") || name.includes("TSH")) return 900;
  if (name.includes("ECG") || name.includes("ELECTROCARDIOGRAM")) return 500;
  if (name.includes("LFT") || name.includes("LIVER")) return 750;
  if (name.includes("KFT") || name.includes("KIDNEY") || name.includes("RENAL")) return 800;
  if (name.includes("URINE")) return 200;
  if (name.includes("X-RAY") || name.includes("XRAY")) return 800;
  return 500; // Default test price in INR
};

/**
 * Get dashboard stats for the Cashier role
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch all invoices for this hospital
  const invoices = await BillingInvoice.find({ hospital: hospitalId });

  let totalRevenue = 0;
  let cashRevenue = 0;
  let upiRevenue = 0;
  let cardRevenue = 0;
  let insuranceRevenue = 0;
  let pendingDue = 0;
  let refundedAmount = 0;

  let consultationSales = 0;
  let labSales = 0;
  let pharmacySales = 0;
  let dischargeSales = 0;
  let otherSales = 0;

  invoices.forEach((inv) => {
    // Process transaction-level details for revenue metrics
    inv.transactions.forEach((tx) => {
      totalRevenue += tx.amount;
      if (tx.paymentMethod === "CASH") cashRevenue += tx.amount;
      if (tx.paymentMethod === "UPI") upiRevenue += tx.amount;
      if (tx.paymentMethod === "CARD") cardRevenue += tx.amount;
      if (tx.paymentMethod === "INSURANCE") insuranceRevenue += tx.amount;
    });

    if (inv.paymentStatus === "REFUNDED") {
      refundedAmount += inv.amount;
    } else {
      pendingDue += inv.amountDue;
    }

    // Category Sales Split (Paid portion only)
    const paidPortion = inv.amountPaid;
    if (paidPortion > 0) {
      if (inv.category === "CONSULTATION") consultationSales += paidPortion;
      else if (inv.category === "LAB") labSales += paidPortion;
      else if (inv.category === "PHARMACY") pharmacySales += paidPortion;
      else if (inv.category === "DISCHARGE") dischargeSales += paidPortion;
      else otherSales += paidPortion;
    }
  });

  return successResponse(res, 200, "Cashier dashboard stats loaded in Indian Rupees (₹)", {
    totalRevenue,
    cashRevenue,
    upiRevenue,
    cardRevenue,
    insuranceRevenue,
    pendingDue,
    refundedAmount,
    consultationSales,
    labSales,
    pharmacySales,
    dischargeSales,
    otherSales,
  });
});

/**
 * Fetch billing invoices with pagination, search, status, category and date range filters
 */
const getInvoices = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const { page = 1, limit = 20, search = "", status, category, startDate, endDate } = req.query;

  const query = { hospital: hospitalId };

  if (req.user.role === "PATIENT") {
    query.patient = req.user._id;
  }

  // Status filter
  if (status) {
    query.paymentStatus = status;
  }

  // Category filter
  if (category) {
    query.category = category;
  }

  // Date range filter
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  // Search by patient name or UHID
  if (search.trim()) {
    const patients = await User.find({
      hospital: hospitalId,
      role: "PATIENT",
      $or: [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { uhid: { $regex: search, $options: "i" } },
      ],
    }).select("_id");

    const patientIds = patients.map((p) => p._id);
    query.$or = [
      { patient: { $in: patientIds } },
      { billNumber: { $regex: search, $options: "i" } },
      { itemName: { $regex: search, $options: "i" } },
    ];
  }

  const count = await BillingInvoice.countDocuments(query);
  const invoices = await BillingInvoice.find(query)
    .populate("patient", "firstName lastName uhid mobile")
    .populate("processedBy", "firstName lastName")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  // Seed invoices in INR (₹) if empty to make the cashier counter work immediately
  if (invoices.length === 0 && search === "" && page == 1) {
    const patients = await User.find({ role: "PATIENT", hospital: hospitalId });
    if (patients.length > 0) {
      const seedData = [
        {
          hospital: hospitalId,
          patient: patients[0]._id,
          category: "CONSULTATION",
          itemName: "Dr. Adams - General Consultation Fee",
          amount: 500, // INR
          paymentStatus: "UNPAID",
          billNumber: `INV-${new Date().getFullYear()}-00101`
        },
        {
          hospital: hospitalId,
          patient: patients[0]._id,
          category: "LAB",
          itemName: "Full Metabolic Panel (FMP) Diagnostics",
          amount: 1200, // INR
          paymentStatus: "UNPAID",
          billNumber: `INV-${new Date().getFullYear()}-00102`
        },
        {
          hospital: hospitalId,
          patient: patients[0]._id,
          category: "PHARMACY",
          itemName: "Antibiotics & Paracetamol dispensation",
          amount: 450, // INR
          paymentStatus: "UNPAID",
          billNumber: `INV-${new Date().getFullYear()}-00103`
        }
      ];

      await BillingInvoice.create(seedData);
      
      const refreshedInvoices = await BillingInvoice.find(query)
        .populate("patient", "firstName lastName uhid mobile")
        .populate("processedBy", "firstName lastName")
        .sort({ createdAt: -1 });

      return successResponse(res, 200, "Billing invoices loaded", refreshedInvoices, {
        total: refreshedInvoices.length,
        page: 1,
        pages: 1,
      });
    }
  }

  return successResponse(res, 200, "Billing invoices loaded successfully", invoices, {
    total: count,
    page: Number(page),
    pages: Math.ceil(count / limit),
  });
});

/**
 * Create a new billing invoice charge
 */
const createInvoice = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const { patientId, category, itemName, amount } = req.body;

  if (!patientId || !itemName || amount === undefined || amount < 0) {
    throw new AppError("Invalid inputs provided for billing invoice generation", 400);
  }

  const patient = await User.findById(patientId);
  if (!patient || patient.role !== "PATIENT" || patient.status !== "ACTIVE") {
    throw new AppError("Cannot generate billing invoice. The patient profile is inactive.", 400);
  }

  const count = await BillingInvoice.countDocuments({ hospital: hospitalId });
  const billNumber = `INV-${new Date().getFullYear()}-${10001 + count}`;

  const invoice = await BillingInvoice.create({
    hospital: hospitalId,
    patient: patientId,
    category,
    itemName,
    amount: amount || 0,
    paymentStatus: "UNPAID",
    billNumber,
    processedBy: req.user._id,
  });

  // Emit event via Socket.IO
  const io = req.app.get("io");
  if (io) {
    io.emit("billing:new_charge", {
      invoiceId: invoice._id,
      patientId,
      billNumber,
      amount,
      category,
    });
  }

  // Log audit activity
  await auditLogService.logActivity(req, {
    module: "BILLING",
    action: "CREATE_INVOICE",
    details: `Generated custom charge invoice '${itemName}' of ₹${amount} for patient`,
    targetId: invoice._id.toString(),
    targetName: billNumber
  });

  return successResponse(res, 201, "Billing charge invoice generated in INR (₹)", invoice);
});

/**
 * Settle unpaid invoice payment (supports Cash, Card, UPI, Insurance, and Partial Payments)
 */
const payInvoice = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const { paymentMethod, amountPaidThisTime, transactionId } = req.body;

  if (!paymentMethod || !amountPaidThisTime || amountPaidThisTime <= 0) {
    throw new AppError("Please provide a valid payment method and amount.", 400);
  }

  const invoice = await BillingInvoice.findOne({ _id: req.params.id, hospital: hospitalId })
    .populate("patient", "firstName lastName uhid status");

  if (!invoice) {
    throw new AppError("Billing invoice not found", 404);
  }

  if (invoice.patient && invoice.patient.status !== "ACTIVE") {
    throw new AppError("Cannot process payment. The patient profile is inactive.", 400);
  }

  if (invoice.paymentStatus === "PAID") {
    throw new AppError("This invoice is already fully paid", 400);
  }

  const remainingDue = invoice.amount - invoice.amountPaid;
  if (amountPaidThisTime > remainingDue) {
    throw new AppError(`Cannot pay more than the remaining due amount of ₹${remainingDue}`, 400);
  }

  // Record transaction log
  invoice.transactions.push({
    amount: amountPaidThisTime,
    paymentMethod,
    date: new Date(),
    transactionId: transactionId || "",
  });

  invoice.amountPaid += amountPaidThisTime;
  invoice.paymentMethod = paymentMethod; // Last used payment method
  invoice.processedBy = req.user._id;

  await invoice.save();

  // Socket notification
  const io = req.app.get("io");
  if (io) {
    io.emit("billing:update", {
      invoiceId: invoice._id,
      billNumber: invoice.billNumber,
      amountPaid: invoice.amountPaid,
      amountDue: invoice.amountDue,
      paymentStatus: invoice.paymentStatus,
    });
  }

  // Log audit activity
  await auditLogService.logActivity(req, {
    module: "BILLING",
    action: "PAY_INVOICE",
    details: `Collected transaction payment of ₹${amountPaidThisTime} via ${paymentMethod} (Status: ${invoice.paymentStatus}) for patient ${invoice.patient?.firstName || "Unknown"} ${invoice.patient?.lastName || ""}`,
    targetId: invoice._id.toString(),
    targetName: invoice.billNumber
  });

  return successResponse(res, 200, `Payment of ₹${amountPaidThisTime} processed successfully. Status: ${invoice.paymentStatus}`, invoice);
});

/**
 * Settle invoice refund
 */
const refundInvoice = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const { refundReason } = req.body;

  const invoice = await BillingInvoice.findOne({ _id: req.params.id, hospital: hospitalId });
  if (!invoice) {
    throw new AppError("Billing invoice not found", 404);
  }

  if (invoice.paymentStatus !== "PAID" && invoice.paymentStatus !== "PARTIAL") {
    throw new AppError("Only fully or partially paid invoices can be refunded", 400);
  }

  invoice.paymentStatus = "REFUNDED";
  invoice.refundReason = refundReason || "Customer request";
  invoice.amountPaid = 0;
  await invoice.save();

  // Socket notification
  const io = req.app.get("io");
  if (io) {
    io.emit("billing:update", {
      invoiceId: invoice._id,
      billNumber: invoice.billNumber,
      paymentStatus: invoice.paymentStatus,
    });
  }

  // Log audit activity
  await auditLogService.logActivity(req, {
    module: "BILLING",
    action: "REFUND_INVOICE",
    details: `Refunded billing invoice amount of ₹${invoice.amount} for reason: ${refundReason}`,
    targetId: invoice._id.toString(),
    targetName: invoice.billNumber
  });

  return successResponse(res, 200, "Billing invoice amount refunded successfully", invoice);
});

/**
 * Fetch patient unpaid integrations (Lab requests, Pharmacy Bills, Receptionist appointment bills)
 */
const getPatientUnpaidCharges = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const { patientId } = req.params;

  const [pharmacyBills, labRequests, apptInvoices] = await Promise.all([
    PharmacyBill.find({ patient: patientId, hospital: hospitalId, paymentStatus: "UNPAID" }),
    LabRequest.find({ patient: patientId, hospital: hospitalId, status: { $ne: "REJECTED" } }), // We will filter those without billing records manually below
    Invoice.find({ patient: patientId, hospital: hospitalId, paymentStatus: "UNPAID" }),
  ]);

  // For lab requests: find lab requests that do NOT have a BillingInvoice generated yet
  const generatedLabInvoices = await BillingInvoice.find({
    patient: patientId,
    hospital: hospitalId,
    category: "LAB"
  }).select("itemName");

  const generatedLabNames = generatedLabInvoices.map((inv) => inv.itemName.toLowerCase());

  const pendingLabs = labRequests.filter((lab) => {
    // If the lab request testName is not found in generated lab charges, it's unpaid
    const matches = generatedLabNames.some((name) => name.includes(lab.testName.toLowerCase()));
    return !matches;
  }).map((lab) => ({
    _id: lab._id,
    itemName: `${lab.testName} Lab Diagnostics`,
    category: "LAB",
    amount: getLabTestPrice(lab.testName),
    createdAt: lab.createdAt
  }));

  const pendingPharmacy = pharmacyBills.map((bill) => ({
    _id: bill._id,
    itemName: `Pharmacy Order #${bill.billNumber}`,
    category: "PHARMACY",
    amount: bill.totalAmount,
    createdAt: bill.createdAt
  }));

  const pendingConsultation = apptInvoices.map((inv) => ({
    _id: inv._id,
    itemName: `Doctor Consultation (Invoice: ${inv.invoiceNumber})`,
    category: "CONSULTATION",
    amount: inv.billAmount,
    createdAt: inv.createdAt
  }));

  return successResponse(res, 200, "Patient unpaid billing integrations loaded", {
    pharmacy: pendingPharmacy,
    labs: pendingLabs,
    consultation: pendingConsultation,
    totalCount: pendingPharmacy.length + pendingLabs.length + pendingConsultation.length
  });
});

/**
 * Record an advance credit deposit
 */
const createAdvancePayment = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const { patientId, amount, paymentMethod, notes } = req.body;

  if (!patientId || !amount || amount <= 0 || !paymentMethod) {
    throw new AppError("Invalid advance payment details. Please supply patient, amount, and mode.", 400);
  }

  const patient = await User.findById(patientId);
  if (!patient || patient.role !== "PATIENT" || patient.status !== "ACTIVE") {
    throw new AppError("Cannot record advance payment. The patient profile is inactive.", 400);
  }

  const count = await AdvancePayment.countDocuments({ hospital: hospitalId });
  const receiptNumber = `ADV-${new Date().getFullYear()}-${20001 + count}`;

  const advance = await AdvancePayment.create({
    hospital: hospitalId,
    patient: patientId,
    amount,
    paymentMethod,
    receiptNumber,
    notes: notes || "Credit deposit",
    processedBy: req.user._id,
  });

  // Emit event via Socket.IO
  const io = req.app.get("io");
  if (io) {
    io.emit("billing:advance", {
      patientId,
      receiptNumber,
      amount,
      paymentMethod,
    });
  }

  // Log audit activity
  await auditLogService.logActivity(req, {
    module: "BILLING",
    action: "CREATE_ADVANCE",
    details: `Recorded patient advance deposit of ₹${amount} via ${paymentMethod}`,
    targetId: advance._id.toString(),
    targetName: receiptNumber
  });

  return successResponse(res, 201, "Advance payment deposited and credited to ledger", advance);
});

/**
 * Calculate patient active advance balance
 */
const getPatientAdvanceBalance = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const { patientId } = req.params;

  // Sum of all advance deposits
  const deposits = await AdvancePayment.find({ patient: patientId, hospital: hospitalId });
  const totalDeposits = deposits.reduce((acc, curr) => acc + curr.amount, 0);

  // Sum of all advances deducted in discharge bills
  const dischargeBills = await BillingInvoice.find({
    patient: patientId,
    hospital: hospitalId,
    category: "DISCHARGE",
    paymentStatus: { $ne: "REFUNDED" }
  });
  const totalDeductions = dischargeBills.reduce((acc, curr) => acc + (curr.dischargeDetails?.advanceDeducted || 0), 0);

  const balance = totalDeposits - totalDeductions;

  return successResponse(res, 200, "Patient active advance credit balance loaded", {
    totalDeposits,
    totalDeductions,
    balance: balance > 0 ? balance : 0,
    ledger: deposits
  });
});

/**
 * Compile discharge summary detail calculation
 */
const getDischargeSummary = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const { patientId } = req.params;

  // 1) Find the active admission record
  const admission = await AdmissionRecord.findOne({
    patient: patientId,
    hospital: hospitalId,
    status: "ADMITTED"
  });

  if (!admission) {
    throw new AppError("No active inpatient admission record found for this patient", 404);
  }

  // Calculate occupied days (minimum 1 day)
  const admissionDate = new Date(admission.admissionDate);
  const now = new Date();
  const diffTime = Math.abs(now - admissionDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

  // Bed pricing tier
  let bedRate = 1000; // General
  const ward = (admission.wardNo || "").toUpperCase();
  if (ward.includes("ICU")) bedRate = 5000;
  else if (ward.includes("PRIVATE")) bedRate = 2500;
  
  const roomCharges = diffDays * bedRate;

  // 2) Fetch outstanding pharmacy and lab charges
  const [pharmacyBills, labRequests, apptInvoices] = await Promise.all([
    PharmacyBill.find({ patient: patientId, hospital: hospitalId, paymentStatus: "UNPAID" }),
    LabRequest.find({ patient: patientId, hospital: hospitalId, status: "COMPLETED" }),
    Invoice.find({ patient: patientId, hospital: hospitalId, paymentStatus: "UNPAID" })
  ]);

  // Filter lab requests that haven't been invoiced
  const generatedLabInvoices = await BillingInvoice.find({
    patient: patientId,
    hospital: hospitalId,
    category: "LAB"
  }).select("itemName");
  const generatedLabNames = generatedLabInvoices.map((inv) => inv.itemName.toLowerCase());
  
  const unpaidLabs = labRequests.filter((lab) => {
    const matches = generatedLabNames.some((name) => name.includes(lab.testName.toLowerCase()));
    return !matches;
  });

  const pharmacyCharges = pharmacyBills.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const labCharges = unpaidLabs.reduce((acc, curr) => acc + getLabTestPrice(curr.testName), 0);
  const consultationCharges = apptInvoices.reduce((acc, curr) => acc + curr.billAmount, 0);

  // 3) Fetch advance payment balance
  const deposits = await AdvancePayment.find({ patient: patientId, hospital: hospitalId });
  const totalDeposits = deposits.reduce((acc, curr) => acc + curr.amount, 0);
  const dischargeBills = await BillingInvoice.find({
    patient: patientId,
    hospital: hospitalId,
    category: "DISCHARGE",
    paymentStatus: { $ne: "REFUNDED" }
  });
  const totalDeductions = dischargeBills.reduce((acc, curr) => acc + (curr.dischargeDetails?.advanceDeducted || 0), 0);
  const advanceBalance = totalDeposits - totalDeductions;

  const totalAmount = roomCharges + pharmacyCharges + labCharges + consultationCharges;

  return successResponse(res, 200, "Discharge summary calculated", {
    admissionId: admission._id,
    admissionDate: admission.admissionDate,
    occupiedDays: diffDays,
    bedNo: admission.bedNo,
    wardNo: admission.wardNo,
    bedRate,
    roomCharges,
    pharmacyCharges,
    labCharges,
    consultationCharges,
    advanceBalance: advanceBalance > 0 ? advanceBalance : 0,
    totalAmount,
    unpaidPharmacyIds: pharmacyBills.map((b) => b._id),
    unpaidLabIds: unpaidLabs.map((l) => l._id),
    unpaidConsultationIds: apptInvoices.map((c) => c._id)
  });
});

/**
 * Generate discharge bill final invoice
 */
const generateDischargeBill = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const {
    patientId,
    admissionId,
    roomCharges,
    labCharges,
    pharmacyCharges,
    consultationCharges,
    insuranceCovered,
    advanceDeducted,
    amount,
    amountPaid,
    paymentMethod,
    transactionId
  } = req.body;

  if (!patientId || !admissionId || amount === undefined) {
    throw new AppError("Invalid inputs for discharge billing generation", 400);
  }

  const patient = await User.findById(patientId);
  if (!patient || patient.role !== "PATIENT" || patient.status !== "ACTIVE") {
    throw new AppError("Cannot generate discharge bill. The patient profile is inactive.", 400);
  }

  const count = await BillingInvoice.countDocuments({ hospital: hospitalId });
  const billNumber = `DIS-${new Date().getFullYear()}-${30001 + count}`;

  // Log initial transaction if paid
  const transactions = [];
  if (amountPaid > 0) {
    transactions.push({
      amount: amountPaid,
      paymentMethod: paymentMethod || "CASH",
      date: new Date(),
      transactionId: transactionId || ""
    });
  }

  const finalInvoice = await BillingInvoice.create({
    hospital: hospitalId,
    patient: patientId,
    category: "DISCHARGE",
    itemName: "Final Inpatient Discharge Clearance Bill",
    amount,
    amountPaid,
    paymentStatus: amountPaid >= amount ? "PAID" : (amountPaid > 0 ? "PARTIAL" : "UNPAID"),
    paymentMethod: paymentMethod || "N/A",
    transactions,
    billNumber,
    processedBy: req.user._id,
    isDischargeBill: true,
    dischargeDetails: {
      admissionId,
      roomCharges: roomCharges || 0,
      labCharges: labCharges || 0,
      pharmacyCharges: pharmacyCharges || 0,
      consultationCharges: consultationCharges || 0,
      insuranceCovered: insuranceCovered || 0,
      advanceDeducted: advanceDeducted || 0
    }
  });

  // Mark AdmissionRecord as DISCHARGED
  await AdmissionRecord.findByIdAndUpdate(admissionId, {
    status: "DISCHARGED",
    dischargeDate: new Date()
  });

  // Settle underlying pharmacy bills, lab reports, and appointments if discharge is fully finalized
  // Note: For simpler simulation, we will mark outstanding pharmacy bills paid and labs closed
  await Promise.all([
    PharmacyBill.updateMany({ patient: patientId, hospital: hospitalId, paymentStatus: "UNPAID" }, { paymentStatus: "PAID", paymentMethod: paymentMethod || "CASH" }),
    Invoice.updateMany({ patient: patientId, hospital: hospitalId, paymentStatus: "UNPAID" }, { paymentStatus: "PAID", paymentMethod: paymentMethod || "CASH" }),
  ]);

  // Emit event via Socket.IO
  const io = req.app.get("io");
  if (io) {
    io.emit("billing:discharge", {
      patientId,
      billNumber,
      amount,
      status: finalInvoice.paymentStatus
    });
  }

  // Log audit activity
  await auditLogService.logActivity(req, {
    module: "BILLING",
    action: "DISCHARGE",
    details: `Finalized inpatient discharge billing clearance of ₹${amount} (Advance applied: ₹${advanceDeducted}, Insurance covered: ₹${insuranceCovered})`,
    targetId: finalInvoice._id.toString(),
    targetName: billNumber
  });

  return successResponse(res, 201, "Final inpatient discharge bill generated and settled", finalInvoice);
});

/**
 * Fetch daily cash collection reports for shift clearance
 */
const getDailyCashReport = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const { date } = req.query;

  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

  // Find all invoices containing transactions today
  const invoices = await BillingInvoice.find({
    hospital: hospitalId,
    "transactions.date": { $gte: startOfDay, $lte: endOfDay }
  }).populate("patient", "firstName lastName uhid");

  let totalCash = 0;
  let totalCard = 0;
  let totalUPI = 0;
  let totalInsurance = 0;
  const reportTransactions = [];

  invoices.forEach((inv) => {
    inv.transactions.forEach((tx) => {
      if (tx.date >= startOfDay && tx.date <= endOfDay) {
        if (tx.paymentMethod === "CASH") totalCash += tx.amount;
        if (tx.paymentMethod === "CARD") totalCard += tx.amount;
        if (tx.paymentMethod === "UPI") totalUPI += tx.amount;
        if (tx.paymentMethod === "INSURANCE") totalInsurance += tx.amount;

        reportTransactions.push({
          billNumber: inv.billNumber,
          patientName: inv.patient ? `${inv.patient.firstName} ${inv.patient.lastName}` : "Walk-in Patient",
          uhid: inv.patient?.uhid || "N/A",
          category: inv.category,
          amount: tx.amount,
          paymentMethod: tx.paymentMethod,
          date: tx.date,
          transactionId: tx.transactionId
        });
      }
    });
  });

  const totalCollected = totalCash + totalCard + totalUPI + totalInsurance;

  return successResponse(res, 200, "Daily cash collection report generated in INR (₹)", {
    date: startOfDay.toISOString().split("T")[0],
    totalCollected,
    totalCash,
    totalCard,
    totalUPI,
    totalInsurance,
    transactions: reportTransactions
  });
});

module.exports = {
  getDashboardStats,
  getInvoices,
  createInvoice,
  payInvoice,
  refundInvoice,
  getPatientUnpaidCharges,
  createAdvancePayment,
  getPatientAdvanceBalance,
  getDischargeSummary,
  generateDischargeBill,
  getDailyCashReport
};
