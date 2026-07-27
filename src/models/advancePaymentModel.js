const mongoose = require("mongoose");

const advancePaymentSchema = new mongoose.Schema(
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
    amount: {
      type: Number,
      required: true,
      min: [1, "Advance payment must be greater than 0"],
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "CARD", "UPI"],
      required: true,
    },
    receiptNumber: {
      type: String,
      required: true,
      unique: true,
    },
    notes: {
      type: String,
      default: "",
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const AdvancePayment = mongoose.model("AdvancePayment", advancePaymentSchema);

module.exports = AdvancePayment;
