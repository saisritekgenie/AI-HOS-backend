const User = require("../models/userModel");
const { Medicine, PharmacyBill } = require("../models/pharmacyModel");
const { MedicationRecord } = require("../models/clinicalModel");
const auditLogService = require("../services/auditLogService");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const { successResponse } = require("../utils/apiResponse");

/**
 * Get dashboard stats for the Pharmacist role
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // 1. Pending prescriptions count
  const pendingPrescriptions = await MedicationRecord.countDocuments({
    hospital: hospitalId,
    status: "PENDING",
  });

  // 2. Low stock medicines (stock < 10)
  const lowStockCount = await Medicine.countDocuments({
    hospital: hospitalId,
    stock: { $lt: 10 },
  });

  // 3. Expiring medicines (expiry Date within next 90 days)
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 90);
  const expiringCount = await Medicine.countDocuments({
    hospital: hospitalId,
    expiryDate: { $lte: targetDate },
  });

  // 4. Total Sales (sum of paid PharmacyBills)
  const paidBills = await PharmacyBill.find({
    hospital: hospitalId,
    paymentStatus: "PAID",
  });
  const totalSales = paidBills.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

  return successResponse(res, 200, "Pharmacy dashboard stats loaded", {
    pendingPrescriptions,
    lowStockMedicines: lowStockCount,
    expiringMedicines: expiringCount,
    totalSales,
  });
});

/**
 * Fetch medicine inventory (with auto-seeding if empty)
 */
const getInventory = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  let medicines = await Medicine.find({ hospital: hospitalId }).sort({ name: 1 });

  // Auto-seed medicines if empty to make the demo work right away
  if (medicines.length === 0) {
    const today = new Date();
    const nextYear = new Date();
    nextYear.setFullYear(today.getFullYear() + 1);

    const inTwoMonths = new Date();
    inTwoMonths.setMonth(today.getMonth() + 2);

    const seedData = [
      { hospital: hospitalId, name: "Paracetamol 650mg (Calpol)", stock: 15, price: 12, expiryDate: nextYear, batchNumber: "BAT-309" },
      { hospital: hospitalId, name: "Amoxicillin 500mg (Antibiotic)", stock: 8, price: 65, expiryDate: inTwoMonths, batchNumber: "BAT-412" }, // Low Stock & Expiring!
      { hospital: hospitalId, name: "Atorvastatin 10mg (Lipitor)", stock: 45, price: 110, expiryDate: nextYear, batchNumber: "BAT-102" },
      { hospital: hospitalId, name: "Pantoprazole 40mg (Pan-D)", stock: 5, price: 18, expiryDate: nextYear, batchNumber: "BAT-880" } // Low Stock!
    ];

    await Medicine.create(seedData);
    medicines = await Medicine.find({ hospital: hospitalId }).sort({ name: 1 });
  }

  return successResponse(res, 200, "Pharmacy inventory loaded successfully", medicines);
});

/**
 * Add a new medicine type
 */
const addMedicine = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const { name, stock, price, expiryDate, batchNumber } = req.body;

  const medicine = await Medicine.create({
    hospital: hospitalId,
    name,
    stock: stock || 0,
    price: price || 0,
    expiryDate: new Date(expiryDate),
    batchNumber,
  });

  return successResponse(res, 201, "Medicine added to inventory successfully", medicine);
});

/**
 * Update stock level (Restock)
 */
const updateMedicineStock = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const { stock } = req.body;

  const medicine = await Medicine.findOne({ _id: req.params.id, hospital: hospitalId });
  if (!medicine) {
    throw new AppError("Medicine not found", 404);
  }

  medicine.stock = stock;
  await medicine.save();

  return successResponse(res, 200, "Inventory stock level updated successfully", medicine);
});

/**
 * Dispense a prescription and decrement stock quantity
 */
const dispensePrescription = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const medId = req.params.id;

  const medication = await MedicationRecord.findOne({ _id: medId, hospital: hospitalId });
  if (!medication) {
    throw new AppError("Medication prescription not found", 404);
  }

  // Update prescription status
  medication.status = "DISPENSED";
  await medication.save();

  // Try to find matching medicine in inventory to decrement stock
  const cleanName = medication.medicationName.split("(")[0].trim();
  const medicine = await Medicine.findOne({
    hospital: hospitalId,
    name: new RegExp(cleanName, "i"),
  });

  if (medicine && medicine.stock > 0) {
    medicine.stock -= 1;
    await medicine.save();
  }

  // Log audit activity
  const patient = await User.findById(medication.patient);
  await auditLogService.logActivity(req, {
    module: "PHARMACY",
    action: "DISPENSE_MEDICINE",
    details: `Dispensed prescribed medicine '${medication.medicationName}' (Dosage: ${medication.dosage})`,
    targetId: medication._id.toString(),
    targetName: patient ? `${patient.firstName} ${patient.lastName}` : "Unknown Patient"
  });

  return successResponse(res, 200, "Medication dispensed successfully and stock adjusted", medication);
});

/**
 * Fetch bills (with auto-seeding if empty)
 */
const getPharmacyBills = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  let bills = await PharmacyBill.find({ hospital: hospitalId })
    .populate("patient", "firstName lastName uhid")
    .sort({ createdAt: -1 });

  // Auto seed a bill if empty
  if (bills.length === 0) {
    const patients = await User.find({ role: "PATIENT", hospital: hospitalId });
    if (patients.length > 0) {
      const billData = [
        {
          hospital: hospitalId,
          patient: patients[0]._id,
          items: [
            { medicineName: "Paracetamol 650mg (Calpol)", quantity: 2, price: 12 },
            { medicineName: "Amoxicillin 500mg (Antibiotic)", quantity: 1, price: 65 }
          ],
          totalAmount: 89,
          paymentStatus: "PAID",
          billNumber: `BILL-${new Date().getFullYear()}-80001`,
          paymentMethod: "CASH"
        }
      ];
      await PharmacyBill.create(billData);
      bills = await PharmacyBill.find({ hospital: hospitalId })
        .populate("patient", "firstName lastName uhid")
        .sort({ createdAt: -1 });
    }
  }

  return successResponse(res, 200, "Pharmacy invoices loaded", bills);
});

/**
 * Generate pharmacy bill
 */
const generatePharmacyBill = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const { patientId, items, paymentStatus, paymentMethod } = req.body;

  const patient = await User.findById(patientId);
  if (!patient || patient.role !== "PATIENT" || patient.status !== "ACTIVE") {
    throw new AppError("Cannot generate pharmacy bill. The patient profile is inactive.", 400);
  }

  const count = await PharmacyBill.countDocuments({ hospital: hospitalId });
  const billNumber = `BILL-${new Date().getFullYear()}-${80001 + count}`;

  const totalAmount = items.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);

  const bill = await PharmacyBill.create({
    hospital: hospitalId,
    patient: patientId,
    items,
    totalAmount,
    paymentStatus: paymentStatus || "UNPAID",
    paymentMethod: paymentMethod || "N/A",
    billNumber,
  });

  return successResponse(res, 201, "Pharmacy billing invoice generated", bill);
});

/**
 * Settle bill payment
 */
const payPharmacyBill = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const { paymentMethod } = req.body;

  const bill = await PharmacyBill.findOne({ _id: req.params.id, hospital: hospitalId })
    .populate("patient");
  if (!bill) {
    throw new AppError("Invoice not found", 404);
  }

  if (bill.patient && bill.patient.status !== "ACTIVE") {
    throw new AppError("Cannot process pharmacy payment. The patient profile is inactive.", 400);
  }

  bill.paymentStatus = "PAID";
  bill.paymentMethod = paymentMethod || "UPI";
  await bill.save();

  return successResponse(res, 200, "Pharmacy bill payment processed", bill);
});

module.exports = {
  getDashboardStats,
  getInventory,
  addMedicine,
  updateMedicineStock,
  dispensePrescription,
  getPharmacyBills,
  generatePharmacyBill,
  payPharmacyBill,
};
