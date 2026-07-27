const express = require("express");
const router = express.Router();
const labTechnicianAIController = require("../../controllers/ai/labTechnicianAIController");
const { protect, restrictTo } = require("../../middleware/authMiddleware");

router.use(protect);
router.use(restrictTo("LAB_TECHNICIAN"));

router.post("/lab-analysis", labTechnicianAIController.getLabAnalysis);
router.post("/summarize-report", labTechnicianAIController.getReportSummary);
router.post("/chat", labTechnicianAIController.chat);

module.exports = router;
