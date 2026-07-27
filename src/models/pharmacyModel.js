const mongoose = require("mongoose");

// 1. Medicine (Inventory) Schema
const medicineSchema = new mongoose.Schema(
  {
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    name: { type: String, required: true },
    stock: { type: Number, required: true, default: 0 },
    price: { type: Number, required: true, default: 0 },
    expiryDate: { type: Date, required: true },
    batchNumber: { type: String, required: true },
  },
  { timestamps: true }
);

// 2. Pharmacy Billing Invoice Schema
const pharmacyBillSchema = new mongoose.Schema(
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
    items: [
      {
        medicineName: { type: String, required: true },
        quantity: { type: Number, required: true, default: 1 },
        price: { type: Number, required: true },
      }
    ],
    totalAmount: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PAID"],
      default: "UNPAID",
    },
    billNumber: { type: String, required: true, unique: true },
    paymentMethod: {
      type: String,
      enum: ["CASH", "CARD", "UPI", "N/A"],
      default: "N/A",
    },
  },
  { timestamps: true }
);

const Medicine = mongoose.model("Medicine", medicineSchema);
const PharmacyBill = mongoose.model("PharmacyBill", pharmacyBillSchema);

module.exports = {
  Medicine,
  PharmacyBill,
};
