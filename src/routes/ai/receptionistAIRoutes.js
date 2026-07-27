const express = require("express");
const router = express.Router();
const receptionistAIController = require("../../controllers/ai/receptionistAIController");
const { protect, restrictTo } = require("../../middleware/authMiddleware");

router.use(protect);
router.use(restrictTo("RECEPTIONIST"));

router.post("/scheduling-suggestions", receptionistAIController.getSchedulingSuggestions);
router.post("/queue-prediction", receptionistAIController.getQueueWaitingTimePrediction);
router.get("/queue-optimization", receptionistAIController.getQueueOptimization);
router.post("/chat", receptionistAIController.chat);

module.exports = router;
