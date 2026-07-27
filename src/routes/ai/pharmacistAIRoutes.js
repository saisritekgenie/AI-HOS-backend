const express = require("express");
const router = express.Router();
const pharmacistAIController = require("../../controllers/ai/pharmacistAIController");
const { protect, restrictTo } = require("../../middleware/authMiddleware");

router.use(protect);
router.use(restrictTo("PHARMACIST"));

router.post("/pharmacy-companion", pharmacistAIController.getPharmacyCompanion);
router.get("/pharmacy-forecast", pharmacistAIController.getPharmacyForecast);
router.post("/chat", pharmacistAIController.chat);

module.exports = router;
