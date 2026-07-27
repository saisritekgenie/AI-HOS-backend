const express = require("express");
const router = express.Router();
const nurseAIController = require("../../controllers/ai/nurseAIController");
const { protect, restrictTo } = require("../../middleware/authMiddleware");

router.use(protect);
router.use(restrictTo("NURSE"));

router.post("/vitals-emergency-check", nurseAIController.getVitalsEmergencyCheck);
router.post("/chat", nurseAIController.chat);

module.exports = router;
