const mongoose = require("mongoose");

// Unified Billing Invoice Schema
const billingInvoiceSchema = new mongoose.Schema(
  {
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      enum: ["CONSULTATION", "LAB", "PHARMACY", "OTHER", "DISCHARGE", "ADVANCE"],
      required: true,
    },
    itemName: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    amountDue: {
      type: Number,
      default: function() {
        return this.amount - this.amountPaid;
      }
    },
    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PAID", "PARTIAL", "REFUNDED"],
      default: "UNPAID",
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "CARD", "UPI", "INSURANCE", "N/A"],
      default: "N/A",
    },
    transactions: [
      {
        amount: { type: Number, required: true },
        paymentMethod: { type: String, enum: ["CASH", "CARD", "UPI", "INSURANCE"], required: true },
        date: { type: Date, default: Date.now },
        transactionId: { type: String, default: "" }
      }
    ],
    billNumber: {
      type: String,
      required: true,
      unique: true,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    refundReason: {
      type: String,
      default: "",
    },
    isDischargeBill: {
      type: Boolean,
      default: false
    },
    dischargeDetails: {
      admissionId: { type: mongoose.Schema.Types.ObjectId, ref: "AdmissionRecord" },
      roomCharges: { type: Number, default: 0 },
      labCharges: { type: Number, default: 0 },
      pharmacyCharges: { type: Number, default: 0 },
      consultationCharges: { type: Number, default: 0 },
      insuranceCovered: { type: Number, default: 0 },
      advanceDeducted: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

// Pre-save middleware to keep amountDue up to date
billingInvoiceSchema.pre("save", function() {
  if (this.amountPaid === undefined || this.amountPaid === null) {
    this.amountPaid = 0;
  }
  if (this.paymentStatus === "PAID" && this.amountPaid < this.amount) {
    this.amountPaid = this.amount;
  }
  this.amountDue = this.amount - this.amountPaid;
  if (this.amountDue <= 0) {
    this.amountDue = 0;
    this.paymentStatus = "PAID";
  } else if (this.amountPaid > 0 && this.amountDue > 0) {
    this.paymentStatus = "PARTIAL";
  }
});

const BillingInvoice = mongoose.model("BillingInvoice", billingInvoiceSchema);

module.exports = {
  BillingInvoice,
};
