const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Load backend env config
dotenv.config({ path: path.join(__dirname, "../.env") });

const User = require("../src/models/userModel");
const Hospital = require("../src/models/hospitalModel");
const { Appointment, AdmissionRecord } = require("../src/models/receptionModel");
const { VitalsRecord, MedicationRecord, DoctorInstruction, NursingNote, LabRequest, Consultation, DischargeRecord } = require("../src/models/clinicalModel");
const { Medicine } = require("../src/models/pharmacyModel");
const Invoice = require("../src/models/receptionModel").Invoice || mongoose.model("Invoice");
const { BillingInvoice } = require("../src/models/billingModel");

const seedMockData = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("MONGO_URI is missing from environmental parameters!");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected successfully to database...");

    // 1. Get or create a hospital
    let hospital = await Hospital.findOne();
    if (!hospital) {
      hospital = await Hospital.create({
        name: "MediCore General Hospital",
        code: "MCH",
        location: "123 Healthcare Blvd, Medical District",
        status: "ACTIVE",
        logoUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="%234f46e5"/><path d="M12 6v12M6 12h12" stroke="white" stroke-width="3.5" stroke-linecap="round"/></svg>`,
      });
      console.log("Seeded default hospital:", hospital.name);
    }
    const hospitalId = hospital._id;

    // 2. Clear old test users, admissions, invoices, lab requests, stock, alerts
    await User.deleteMany({ role: { $in: ["DOCTOR", "NURSE", "LAB_TECHNICIAN", "PHARMACIST", "CASHIER", "PATIENT", "RECEPTIONIST", "ADMIN"] } });
    await Appointment.deleteMany({ hospital: hospitalId });
    await AdmissionRecord.deleteMany({ hospital: hospitalId });
    await VitalsRecord.deleteMany({ hospital: hospitalId });
    await MedicationRecord.deleteMany({ hospital: hospitalId });
    await DoctorInstruction.deleteMany({ hospital: hospitalId });
    await NursingNote.deleteMany({ hospital: hospitalId });
    await LabRequest.deleteMany({ hospital: hospitalId });
    await Consultation.deleteMany({ hospital: hospitalId });
    await DischargeRecord.deleteMany({ hospital: hospitalId });
    await Medicine.deleteMany({ hospital: hospitalId });
    await Invoice.deleteMany({ hospital: hospitalId });
    await BillingInvoice.deleteMany({ hospital: hospitalId });
    console.log("Cleared old mock records successfully from MongoDB.");

    // 3. Create staff users
    // Admin (Saiteja)
    const saiteja = await User.create({
      firstName: "Saiteja", lastName: "Kims", email: "saiteja@gmail.com", password: "saiteja123",
      mobile: "9988776655", gender: "MALE", role: "ADMIN", hospital: hospitalId, status: "ACTIVE"
    });
    const salteja = await User.create({
      firstName: "Saiteja Typo", lastName: "Kims", email: "salteja@gmail.com", password: "saiteja123",
      mobile: "9988776654", gender: "MALE", role: "ADMIN", hospital: hospitalId, status: "ACTIVE"
    });
    const admin = await User.create({
      firstName: "James", lastName: "Admin", email: "admin@gmail.com", password: "password123",
      mobile: "9111111111", gender: "MALE", role: "ADMIN", hospital: hospitalId, status: "ACTIVE"
    });
    // Doctor
    const doctor = await User.create({
      firstName: "Kushi", lastName: "Doctor", email: "kushi@gmail.com", password: "kushi123",
      mobile: "7777777777", gender: "FEMALE", role: "DOCTOR", hospital: hospitalId, status: "ACTIVE",
      department: "Cardiology", availability: { days: ["Monday", "Tuesday", "Wednesday", "Friday"], startTime: "09:00 AM", endTime: "05:00 PM" }
    });
    // Nurse
    const nurse = await User.create({
      firstName: "Hook", lastName: "Nurse", email: "hook@gmail.com", password: "hook123",
      mobile: "5555555555", gender: "FEMALE", role: "NURSE", hospital: hospitalId, status: "ACTIVE"
    });
    // Lab Tech
    const labTech = await User.create({
      firstName: "Nop", lastName: "Technician", email: "nop@gmail.com", password: "nop123",
      mobile: "3333333333", gender: "MALE", role: "LAB_TECHNICIAN", hospital: hospitalId, status: "ACTIVE"
    });
    // Pharmacist
    const pharmacist = await User.create({
      firstName: "Hit", lastName: "Pharmacist", email: "hit@gmail.com", password: "hit123",
      mobile: "2222222222", gender: "MALE", role: "PHARMACIST", hospital: hospitalId, status: "ACTIVE"
    });
    // Cashier
    const cashier = await User.create({
      firstName: "Coo", lastName: "Cashier", email: "coo@gmail.com", password: "coo123",
      mobile: "4444444444", gender: "MALE", role: "CASHIER", hospital: hospitalId, status: "ACTIVE"
    });
    // Receptionist
    const receptionist = await User.create({
      firstName: "Nandhika", lastName: "Receptionist", email: "nandhika@gmail.com", password: "nandhika123",
      mobile: "6666666666", gender: "FEMALE", role: "RECEPTIONIST", hospital: hospitalId, status: "ACTIVE"
    });
    console.log("Seeded employee roster successfully.");

    // 4. Create Patients
    const patient1 = await User.create({
      firstName: "Pravalika", lastName: "Pendam", email: "pravalika@gmail.com", password: "password123",
      mobile: "9888888881", gender: "FEMALE", role: "PATIENT", hospital: hospitalId, status: "ACTIVE",
      uhid: "UHID-2026-9091", roomNo: "101", bedNo: "Bed A", assignedDoctor: doctor._id, bloodGroup: "O+", emergencyContact: "9888888801",
      allergies: ["Penicillin"], chronicDiseases: ["Asthma"]
    });

    const patient2 = await User.create({
      firstName: "Steve", lastName: "Rogers", email: "steve@gmail.com", password: "password123",
      mobile: "9888888882", gender: "MALE", role: "PATIENT", hospital: hospitalId, status: "ACTIVE",
      uhid: "UHID-2026-9092", roomNo: "106", bedNo: "Bed A", assignedDoctor: doctor._id, bloodGroup: "A+", emergencyContact: "9888888802",
      allergies: ["Sulfonamides"], chronicDiseases: ["Hypertension"]
    });

    const patient3 = await User.create({
      firstName: "Bruce", lastName: "Wayne", email: "bruce@gmail.com", password: "password123",
      mobile: "9888888883", gender: "MALE", role: "PATIENT", hospital: hospitalId, status: "ACTIVE",
      uhid: "UHID-2026-9093", roomNo: "102", bedNo: "Bed B", assignedDoctor: doctor._id, bloodGroup: "O-", emergencyContact: "9888888803",
      allergies: [], chronicDiseases: []
    });
    console.log("Seeded patients successfully.");

    // 5. Create Admissions Records (Uses wardNo instead of roomNo to pass validations)
    await AdmissionRecord.create([
      { hospital: hospitalId, patient: patient1._id, wardNo: "101", bedNo: "Bed A", admittedAt: new Date(), status: "ADMITTED", department: "General Medicine" },
      { hospital: hospitalId, patient: patient2._id, wardNo: "106", bedNo: "Bed A", admittedAt: new Date(), status: "ADMITTED", department: "ICU" },
      { hospital: hospitalId, patient: patient3._id, wardNo: "102", bedNo: "Bed B", admittedAt: new Date(), status: "ADMITTED", department: "General Medicine" }
    ]);
    console.log("Seeded admission warded stays.");

    // 6. Seed Inpatient & Outpatient Invoices (INR)
    // Consultation invoices (Outpatient / Receptionist)
    await Invoice.create([
      { patient: patient1._id, doctor: doctor._id, hospital: hospitalId, billAmount: 500, paymentStatus: "PAID", invoiceNumber: "INV-2026-10001", paymentMethod: "UPI" },
      { patient: patient2._id, doctor: doctor._id, hospital: hospitalId, billAmount: 500, paymentStatus: "UNPAID", invoiceNumber: "INV-2026-10002", paymentMethod: "N/A" },
      { patient: patient3._id, doctor: doctor._id, hospital: hospitalId, billAmount: 500, paymentStatus: "UNPAID", invoiceNumber: "INV-2026-10003", paymentMethod: "N/A" }
    ]);

    // Cashier Inpatient Invoices (Uses category "OTHER" for room charges)
    await BillingInvoice.create([
      { hospital: hospitalId, patient: patient1._id, category: "CONSULTATION", itemName: "Dr. Kushi - Cardiology Consultation", amount: 500, paymentStatus: "UNPAID", billNumber: "INV-2026-00101-9091" },
      { hospital: hospitalId, patient: patient1._id, category: "LAB", itemName: "Lipid Profile Diagnostic Panel", amount: 1500, paymentStatus: "UNPAID", billNumber: "INV-2026-00102-9091" },
      { hospital: hospitalId, patient: patient2._id, category: "PHARMACY", itemName: "Cardiology beta-blockers prescription", amount: 850, paymentStatus: "UNPAID", billNumber: "INV-2026-00103-9092" },
      { hospital: hospitalId, patient: patient3._id, category: "OTHER", itemName: "General Ward stay - Room 102 Bed B", amount: 2000, paymentStatus: "PAID", billNumber: "INV-2026-00104-9093", paymentMethod: "CARD" }
    ]);
    console.log("Seeded billing invoices.");

    // 7. Seed vitals (this creates the Critical Alarm alert on the fly for Steve Rogers in ICU Room 106 Bed A)
    await VitalsRecord.create({
      hospital: hospitalId,
      patient: patient2._id,
      temperature: "99.1",
      bp: "145/95",
      heartRate: 105,
      spo2: 88,
      respiratoryRate: 24,
      sugar: 140,
      recordedBy: nurse._id
    });
    console.log("Seeded patient2 vitals record (spo2: 88) triggering vital alarm.");

    // 8. Seed Pharmacy Low Stock Drugs
    await Medicine.create([
      { hospital: hospitalId, name: "Paracetamol", batchNumber: "B-PAR-2026", price: 15, stock: 5, expiryDate: new Date(Date.now() + 180 * 24 * 3600 * 1000) },
      { hospital: hospitalId, name: "Amoxicillin", batchNumber: "B-AMX-2026", price: 45, stock: 8, expiryDate: new Date(Date.now() + 90 * 24 * 3600 * 1000) },
      { hospital: hospitalId, name: "Ibuprofen 400mg", batchNumber: "B-IBU-2026", price: 20, stock: 3, expiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000) },
      { hospital: hospitalId, name: "Atorvastatin 10mg", batchNumber: "B-ATV-2026", price: 120, stock: 80, expiryDate: new Date(Date.now() + 400 * 24 * 3600 * 1000) }
    ]);
    console.log("Seeded pharmacy inventories.");

    // 9. Seed clinical consultations
    await Consultation.create({
      hospital: hospitalId,
      patient: patient2._id,
      doctor: doctor._id,
      diagnosis: "Acute hypertensive response with chest tightness",
      clinicalNotes: "Administered beta-blockers. Patient is resting in Room 106 Bed A. Vitals stabilizing but require close oxygen monitoring.",
      followUpDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      physicianSigned: true,
      signedAt: new Date()
    });
    console.log("Seeded clinical diagnostic logs.");

    console.log("Seeding complete! All dummy patient profiles warded stays w/ vital red alerts initialized.");
    process.exit(0);
  } catch (err) {
    console.error("Failed to seed mock data:", err);
    process.exit(1);
  }
};

seedMockData();
