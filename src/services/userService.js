const User = require("../models/userModel");
const AppError = require("../utils/appError");

class UserService {
  /**
   * Create a new staff user or patient
   * @param {Object} userData
   */
  async createUser(userData) {
    const { email, mobile, role, employeeId } = userData;

    // Check for valid role
    const validRoles = [
      "SUPER_ADMIN",
      "ADMIN",
      "DOCTOR",
      "RECEPTIONIST",
      "NURSE",
      "LAB_TECHNICIAN",
      "PHARMACIST",
      "CASHIER",
      "PATIENT",
    ];

    if (role && !validRoles.includes(role)) {
      throw new AppError(`Invalid role '${role}'. Allowed roles: ${validRoles.join(", ")}`, 400);
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      throw new AppError("A user with this email address already exists", 409);
    }

    // Check if mobile already exists
    const existingMobile = await User.findOne({ mobile });
    if (existingMobile) {
      throw new AppError("A user with this mobile number already exists", 409);
    }

    // Auto-generate employeeId if staff and not provided
    if (role !== "PATIENT" && !employeeId) {
      const count = await User.countDocuments({ role: { $ne: "PATIENT" } });
      userData.employeeId = `EMP-${1000 + count + 1}`;
    }

    // Auto-generate UHID if Patient
    if (role === "PATIENT" && !userData.uhid) {
      const pCount = await User.countDocuments({ role: "PATIENT" });
      userData.uhid = `UHID-2026-${1000 + pCount + 1}`;
    }

    // Create user
    const user = await User.create(userData);
    return user;
  }

  /**
   * Get users with Search, Pagination, and Filters
   * @param {Object} queryParams
   */
  async getUsers(queryParams) {
    const {
      page = 1,
      limit = 10,
      search,
      q,
      role,
      department,
      branch,
      status,
      hospital,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = queryParams;

    const query = {};

    // Filter by hospital
    if (hospital) {
      query.hospital = hospital;
    }

    // Search filter
    const searchTerm = search || q;
    if (searchTerm) {
      const searchRegex = new RegExp(searchTerm.trim(), "i");
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { mobile: searchRegex },
        { employeeId: searchRegex },
        { uhid: searchRegex },
      ];
    }

    // Filter by role
    if (role) {
      query.role = role.toUpperCase();
    }

    // Filter by department
    if (department) {
      query.department = new RegExp(`^${department.trim()}$`, "i");
    }

    // Filter by branch
    if (branch) {
      query.branch = new RegExp(`^${branch.trim()}$`, "i");
    }

    // Filter by status
    if (status) {
      query.status = status.toUpperCase();
    }

    // Pagination calculations
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const [users, totalRecords] = await Promise.all([
      User.find(query).sort(sort).skip(skip).limit(limitNum),
      User.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalRecords / limitNum) || 1;

    return {
      users,
      pagination: {
        totalRecords,
        totalPages,
        currentPage: pageNum,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    };
  }

  /**
   * Get single user by ID
   * @param {string} userId
   */
  async getUserById(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(`User not found with ID: ${userId}`, 404);
    }
    return user;
  }

  /**
   * Update user details
   * @param {string} userId
   * @param {Object} updateData
   */
  async updateUser(userId, updateData) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(`User not found with ID: ${userId}`, 404);
    }

    if (updateData.email && updateData.email !== user.email) {
      const existingEmail = await User.findOne({ email: updateData.email });
      if (existingEmail) {
        throw new AppError("A user with this email address already exists", 409);
      }
    }

    if (updateData.mobile && updateData.mobile !== user.mobile) {
      const existingMobile = await User.findOne({ mobile: updateData.mobile });
      if (existingMobile) {
        throw new AppError("A user with this mobile number already exists", 409);
      }
    }

    delete updateData.password;

    Object.assign(user, updateData);
    await user.save();

    return user;
  }

  /**
   * Delete user by ID with active safeguards
   * @param {string} userId
   */
  async deleteUser(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(`User not found with ID: ${userId}`, 404);
    }

    // Deletion Safeguard: Cannot delete doctor if status is ACTIVE
    if (user.role === "DOCTOR" && user.status === "ACTIVE") {
      throw new AppError(
        `Active Safeguard: Cannot delete Doctor ${user.firstName} ${user.lastName} while status is ACTIVE. Please deactivate account first.`,
        400
      );
    }

    await user.deleteOne();
    return true;
  }

  /**
   * Enable or Disable user (Set status ACTIVE or INACTIVE)
   * @param {string} userId
   * @param {string} status
   */
  async setUserStatus(userId, status) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(`User not found with ID: ${userId}`, 404);
    }

    user.status = status;
    await user.save();

    return user;
  }
}

module.exports = new UserService();
