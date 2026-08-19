const mongoose = require("mongoose");

/**
 * Connect to MongoDB database using Mongoose
 */
const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ai_hospital_db";
  const localFallbackUri = "mongodb://127.0.0.1:27017/ai_hospital_db";
  
  try {
    console.log("🍃 Attempting to connect to primary MongoDB...");
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`🍃 MongoDB Connected: ${conn.connection.host}`);
    await seedSuperAdmin();
  } catch (error) {
    console.warn(`⚠️ Primary MongoDB connection failed: ${error.message}`);
    if (mongoUri !== localFallbackUri) {
      console.log("🍃 Attempting connection to local MongoDB fallback...");
      try {
        const conn = await mongoose.connect(localFallbackUri, {
          serverSelectionTimeoutMS: 3000
        });
        console.log(`🍃 Local MongoDB Connected: ${conn.connection.host}`);
        await seedSuperAdmin();
      } catch (fallbackError) {
        console.error(`❌ Local fallback also failed: ${fallbackError.message}`);
        throw new Error(`Primary DB: ${error.message} | Local DB: ${fallbackError.message}`);
      }
    } else {
      throw error;
    }
  }
};

const seedSuperAdmin = async () => {
  // Auto-seed default Super Admin if none exists
  const User = require("../models/userModel");
  const superAdminExists = await User.findOne({ role: "SUPER_ADMIN" });
  if (!superAdminExists) {
    console.log("🛠️ Seeding default Super Admin user...");
    await User.create({
      firstName: "Super",
      lastName: "Admin",
      mobile: "9999999999",
      email: "superadmin@gmail.com",
      password: "superadmin123",
      gender: "MALE",
      role: "SUPER_ADMIN",
      status: "ACTIVE"
    });
    console.log("✅ Default Super Admin seeded: superadmin@gmail.com / superadmin123");
  }
};

const seedDemoData = async () => {
  const User = require("../models/userModel");
  const Hospital = require("../models/hospitalModel");
  const { AdmissionRecord, Appointment } = require("../models/receptionModel");
  const { VitalsRecord, LabRequest, Consultation, DischargeRecord } = require("../models/clinicalModel");

  // 1. Seed Hospital
  let hospital = await Hospital.findOne();
  if (!hospital) {
    console.log("🛠️ Seeding default Hospital...");
    hospital = await Hospital.create({
      name: "KIMS Hospital",
      code: "KIMS",
      location: "City Center",
      status: "ACTIVE"
    });
  } else {
    hospital.name = "KIMS Hospital";
    hospital.code = "KIMS";
    await hospital.save();
  }

  // 2. Check if doctors/patients exist
  const robertExists = await User.findOne({ firstName: "Robert", lastName: "Pattinson", role: "PATIENT" });
  if (!robertExists) {
    console.log("🛠️ Seeding demo users and hospital flow records...");

    // Clear old data to prevent duplicate keys and clean up database
    await Promise.all([
      User.deleteMany({ role: { $ne: "SUPER_ADMIN" } }),
      AdmissionRecord.deleteMany({}),
      Appointment.deleteMany({}),
      VitalsRecord.deleteMany({}),
      LabRequest.deleteMany({}),
      Consultation.deleteMany({}),
      DischargeRecord.deleteMany({})
    ]);

    // Create staff users
    const saiteja = await User.create({
      firstName: "Saiteja",
      lastName: "Kims",
      email: "saiteja@gmail.com",
      mobile: "9988776655",
      password: "saiteja123",
      gender: "MALE",
      role: "ADMIN",
      status: "ACTIVE",
      hospital: hospital._id
    });

    const salteja = await User.create({
      firstName: "Saiteja Typo",
      lastName: "Kims",
      email: "salteja@gmail.com",
      mobile: "9988776654",
      password: "saiteja123",
      gender: "MALE",
      role: "ADMIN",
      status: "ACTIVE",
      hospital: hospital._id
    });

    const admin = await User.create({
      firstName: "Hospital",
      lastName: "Admin",
      email: "admin@gmail.com",
      mobile: "8888888888",
      password: "admin123",
      gender: "MALE",
      role: "ADMIN",
      status: "ACTIVE",
      hospital: hospital._id
    });

    const doctor = await User.create({
      firstName: "Kushi",
      lastName: "Doctor",
      email: "kushi@gmail.com",
      mobile: "7777777777",
      password: "kushi123",
      gender: "FEMALE",
      role: "DOCTOR",
      status: "ACTIVE",
      department: "Cardiology",
      hospital: hospital._id
    });

    // Also link adminUser in hospital
    hospital.adminUser = saiteja._id;
    await hospital.save();

    const receptionist = await User.create({
      firstName: "Nandhika",
      lastName: "Receptionist",
      email: "nandhika@gmail.com",
      mobile: "6666666666",
      password: "nandhika123",
      gender: "FEMALE",
      role: "RECEPTIONIST",
      status: "ACTIVE",
      hospital: hospital._id
    });

    const nurse = await User.create({
      firstName: "Hook",
      lastName: "Nurse",
      email: "hook@gmail.com",
      mobile: "5555555555",
      password: "hook123",
      gender: "FEMALE",
      role: "NURSE",
      status: "ACTIVE",
      hospital: hospital._id
    });

    const cashier = await User.create({
      firstName: "Coo",
      lastName: "Cashier",
      email: "coo@gmail.com",
      mobile: "4444444444",
      password: "coo123",
      gender: "MALE",
      role: "CASHIER",
      status: "ACTIVE",
      hospital: hospital._id
    });

    const technician = await User.create({
      firstName: "Nop",
      lastName: "Technician",
      email: "nop@gmail.com",
      mobile: "3333333333",
      password: "nop123",
      gender: "MALE",
      role: "LAB_TECHNICIAN",
      status: "ACTIVE",
      hospital: hospital._id
    });

    const pharmacist = await User.create({
      firstName: "Hit",
      lastName: "Pharmacist",
      email: "hit@gmail.com",
      mobile: "2222222222",
      password: "hit123",
      gender: "MALE",
      role: "PHARMACIST",
      status: "ACTIVE",
      hospital: hospital._id
    });

    // Create patients
    const p1 = await User.create({
      firstName: "Robert",
      lastName: "Pattinson",
      email: "robert@gmail.com",
      mobile: "9876543210",
      password: "patient123",
      gender: "MALE",
      role: "PATIENT",
      status: "ACTIVE",
      uhid: "UHID-2026-1001",
      roomNo: "ICU Ward A",
      bedNo: "Bed 1",
      chronicDiseases: ["Hypertension"],
      allergies: ["Penicillin"],
      assignedDoctor: doctor._id,
      hospital: hospital._id
    });

    const p2 = await User.create({
      firstName: "pravalika",
      lastName: "pendam",
      email: "pravalika@gmail.com",
      mobile: "9876543211",
      password: "patient123",
      gender: "FEMALE",
      role: "PATIENT",
      status: "ACTIVE",
      uhid: "KIMS-02_W_000001",
      roomNo: "General Ward B",
      bedNo: "Bed 2",
      chronicDiseases: ["Diabetes"],
      assignedDoctor: doctor._id,
      hospital: hospital._id
    });

    // 3. Seed Admissions
    // Robert Pattinson admitted to ICU Ward A, Bed 1 (Critical)
    await AdmissionRecord.create({
      patient: p1._id,
      hospital: hospital._id,
      department: "Cardiology",
      wardNo: "ICU Ward A",
      bedNo: "Bed 1",
      status: "ADMITTED",
      admissionDate: new Date(Date.now() - 24 * 60 * 60 * 1000 * 2) // 2 days ago
    });

    // pravalika pendam admitted to General Ward B, Bed 2 (Under Treatment)
    await AdmissionRecord.create({
      patient: p2._id,
      hospital: hospital._id,
      department: "General Medicine",
      wardNo: "General Ward B",
      bedNo: "Bed 2",
      status: "ADMITTED",
      admissionDate: new Date(Date.now() - 24 * 60 * 60 * 1000 * 1) // 1 day ago
    });

    // 4. Seed Appointments
    // pravalika pendam has an appointment today with Dr. Kushi
    const today = new Date();
    await Appointment.create({
      patient: p2._id,
      doctor: doctor._id,
      hospital: hospital._id,
      appointmentDate: today,
      timeSlot: "10:00 AM",
      status: "BOOKED",
      tokenNumber: "T-101",
      notes: "Routine follow up consult",
      bookingMode: "ONLINE"
    });

    // John Doe had a completed check-in consultation yesterday
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await Appointment.create({
      patient: p1._id,
      doctor: doctor._id,
      hospital: hospital._id,
      appointmentDate: yesterday,
      timeSlot: "09:30 AM",
      status: "COMPLETED",
      tokenNumber: "T-100",
      notes: "Presented with chest discomfort",
      bookingMode: "WALK_IN",
      checkInTime: yesterday,
      completionTime: yesterday
    });

    // Create consultation for John Doe
    await Consultation.create({
      patient: p1._id,
      doctor: doctor._id,
      hospital: hospital._id,
      diagnosis: "Unstable Angina",
      clinicalNotes: "Severe cardiac risk parameters. Transferred immediately to ICU.",
      physicianSigned: true,
      signedAt: yesterday
    });

    // 5. Seed Vitals Records
    // John Doe (Critical vitals)
    await VitalsRecord.create({
      patient: p1._id,
      hospital: hospital._id,
      temperature: "101.5",
      bp: "145/95",
      heartRate: 112,
      spo2: 91, // Critical
      respiratoryRate: 24,
      weight: 78,
      sugar: 160,
      recordedBy: nurse._id
    });

    // Jane Smith (Normal vitals)
    await VitalsRecord.create({
      patient: p2._id,
      hospital: hospital._id,
      temperature: "98.6",
      bp: "120/80",
      heartRate: 72,
      spo2: 98,
      respiratoryRate: 18,
      weight: 65,
      sugar: 110,
      recordedBy: nurse._id
    });

    // 6. Seed Lab Requests / Reports
    const labRequests = [
      {
        patient: p1._id,
        hospital: hospital._id,
        testName: "ECG (Electrocardiogram)",
        prescribedBy: doctor._id,
        status: "COMPLETED",
        sampleCollectedBy: nurse._id,
        sampleCollectedAt: yesterday,
        results: "ST-Elevation in V1-V4, T-wave inversion (Critical Indicator)",
        isEmergency: true
      },
      {
        patient: p1._id,
        hospital: hospital._id,
        testName: "CBC (Complete Blood Count)",
        prescribedBy: doctor._id,
        status: "COMPLETED",
        sampleCollectedBy: nurse._id,
        sampleCollectedAt: yesterday,
        results: "Hemoglobin: 8.2 g/dL (Normal Range: 13.5-17.5) [CRITICAL LOW]; White Blood Cells: 11.5 x10^3/uL (Elevated)",
        isEmergency: true
      },
      {
        patient: p2._id,
        hospital: hospital._id,
        testName: "Blood Sugar (Fasting)",
        prescribedBy: doctor._id,
        status: "COMPLETED",
        sampleCollectedBy: nurse._id,
        sampleCollectedAt: yesterday,
        results: "Fasting Blood Sugar: 126 mg/dL (Normal Range: 70-100) [Borderline Diabetic]",
        isEmergency: false
      },
      {
        patient: p2._id,
        hospital: hospital._id,
        testName: "HbA1c Profile",
        prescribedBy: doctor._id,
        status: "COMPLETED",
        sampleCollectedBy: nurse._id,
        sampleCollectedAt: yesterday,
        results: "HbA1c: 6.4% (Normal Range: <5.7%) [Pre-diabetic Range]",
        isEmergency: false
      },
      {
        patient: p1._id,
        hospital: hospital._id,
        testName: "Lipid Profile",
        prescribedBy: doctor._id,
        status: "COMPLETED",
        sampleCollectedBy: nurse._id,
        results: "Cholesterol: 245 mg/dL (Elevated); HDL: 35 mg/dL (Low); LDL: 160 mg/dL (High)",
        isEmergency: false
      },
      {
        patient: p2._id,
        hospital: hospital._id,
        testName: "Liver Function Test",
        prescribedBy: doctor._id,
        status: "COMPLETED",
        sampleCollectedBy: nurse._id,
        results: "ALT: 38 U/L (Normal); AST: 41 U/L (Normal); Bilirubin: 0.9 mg/dL (Normal)",
        isEmergency: false
      },
      {
        patient: p1._id,
        hospital: hospital._id,
        testName: "Kidney Function Test",
        prescribedBy: doctor._id,
        status: "COMPLETED",
        sampleCollectedBy: nurse._id,
        results: "Urea: 45 mg/dL (High); Creatinine: 1.6 mg/dL (Elevated)",
        isEmergency: true
      },
      {
        patient: p2._id,
        hospital: hospital._id,
        testName: "Thyroid Profile (T3, T4, TSH)",
        prescribedBy: doctor._id,
        status: "COMPLETED",
        sampleCollectedBy: nurse._id,
        results: "TSH: 2.1 mIU/L (Normal); Free T4: 1.2 ng/dL (Normal)",
        isEmergency: false
      },
      {
        patient: p2._id,
        hospital: hospital._id,
        testName: "Urine Routine Analysis",
        prescribedBy: doctor._id,
        status: "COMPLETED",
        sampleCollectedBy: nurse._id,
        results: "pH: 6.0 (Normal); Protein: Negative; Glucose: Negative; WBC: 1-2 hpf",
        isEmergency: false
      },
      {
        patient: p1._id,
        hospital: hospital._id,
        testName: "Chest X-Ray",
        prescribedBy: doctor._id,
        status: "COMPLETED",
        results: "Mild cardiomegaly noted. Lungs clear of acute consolidations.",
        isEmergency: false
      },
      {
        patient: p1._id,
        hospital: hospital._id,
        testName: "Brain CT Scan",
        prescribedBy: doctor._id,
        status: "COMPLETED",
        results: "No intracranial hemorrhage, midline shift, or mass effect detected.",
        isEmergency: false
      },
      {
        patient: p2._id,
        hospital: hospital._id,
        testName: "MRI Lumbar Spine",
        prescribedBy: doctor._id,
        status: "COMPLETED",
        results: "L4-L5 mild disc bulge without root compression.",
        isEmergency: false
      }
    ];

    await LabRequest.create(labRequests);

    console.log("✅ Fictional demo database seeded and linked successfully!");
  }
};

module.exports = async () => {
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ai_hospital_db";
  
  console.log("🍃 Attempting to connect to primary MongoDB...");
  const conn = await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000
  });
  console.log(`🍃 MongoDB Connected: ${conn.connection.host}`);
  // Seeder scripts disabled per safety rules
  // await seedSuperAdmin();
  // await seedDemoData();
};

