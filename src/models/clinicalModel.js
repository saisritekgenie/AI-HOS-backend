const mongoose = require("mongoose");
const { encryptText, decryptText } = require("../utils/encryption");

// 1. Vitals Record Schema
const vitalsSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    temperature: { type: String, default: "N/A", get: decryptText, set: encryptText },
    bp: { type: String, default: "N/A", get: decryptText, set: encryptText },
    heartRate: { type: Number, default: null },
    spo2: { type: Number, default: null },
    respiratoryRate: { type: Number, default: null },
    weight: { type: Number, default: null },
    sugar: { type: Number, default: null },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { 
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
  }
);

// 2. Medication Record Schema
const medicationSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    medicationName: { type: String, required: true, get: decryptText, set: encryptText },
    dosage: { type: String, required: true, get: decryptText, set: encryptText },
    frequency: { type: String, required: true, get: decryptText, set: encryptText },
    prescribedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "GIVEN", "SKIPPED", "DISPENSED"],
      default: "PENDING",
    },
    givenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    givenAt: { type: Date },
  },
  { 
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
  }
);

// 3. Doctor Instruction Schema
const doctorInstructionSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    instruction: { type: String, required: true, get: decryptText, set: encryptText },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "MEDIUM",
    },
    prescribedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED"],
      default: "PENDING",
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    completedAt: { type: Date },
  },
  { 
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
  }
);

// 4. Nursing Note Schema
const nursingNoteSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    note: { type: String, required: true, get: decryptText, set: encryptText },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { 
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
  }
);

// 5. Lab Request Schema
const labRequestSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    testName: { type: String, required: true, get: decryptText, set: encryptText },
    prescribedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED", "SAMPLE_COLLECTED", "COMPLETED"],
      default: "PENDING",
    },
    sampleCollectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    sampleCollectedAt: { type: Date },
    results: { type: String, get: decryptText, set: encryptText },
    reportFile: { type: String },
    rejectionReason: { type: String },
    isEmergency: { type: Boolean, default: false },
  },
  { 
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
  }
);

// 6. Consultation Schema
const consultationSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    diagnosis: { type: String, required: true, get: decryptText, set: encryptText },
    clinicalNotes: { type: String, default: "", get: decryptText, set: encryptText },
    followUpDate: { type: Date },
    // Clinical verification log fields for safety audit sign-offs
    physicianSigned: { type: Boolean, default: false },
    signedAt: { type: Date }
  },
  { 
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
  }
);

const VitalsRecord = mongoose.model("VitalsRecord", vitalsSchema);
const MedicationRecord = mongoose.model("MedicationRecord", medicationSchema);
const DoctorInstruction = mongoose.model("DoctorInstruction", doctorInstructionSchema);
const NursingNote = mongoose.model("NursingNote", nursingNoteSchema);
const LabRequest = mongoose.model("LabRequest", labRequestSchema);
const Consultation = mongoose.model("Consultation", consultationSchema);

// 7. Discharge Record Schema
const dischargeRecordSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dischargeSummary: {
      type: String,
      required: true,
      get: decryptText,
      set: encryptText,
    },
    billingCleared: {
      type: Boolean,
      default: false,
    },
    takeHomeMedications: [
      {
        medicationName: { type: String, required: true },
        dosage: { type: String, required: true },
        frequency: { type: String, required: true },
      },
    ],
    dischargedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

const DischargeRecord = mongoose.model("DischargeRecord", dischargeRecordSchema);

module.exports = {
  VitalsRecord,
  MedicationRecord,
  DoctorInstruction,
  NursingNote,
  LabRequest,
  Consultation,
  DischargeRecord,
};
