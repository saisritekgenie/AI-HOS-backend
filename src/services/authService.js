const User = require("../models/userModel");
const Hospital = require("../models/hospitalModel");
const AppError = require("../utils/appError");
const generateToken = require("../utils/generateToken");

class AuthService {
  /**
   * Authenticate user with email & password
   * @param {string} email
   * @param {string} password
   */
  async login(email, password) {
    // 1) Find user by email (select password field) and populate hospital
    const user = await User.findOne({ email }).select("+password").populate("hospital");
    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    // 2) Check user status
    if (user.status === "PENDING_APPROVAL") {
      throw new AppError(
        "Your hospital registration is pending Super Admin approval. Please wait until access is granted.",
        403
      );
    }

    if (user.status === "INACTIVE") {
      throw new AppError("Your account has been deactivated. Please contact administration.", 403);
    }

    // 3) Check hospital status if linked
    if (user.hospital && user.hospital.status === "PENDING_APPROVAL") {
      throw new AppError(
        `Hospital '${user.hospital.name}' is pending Super Admin approval. Access not granted yet.`,
        403
      );
    }

    if (user.hospital && user.hospital.status === "INACTIVE") {
      throw new AppError(`Hospital '${user.hospital.name}' subscription is inactive or suspended.`, 403);
    }

    // 4) Verify password
    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      throw new AppError("Invalid email or password", 401);
    }

    // 5) Generate token
    const token = generateToken(user._id, user.role);

    return {
      token,
      user: user.toJSON(),
    };
  }

  /**
   * Get current logged in user profile
   * @param {string} userId
   */
  async getMe(userId) {
    const user = await User.findById(userId).populate("hospital");
    if (!user) {
      throw new AppError("User profile not found", 404);
    }
    return user;
  }
}

module.exports = new AuthService();
