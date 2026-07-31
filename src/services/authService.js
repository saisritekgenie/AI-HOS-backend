const User = require("../models/userModel");
const Hospital = require("../models/hospitalModel");
const AppError = require("../utils/appError");
const generateToken = require("../utils/generateToken");
const { hashText } = require("../utils/encryption");

class AuthService {
  /**
   * Authenticate user with email & password
   * @param {string} email
   * @param {string} password
   */
  async login(email, password) {
    // 1) Find user by email (select password field) and populate hospital
    let user = await User.findOne({ emailHash: hashText(email) }).select("+password").populate("hospital");
    
    // Fallback for legacy database accounts (bypassing Mongoose setters to find raw plaintext)
    if (!user) {
      const rawUser = await User.collection.findOne({ email: email.trim().toLowerCase() });
      if (rawUser) {
        user = await User.findById(rawUser._id).select("+password").populate("hospital");
      }
    }

    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    // 2) Check user status
    if (user.status !== "ACTIVE") {
      if (user.status === "PENDING_APPROVAL") {
        throw new AppError(
          "Your hospital registration is pending Super Admin approval. Please wait until access is granted.",
          403
        );
      }
      if (user.status === "INACTIVE") {
        throw new AppError("Your account has been deactivated. Please contact administration.", 403);
      }
      throw new AppError(`Your account status is ${user.status}. Access denied.`, 403);
    }

    // 3) Check hospital status if linked
    if (user.hospital && user.hospital.status !== "ACTIVE") {
      if (user.hospital.status === "PENDING_APPROVAL") {
        throw new AppError(
          `Hospital '${user.hospital.name}' is pending Super Admin approval. Access not granted yet.`,
          403
        );
      }
      if (user.hospital.status === "INACTIVE") {
        throw new AppError(`Hospital '${user.hospital.name}' subscription is inactive or suspended.`, 403);
      }
      throw new AppError(`Hospital '${user.hospital.name}' status is ${user.hospital.status}. Access denied.`, 403);
    }

    // 4) Verify password
    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      throw new AppError("Invalid email or password", 401);
    }

    // Dynamic database hash upgrade migration
    if (!user.emailHash) {
      user.email = user.email; // triggers pre-save setter hashing
      if (user.mobile) {
        user.mobile = user.mobile;
      }
      await user.save();
    }

    // 5) Generate token
    const token = generateToken(user._id, user.role);

    return {
      token,
      user: user.toJSON(),
    };
  }

  /**
   * Authenticate patient with UHID & Mobile number
   * @param {string} uhid
   * @param {string} mobile
   */
  async patientLogin(uhid, mobile) {
    if (!uhid || !mobile) {
      throw new AppError("Please provide both Patient ID (UHID) and registered Mobile number", 400);
    }

    let patient = await User.findOne({ 
      uhid: uhid.trim(), 
      mobileHash: hashText(mobile), 
      role: "PATIENT" 
    }).populate("hospital");

    if (!patient) {
      // Fallback for legacy patient logins (bypassing Mongoose setters for raw mobile check)
      const rawPatient = await User.collection.findOne({
        uhid: uhid.trim(),
        mobile: mobile.trim(),
        role: "PATIENT"
      });

      if (rawPatient) {
        patient = await User.findById(rawPatient._id).populate("hospital");
        if (patient) {
          // Upgrade mobile hash dynamically
          patient.mobile = patient.mobile;
          await patient.save();
        }
      }
    }

    if (!patient) {
      throw new AppError("Invalid Patient ID or Mobile number. Please check your inputs.", 401);
    }

    if (patient.status === "INACTIVE") {
      throw new AppError("Your patient file has been deactivated. Please contact administration.", 403);
    }

    const token = generateToken(patient._id, patient.role);

    return {
      token,
      user: patient.toJSON(),
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

  /**
   * Update authenticated user profile details
   * @param {string} userId
   * @param {object} profileData
   */
  async updateProfile(userId, profileData) {
    const { firstName, lastName, mobile, email } = profileData;
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User profile not found", 404);
    }
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (mobile) user.mobile = mobile;
    if (email) user.email = email;
    await user.save();
    return user;
  }

  /**
   * Change user password securely
   * @param {string} userId
   * @param {string} currentPassword
   * @param {string} newPassword
   */
  async changePassword(userId, currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
      throw new AppError("Please provide both current and new password", 400);
    }
    const user = await User.findById(userId).select("+password");
    if (!user) {
      throw new AppError("User profile not found", 404);
    }
    const isPasswordValid = await user.matchPassword(currentPassword);
    if (!isPasswordValid) {
      throw new AppError("Incorrect current password", 401);
    }
    user.password = newPassword;
    await user.save();
    return user.toJSON();
  }
}

module.exports = new AuthService();
