const express = require("express");
const router = express.Router();
const auditLogController = require("../controllers/auditLogController");
const { protect } = require("../middleware/authMiddleware");
const { restrictToAuditAdmin } = require("../middleware/auditLogMiddleware");

// Secure all audit log routes
router.use(protect);
router.use(restrictToAuditAdmin);

// Fetch logs
router.get("/", auditLogController.getAuditLogs);

module.exports = router;
