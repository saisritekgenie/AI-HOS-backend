const express = require("express");
const router = express.Router();
const adminAIController = require("../../controllers/ai/adminAIController");
const { protect, restrictTo } = require("../../middleware/authMiddleware");

router.use(protect);
router.use(restrictTo("SUPER_ADMIN", "ADMIN"));

router.get("/dashboard-insights", adminAIController.getDashboardInsights);
router.post("/chat", adminAIController.chat);

module.exports = router;
