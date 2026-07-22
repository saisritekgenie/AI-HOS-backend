/**
 * Higher-order function to catch errors in asynchronous Express controllers
 * eliminates repetitive try-catch blocks
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;
