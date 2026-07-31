const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Middleware to authenticate requests via strict JWT Bearer token
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // 1) Extract Bearer token from Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  // 2) Reject request if no token is provided
  if (!token) {
    return next(new AppError("Not authorized. Please log in to access this resource.", 401));
  }

  // 3) Verify token signature & expiration
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new AppError("The user belonging to this token no longer exists.", 401));
    }

    if (user.status !== "ACTIVE") {
      return next(new AppError("Your account has been deactivated. Please contact Super Admin.", 403));
    }

    req.user = user;
    next();
  } catch (error) {
    return next(new AppError("Invalid or expired authentication token. Please log in again.", 401));
  }
});

/**
 * Middleware to restrict access based on user roles
 * @param  {...string} roles - Allowed roles (e.g. 'SUPER_ADMIN')
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access Denied: Role '${req.user ? req.user.role : "UNAUTHORIZED"}' is not authorized to access this resource. Only ${roles.join(", ")} allowed.`,
          403
        )
      );
    }
    next();
  };
};

module.exports = {
  protect,
  restrictTo,
};
