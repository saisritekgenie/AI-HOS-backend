const auditLogService = require("../services/auditLogService");
const asyncHandler = require("../utils/asyncHandler");
const { successResponse } = require("../utils/apiResponse");

/**
 * Fetch hospital audit logs (restricted to ADMIN role)
 * GET /api/audit-logs
 */
const getAuditLogs = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  
  const result = await auditLogService.queryLogs(hospitalId, req.query);
  
  return successResponse(
    res, 
    200, 
    "Hospital activity audit logs retrieved successfully", 
    result.logs, 
    {
      total: result.total,
      page: result.page,
      pages: result.pages
    }
  );
});

module.exports = {
  getAuditLogs
};
