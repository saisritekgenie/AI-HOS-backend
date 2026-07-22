const { body, param, query, validationResult } = require("express-validator");
const { errorResponse } = require("../utils/apiResponse");
const fs = require("fs");
const path = require("path");

/**
 * Middleware to check express-validator results
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
      value: err.value,
    }));
    console.error("❌ VALIDATION ERRORS:", JSON.stringify(formattedErrors, null, 2));

    try {
      const logPath = path.join(__dirname, "../../../validation_debug.log");
      fs.writeFileSync(logPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        body: req.body,
        errors: formattedErrors
      }, null, 2));
    } catch (e) {
      console.error("Failed to write validation log file:", e.message);
    }

    return errorResponse(res, 400, "Validation Error", formattedErrors);
  }
  next();
};

/**
 * Validation rules for creating a user
 */
const validateCreateUser = [
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ max: 50 })
    .withMessage("First name cannot exceed 50 characters"),

  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ max: 50 })
    .withMessage("Last name cannot exceed 50 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Must be a valid email address")
    .normalizeEmail(),

  body("mobile")
    .trim()
    .notEmpty()
    .withMessage("Mobile number is required")
    .matches(/^[0-9]{10}$/)
    .withMessage("Mobile number must be a valid 10-digit number"),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),

  body("gender")
    .notEmpty()
    .withMessage("Gender is required")
    .isIn(["MALE", "FEMALE", "OTHER"])
    .withMessage("Gender must be MALE, FEMALE, or OTHER"),

  body("role")
    .notEmpty()
    .withMessage("Role is required")
    .isIn(["SUPER_ADMIN", "ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE", "LAB_TECHNICIAN", "PHARMACIST", "CASHIER", "PATIENT"])
    .withMessage("Invalid role specified. Allowed roles: SUPER_ADMIN, ADMIN, DOCTOR, RECEPTIONIST, NURSE, LAB_TECHNICIAN, PHARMACIST, CASHIER, PATIENT"),

  body("department")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Department name cannot exceed 100 characters"),

  body("branch")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Branch name cannot exceed 100 characters"),

  body("profilePhoto")
    .optional()
    .trim(),

  validate,
];

/**
 * Validation rules for updating a user
 */
const validateUpdateUser = [
  param("id")
    .isMongoId()
    .withMessage("Invalid user ID format"),

  body("firstName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("First name cannot be empty")
    .isLength({ max: 50 })
    .withMessage("First name cannot exceed 50 characters"),

  body("lastName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Last name cannot be empty")
    .isLength({ max: 50 })
    .withMessage("Last name cannot exceed 50 characters"),

  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Must be a valid email address")
    .normalizeEmail(),

  body("mobile")
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage("Mobile number must be a valid 10-digit number"),

  body("gender")
    .optional()
    .isIn(["MALE", "FEMALE", "OTHER"])
    .withMessage("Gender must be MALE, FEMALE, or OTHER"),

  body("role")
    .optional()
    .isIn(["SUPER_ADMIN", "ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE", "LAB_TECHNICIAN", "PHARMACIST", "CASHIER", "PATIENT"])
    .withMessage("Invalid role specified. Allowed roles: SUPER_ADMIN, ADMIN, DOCTOR, RECEPTIONIST, NURSE, LAB_TECHNICIAN, PHARMACIST, CASHIER, PATIENT"),

  body("department")
    .optional()
    .trim(),

  body("branch")
    .optional()
    .trim(),

  body("profilePhoto")
    .optional()
    .trim(),

  validate,
];

/**
 * Validation for MongoDB ID parameters
 */
const validateUserIdParam = [
  param("id")
    .isMongoId()
    .withMessage("Invalid user ID format"),
  validate,
];

module.exports = {
  validateCreateUser,
  validateUpdateUser,
  validateUserIdParam,
};
