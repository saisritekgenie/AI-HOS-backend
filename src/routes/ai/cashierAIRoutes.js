const express = require("express");
const router = express.Router();
const cashierAIController = require("../../controllers/ai/cashierAIController");
const { protect, restrictTo } = require("../../middleware/authMiddleware");

router.use(protect);
router.use(restrictTo("CASHIER"));

router.get("/cashier-insights", cashierAIController.getCashierInsights);
router.post("/chat", cashierAIController.chat);

module.exports = router;
