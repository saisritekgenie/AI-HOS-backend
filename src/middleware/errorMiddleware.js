const AppError = require("../utils/appError");
const { errorResponse } = require("../utils/apiResponse");

/**
 * Handle Mongoose CastError (Invalid ID)
 */
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new AppError(message, 400);
};

/**
 * Handle Mongoose Duplicate Field Errors (code 11000)
 */
const handleDuplicateFieldsDB = (err) => {
  const keys = Object.keys(err.keyValue || {});
  const fieldName = keys.length > 0 ? keys[0] : "field";
  const fieldValue = err.keyValue ? err.keyValue[fieldName] : "";
  const message = `Duplicate field value: '${fieldValue}' already exists for ${fieldName}. Please use another value.`;
  return new AppError(message, 409);
};

/**
 * Handle Mongoose Validation Errors
 */
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data. ${errors.join(". ")}`;
  return new AppError(message, 400);
};

/**
 * Centralized Error Handler Middleware
 */
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  let error = { ...err };
  error.message = err.message;
  error.name = err.name;
  error.code = err.code;

  if (err.name === "CastError") error = handleCastErrorDB(err);
  if (err.code === 11000) error = handleDuplicateFieldsDB(err);
  if (err.name === "ValidationError") error = handleValidationErrorDB(err);

  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal Server Error";

  return errorResponse(res, statusCode, message, error.errors || null);
};

module.exports = globalErrorHandler;
