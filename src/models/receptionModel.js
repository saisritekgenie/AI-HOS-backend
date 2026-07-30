const mongoose = require("mongoose");

// 1. Appointment Schema
const appointmentSchema = new mongoose.Schema(
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
    appointmentDate: {
      type: Date,
      required: true,
    },
    timeSlot: {
      type: String,
      default: "10:00 AM",
    },
    status: {
      type: String,
      enum: ["BOOKED", "CHECKED_IN", "CANCELLED", "COMPLETED"],
      default: "BOOKED",
    },
    tokenNumber: {
      type: String,
    },
    notes: {
      type: String,
      trim: true,
    },
    bookingMode: {
      type: String,
      enum: ["WALK_IN", "ONLINE"],
      default: "WALK_IN",
    },
    checkInTime: {
      type: Date,
    },
    completionTime: {
      type: Date,
    },
  },
  { timestamps: true }
);

// 2. Invoice Schema
const invoiceSchema = new mongoose.Schema(
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
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },
    billAmount: {
      type: Number,
      required: true,
      default: 500, // Standard consulting fee
    },
    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PAID"],
      default: "UNPAID",
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "CARD", "UPI", "N/A"],
      default: "N/A",
    },
  },
  { timestamps: true }
);

// 3. Inpatient Admission Schema
const admissionRecordSchema = new mongoose.Schema(
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
    department: {
      type: String,
      required: true,
      default: "General Medicine",
    },
    wardNo: {
      type: String,
      required: true,
    },
    bedNo: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["ADMITTED", "DISCHARGED"],
      default: "ADMITTED",
    },
    admissionDate: {
      type: Date,
      default: Date.now,
    },
    dischargeDate: {
      type: Date,
    },
  },
  { timestamps: true }
);

const Appointment = mongoose.model("Appointment", appointmentSchema);
const Invoice = mongoose.model("Invoice", invoiceSchema);
const AdmissionRecord = mongoose.model("AdmissionRecord", admissionRecordSchema);

module.exports = {
  Appointment,
  Invoice,
  AdmissionRecord,
};
