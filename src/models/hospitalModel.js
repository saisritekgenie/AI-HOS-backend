const mongoose = require("mongoose");

const hospitalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Hospital name is required"],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Hospital code is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    location: {
      type: String,
      required: [true, "Hospital location is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: ["PENDING_APPROVAL", "ACTIVE", "INACTIVE"],
      default: "PENDING_APPROVAL",
    },
    adminUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

const Hospital = mongoose.model("Hospital", hospitalSchema);

module.exports = Hospital;
