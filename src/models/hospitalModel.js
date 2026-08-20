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
    logoUrl: {
      type: String,
      default: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="%230284c7"/><path d="M12 6v12M6 12h12" stroke="white" stroke-width="3.5" stroke-linecap="round"/></svg>`,
    },
  },
  {
    timestamps: true,
  }
);

const Hospital = mongoose.model("Hospital", hospitalSchema);

module.exports = Hospital;
