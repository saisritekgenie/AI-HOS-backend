const userService = require("../services/userService");
const auditLogService = require("../services/auditLogService");
const asyncHandler = require("../utils/asyncHandler");
const { successResponse } = require("../utils/apiResponse");


/**
 * Helper to check if the current user has permission to access/modify a target user
 */
const checkUserPermission = (req, targetUser) => {
  const currentUserRole = req.user.role;

  // SUPER_ADMIN has full access to everything
  if (currentUserRole === "SUPER_ADMIN") {
    return true;
  }

  // Non-SUPER_ADMIN users can only access/modify users within their own hospital
  if (!targetUser.hospital || targetUser.hospital.toString() !== req.user.hospital.toString()) {
    return false;
  }

  // ADMIN has full access to hospital users, except they cannot access/modify SUPER_ADMINs
  if (currentUserRole === "ADMIN") {
    return targetUser.role !== "SUPER_ADMIN";
  }

  // Other staff roles (DOCTOR, RECEPTIONIST, NURSE, etc.) can only access/modify PATIENT users
  return targetUser.role === "PATIENT";
};

/**
 * @desc    Create a new user
 * @route   POST /api/super-admin/users
 * @access  Private (SUPER_ADMIN, ADMIN, DOCTOR, RECEPTIONIST, NURSE)
 */
const createUser = asyncHandler(async (req, res) => {
  const userData = { ...req.body };
  const userRole = req.user.role;

  if (userRole !== "SUPER_ADMIN") {
    // Both ADMIN and staff are restricted to their own hospital
    userData.hospital = req.user.hospital.toString();

    if (userRole === "ADMIN") {
      // Admin cannot create SUPER_ADMIN or ADMIN roles
      if (userData.role === "SUPER_ADMIN" || userData.role === "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Access Denied: Admins cannot create Super Admin or other Admin users.",
        });
      }
    } else {
      // Staff (non-ADMIN) can ONLY create PATIENTs
      userData.role = "PATIENT";
    }
  }

  const newUser = await userService.createUser(userData);

  // Log audit activity
  await auditLogService.logActivity(req, {
    module: newUser.role === "PATIENT" ? "PATIENT" : "USER",
    action: newUser.role === "PATIENT" ? "REGISTER_PATIENT" : "CREATE_USER",
    details: `Created new ${newUser.role} account for ${newUser.firstName} ${newUser.lastName}`,
    targetId: newUser._id.toString(),
    targetName: `${newUser.firstName} ${newUser.lastName}`
  });

  return successResponse(res, 201, "User created successfully", newUser);
});

/**
 * @desc    Get all users with Search, Pagination & Filtering
 * @route   GET /api/super-admin/users
 * @access  Private (SUPER_ADMIN, ADMIN, DOCTOR, etc.)
 */
const getUsers = asyncHandler(async (req, res) => {
  const query = { ...req.query };
  const userRole = req.user.role;

  if (userRole !== "SUPER_ADMIN") {
    // Enforce hospital tenant isolation
    query.hospital = req.user.hospital.toString();

    // Staff (non-ADMIN) can query PATIENT, DOCTOR, or NURSE users, default to PATIENT
    if (userRole !== "ADMIN") {
      if (req.query.role === "DOCTOR") {
        query.role = "DOCTOR";
      } else if (req.query.role === "NURSE") {
        query.role = "NURSE";
      } else {
        query.role = "PATIENT";
      }
    } else {
      if (!req.query.role) {
        query.role = { $ne: "PATIENT" };
      }
    }
  } else {
    if (!req.query.role) {
      query.role = { $ne: "PATIENT" };
    }
  }

  const result = await userService.getUsers(query);
  return successResponse(
    res,
    200,
    "Users retrieved successfully",
    result.users,
    result.pagination
  );
});

/**
 * @desc    Get user details by ID
 * @route   GET /api/super-admin/users/:id
 * @access  Private
 */
const getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);

  if (!checkUserPermission(req, user)) {
    return res.status(403).json({
      success: false,
      message: "Access Denied: You do not have permission to view this user.",
    });
  }

  return successResponse(res, 200, "User details retrieved successfully", user);
});

/**
 * @desc    Update user details
 * @route   PUT /api/super-admin/users/:id
 * @access  Private
 */
const updateUser = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);

  if (!checkUserPermission(req, user)) {
    return res.status(403).json({
      success: false,
      message: "Access Denied: You do not have permission to update this user.",
    });
  }

  // Prevent role injection to SUPER_ADMIN or ADMIN by non-SUPER_ADMIN
  if (req.user.role !== "SUPER_ADMIN") {
    req.body.hospital = req.user.hospital.toString();

    if (req.user.role === "ADMIN") {
      // Admin cannot assign SUPER_ADMIN or ADMIN role
      if (req.body.role === "SUPER_ADMIN" || req.body.role === "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Access Denied: Cannot assign Super Admin or Admin roles.",
        });
      }
    } else {
      // Staff cannot change role from PATIENT
      req.body.role = "PATIENT";
    }
  }

  const updatedUser = await userService.updateUser(req.params.id, req.body);

  // Log audit activity
  await auditLogService.logActivity(req, {
    module: updatedUser.role === "PATIENT" ? "PATIENT" : "USER",
    action: updatedUser.role === "PATIENT" ? "UPDATE_PATIENT" : "UPDATE_USER",
    details: `Updated ${updatedUser.role} account details`,
    targetId: updatedUser._id.toString(),
    targetName: `${updatedUser.firstName} ${updatedUser.lastName}`
  });

  return successResponse(res, 200, "User updated successfully", updatedUser);
});

/**
 * @desc    Delete user
 * @route   DELETE /api/super-admin/users/:id
 * @access  Private
 */
const deleteUser = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);

  if (!checkUserPermission(req, user)) {
    return res.status(403).json({
      success: false,
      message: "Access Denied: You do not have permission to delete this user.",
    });
  }

  await userService.deleteUser(req.params.id);

  // Log audit activity
  await auditLogService.logActivity(req, {
    module: user.role === "PATIENT" ? "PATIENT" : "USER",
    action: user.role === "PATIENT" ? "DELETE_PATIENT" : "DELETE_USER",
    details: `Deleted ${user.role} account`,
    targetId: user._id.toString(),
    targetName: `${user.firstName} ${user.lastName}`
  });

  return successResponse(res, 200, "User deleted successfully");
});

/**
 * @desc    Enable user (Set status to ACTIVE)
 * @route   PUT /api/super-admin/users/:id/enable
 * @access  Private
 */
const enableUser = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);

  if (!checkUserPermission(req, user)) {
    return res.status(403).json({
      success: false,
      message: "Access Denied: You do not have permission to enable this user.",
    });
  }

  const updatedUser = await userService.setUserStatus(req.params.id, "ACTIVE");

  // Log audit activity
  await auditLogService.logActivity(req, {
    module: user.role === "PATIENT" ? "PATIENT" : "USER",
    action: "STATUS_CHANGE",
    details: `Enabled ${user.role} account (Set status to ACTIVE)`,
    targetId: user._id.toString(),
    targetName: `${user.firstName} ${user.lastName}`
  });

  return successResponse(res, 200, "User account enabled successfully", updatedUser);
});

/**
 * @desc    Disable user (Set status to INACTIVE)
 * @route   PUT /api/super-admin/users/:id/disable
 * @access  Private
 */
const disableUser = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);

  if (!checkUserPermission(req, user)) {
    return res.status(403).json({
      success: false,
      message: "Access Denied: You do not have permission to disable this user.",
    });
  }

  const updatedUser = await userService.setUserStatus(req.params.id, "INACTIVE");

  // Log audit activity
  await auditLogService.logActivity(req, {
    module: user.role === "PATIENT" ? "PATIENT" : "USER",
    action: "STATUS_CHANGE",
    details: `Disabled ${user.role} account (Set status to INACTIVE)`,
    targetId: user._id.toString(),
    targetName: `${user.firstName} ${user.lastName}`
  });

  return successResponse(res, 200, "User account disabled successfully", updatedUser);
});

module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  enableUser,
  disableUser,
};
