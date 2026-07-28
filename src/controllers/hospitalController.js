const Hospital = require("../models/hospitalModel");
const User = require("../models/userModel");
const auditLogService = require("../services/auditLogService");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { successResponse } = require("../utils/apiResponse");

/**
 * @desc    Register a new Hospital & Hospital Admin (Pending Super Admin Approval)
 * @route   POST /api/hospitals/register
 * @access  Public / Super Admin
 */
const registerHospital = asyncHandler(async (req, res) => {
  const {
    hospitalName,
    hospitalCode,
    hospitalLocation,
    adminFirstName,
    adminLastName,
    adminEmail,
    adminMobile,
    adminPassword,
  } = req.body;

  // Check duplicate hospital code
  const existingHospital = await Hospital.findOne({ code: hospitalCode.toUpperCase() });
  if (existingHospital) {
    throw new AppError("A hospital with this unique code already exists", 409);
  }

  // Check duplicate admin email or mobile
  const existingEmail = await User.findOne({ email: adminEmail });
  if (existingEmail) {
    throw new AppError("An account with this email address already exists", 409);
  }

  const existingMobile = await User.findOne({ mobile: adminMobile });
  if (existingMobile) {
    throw new AppError("An account with this mobile number already exists", 409);
  }

  // 1) Create Hospital with PENDING_APPROVAL status
  const hospital = await Hospital.create({
    name: hospitalName,
    code: hospitalCode.toUpperCase(),
    location: hospitalLocation,
    status: "PENDING_APPROVAL",
  });

  // 2) Create Hospital Admin User with PENDING_APPROVAL status
  const adminUser = await User.create({
    firstName: adminFirstName,
    lastName: adminLastName,
    email: adminEmail,
    mobile: adminMobile,
    password: adminPassword,
    gender: "OTHER",
    role: "ADMIN",
    department: "Executive Management",
    branch: hospitalLocation,
    status: "PENDING_APPROVAL",
    hospital: hospital._id,
  });

  // Link admin user back to hospital
  hospital.adminUser = adminUser._id;
  await hospital.save();

  return successResponse(
    res,
    201,
    "Hospital registration submitted successfully! Access is pending Super Admin approval.",
    { hospital, adminUser }
  );
});

/**
 * @desc    Get all registered hospitals (SUPER_ADMIN only)
 * @route   GET /api/super-admin/hospitals
 * @access  Private (SUPER_ADMIN)
 */
const getHospitals = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const query = {};
  if (status) {
    query.status = status;
  }

  const hospitals = await Hospital.find(query).populate("adminUser", "firstName lastName email mobile status").sort("-createdAt");
  const pendingCount = await Hospital.countDocuments({ status: "PENDING_APPROVAL" });

  return successResponse(res, 200, "Hospitals list retrieved successfully", hospitals, { pendingCount });
});

/**
 * @desc    Approve Hospital & Grant Access (SUPER_ADMIN only)
 * @route   PUT /api/super-admin/hospitals/:id/approve
 * @access  Private (SUPER_ADMIN)
 */
const approveHospital = asyncHandler(async (req, res) => {
  const hospital = await Hospital.findById(req.params.id);
  if (!hospital) {
    throw new AppError("Hospital record not found", 404);
  }

  hospital.status = "ACTIVE";
  await hospital.save();

  // Activate Hospital Admin account
  if (hospital.adminUser) {
    await User.findByIdAndUpdate(hospital.adminUser, { status: "ACTIVE" });
  }

  // Log Audit
  await auditLogService.logActivity(req, {
    hospital: hospital._id,
    module: "SETTINGS",
    action: "APPROVE_HOSPITAL",
    details: `Approved hospital ${hospital.name} (${hospital.code}) and activated admin account.`,
  });

  return successResponse(res, 200, `Access granted for ${hospital.name}! Hospital is now ACTIVE.`, hospital);
});

/**
 * @desc    Reject / Deactivate Hospital (SUPER_ADMIN only)
 * @route   PUT /api/super-admin/hospitals/:id/reject
 * @access  Private (SUPER_ADMIN)
 */
const rejectHospital = asyncHandler(async (req, res) => {
  const hospital = await Hospital.findById(req.params.id);
  if (!hospital) {
    throw new AppError("Hospital record not found", 404);
  }

  hospital.status = "INACTIVE";
  await hospital.save();

  if (hospital.adminUser) {
    await User.findByIdAndUpdate(hospital.adminUser, { status: "INACTIVE" });
  }

  // Log Audit
  await auditLogService.logActivity(req, {
    hospital: hospital._id,
    module: "SETTINGS",
    action: "REJECT_HOSPITAL",
    details: `Deactivated/Rejected hospital ${hospital.name} (${hospital.code}).`,
  });

  return successResponse(res, 200, `Hospital ${hospital.name} status set to INACTIVE.`, hospital);
});

module.exports = {
  registerHospital,
  getHospitals,
  approveHospital,
  rejectHospital,
};
