const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { encryptText, decryptText, hashText } = require("../utils/encryption");

const userSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      trim: true,
      sparse: true,
    },
    uhid: {
      type: String,
      trim: true,
      sparse: true,
    },
    patientId: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [200, "First name cannot exceed 200 characters"],
      get: decryptText,
      set: encryptText
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [200, "Last name cannot exceed 200 characters"],
      get: decryptText,
      set: encryptText
    },
    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      unique: true,
      trim: true,
      get: decryptText,
      set: encryptText
    },
    email: {
      type: String,
      required: [true, "Email address is required"],
      unique: true,
      lowercase: true,
      trim: true,
      get: decryptText,
      set: encryptText
    },
    emailHash: {
      type: String,
      index: true
    },
    mobileHash: {
      type: String,
      index: true
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
      select: false,
    },
    gender: {
      type: String,
      required: [true, "Gender is required"],
      enum: {
        values: ["MALE", "FEMALE", "OTHER"],
        message: "Gender must be MALE, FEMALE, or OTHER",
      },
    },
    role: {
      type: String,
      required: [true, "Role is required"],
      enum: {
        values: [
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
        message: "Invalid role specified",
      },
      default: "DOCTOR",
    },
    department: {
      type: String,
      trim: true,
      default: "General",
    },
    branch: {
      type: String,
      trim: true,
      default: "Main Branch",
    },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-", "N/A"],
      default: "N/A",
    },
    emergencyContact: {
      type: String,
      trim: true,
      default: "N/A",
    },
    profilePhoto: {
      type: String,
      default: "uploads/default-avatar.png",
    },
    status: {
      type: String,
      enum: {
        values: ["ACTIVE", "INACTIVE", "PENDING_APPROVAL"],
        message: "Status must be ACTIVE, INACTIVE, or PENDING_APPROVAL",
      },
      default: "ACTIVE",
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
    },
    roomNo: {
      type: String,
      trim: true,
      default: "N/A",
    },
    bedNo: {
      type: String,
      trim: true,
      default: "N/A",
    },
    assignedDoctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    registrationType: {
      type: String,
      enum: ["WALK_IN", "ONLINE", "EMERGENCY", "REFERRAL"],
      default: "WALK_IN",
    },
    registeredBy: {
      type: String,
      default: "Receptionist",
    },
    allergies: {
      type: [String],
      default: [],
      get: (arr) => (arr || []).map(decryptText),
      set: (arr) => (arr || []).map(encryptText)
    },
    vaccinations: {
      type: [String],
      default: [],
    },
    chronicDiseases: {
      type: [String],
      default: [],
      get: (arr) => (arr || []).map(decryptText),
      set: (arr) => (arr || []).map(encryptText)
    },
    documents: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
      }
    ],
    dob: {
      type: Date,
    },
    age: {
      type: Number,
    },
    address: {
      type: String,
      trim: true,
    },
    medicalAlerts: {
      type: [String],
      default: [],
    },
    insurance: {
      provider: { type: String, trim: true, default: "" },
      policyNumber: { type: String, trim: true, default: "" },
      coverageAmount: { type: Number, default: 0 },
      expiryDate: { type: Date },
    },
    availability: {
      days: { type: [String], default: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] },
      startTime: { type: String, default: "09:00 AM" },
      endTime: { type: String, default: "05:00 PM" }
    },
    familyMapping: [
      {
        patient: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        relation: { type: String, trim: true },
      }
    ],
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
  }
);

// Pre-save hook: Hash search terms (email, mobile) and hash passwords
userSchema.pre("save", async function () {
  if (this.isModified("email") && this.email) {
    this.emailHash = hashText(decryptText(this.email));
  }
  if (this.isModified("mobile") && this.mobile) {
    this.mobileHash = hashText(decryptText(this.mobile));
  }

  if (!this.isModified("password")) {
    return;
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (err) {
    throw err;
  }
});

// Compare user entered password with hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Transform to JSON - remove sensitive data like password
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
