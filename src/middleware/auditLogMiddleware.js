const AppError = require("../utils/appError");

/**
 * Middleware to restrict access exclusively to the ADMIN (Hospital Admin) role
 */
const restrictToAuditAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "ADMIN") {
    return next(
      new AppError("Access Denied: Only HOSPITAL_ADMIN is authorized to view audit logs.", 403)
    );
  }
  next();
};

module.exports = {
  restrictToAuditAdmin
};
