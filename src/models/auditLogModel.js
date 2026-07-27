const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userRole: {
      type: String,
      enum: [
        "SUPER_ADMIN",
        "ADMIN",
        "DOCTOR",
        "RECEPTIONIST",
        "NURSE",
        "LAB_TECHNICIAN",
        "PHARMACIST",
        "CASHIER",
        "PATIENT",
      ],
      required: true,
    },
    module: {
      type: String,
      required: true,
      enum: [
        "AUTH",
        "USER",
        "PATIENT",
        "APPOINTMENT",
        "CLINICAL",
        "LAB",
        "PHARMACY",
        "BILLING",
        "SETTINGS",
      ],
    },
    action: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILED"],
      required: true,
      default: "SUCCESS",
    },
    details: {
      type: String,
      required: true,
    },
    ipAddress: {
      type: String,
      default: "Unknown",
    },
    device: {
      type: String,
      default: "Unknown",
    },
    targetId: {
      type: String,
      default: "",
    },
    targetName: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

module.exports = AuditLog;
