const jwt = require("jsonwebtoken");

/**
 * Generate JWT token for user
 * @param {string} id - User ObjectId
 * @param {string} role - User role (SUPER_ADMIN, ADMIN, DOCTOR, RECEPTIONIST)
 */
const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET || "super_secret_jwt_key_ai_hospital_2026",
    {
      expiresIn: "24h",
    }
  );
};

module.exports = generateToken;
