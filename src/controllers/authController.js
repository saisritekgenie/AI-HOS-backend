const authService = require("../services/authService");
const auditLogService = require("../services/auditLogService");
const asyncHandler = require("../utils/asyncHandler");
const { successResponse } = require("../utils/apiResponse");
const User = require("../models/userModel");
const os = require("os");

/**
 * @desc    Login user & return JWT token (Audited)
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await authService.login(email, password);
    
    // Log successful login
    await auditLogService.logActivity(req, {
      user: result.user,
      module: "AUTH",
      action: "LOGIN",
      details: `Cashier/Staff ${email} logged in successfully`,
      status: "SUCCESS"
    });
    
    return successResponse(res, 200, "Login successful", result);
  } catch (err) {
    // Attempt to log failed login
    try {
      const attemptedUser = await User.findOne({ email });
      if (attemptedUser) {
        await auditLogService.logActivity(req, {
          user: attemptedUser,
          module: "AUTH",
          action: "LOGIN",
          details: `Failed login attempt for account ${email}: ${err.message}`,
          status: "FAILED"
        });
      }
    } catch (logErr) {
      console.error("Failed to log failed auth attempt:", logErr.message);
    }
    throw err;
  }
});

/**
 * @desc    Login patient by UHID & registered mobile number (Audited)
 * @route   POST /api/auth/patient-login
 * @access  Public
 */
const patientLogin = asyncHandler(async (req, res) => {
  const { uhid, mobile } = req.body;
  try {
    const result = await authService.patientLogin(uhid, mobile);
    
    // Log patient portal login
    await auditLogService.logActivity(req, {
      user: result.user,
      module: "AUTH",
      action: "LOGIN",
      details: `Patient with UHID ${uhid} logged in successfully via portal`,
      status: "SUCCESS"
    });

    return successResponse(res, 200, "Patient login successful", result);
  } catch (err) {
    throw err;
  }
});

/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user._id);
  return successResponse(res, 200, "User profile retrieved successfully", user);
});

/**
 * @desc    Update profile details for the authenticated user (Audited)
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateProfile = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(req.user._id, req.body);
  
  // Log profile update
  await auditLogService.logActivity(req, {
    module: "USER",
    action: "UPDATE_PROFILE",
    details: `Staff member updated profile details`,
    targetId: user._id.toString(),
    targetName: `${user.firstName} ${user.lastName}`
  });

  return successResponse(res, 200, "User profile updated successfully", user);
});

/**
 * @desc    Change password for the authenticated user (Audited)
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await authService.changePassword(req.user._id, currentPassword, newPassword);
  
  // Log password update
  await auditLogService.logActivity(req, {
    module: "AUTH",
    action: "CHANGE_PASSWORD",
    details: `Staff member successfully updated security password`,
    targetId: req.user._id.toString(),
    targetName: `${req.user.firstName} ${req.user.lastName}`
  });

  return successResponse(res, 200, "Password changed successfully", user);
});

/**
 * @desc    Get host machine local network IP address
 * @route   GET /api/auth/system-ip
 * @access  Public
 */
const getSystemIp = asyncHandler(async (req, res) => {
  const networkInterfaces = os.networkInterfaces();
  let localIp = "localhost";
  
  for (const interfaceName in networkInterfaces) {
    for (const iface of networkInterfaces[interfaceName]) {
      if (iface.family === "IPv4" && !iface.internal) {
        localIp = iface.address;
        break;
      }
    }
    if (localIp !== "localhost") break;
  }
  
  return successResponse(res, 200, "System IP retrieved successfully", { localIp });
});

module.exports = {
  login,
  patientLogin,
  getMe,
  updateProfile,
  changePassword,
  getSystemIp,
};
