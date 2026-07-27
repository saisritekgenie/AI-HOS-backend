const express = require("express");
const router = express.Router();
const patientAIController = require("../../controllers/ai/patientAIController");
const { protect, restrictTo } = require("../../middleware/authMiddleware");

router.use(protect);
router.use(restrictTo("PATIENT"));

router.post("/chat", patientAIController.chat);

module.exports = router;
