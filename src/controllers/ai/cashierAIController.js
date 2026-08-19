const cashierAIService = require("../../services/ai/cashierAIService");
const asyncHandler = require("../../utils/asyncHandler");
const { successResponse } = require("../../utils/apiResponse");

const getCashierInsights = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const insights = await cashierAIService.getCashierInsights(hospitalId);
  return successResponse(res, 200, "AI Cashier payment recommendations loaded", insights);
});

const chat = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const { content, activeTab } = req.body;
  const reply = await cashierAIService.processChat(content, hospitalId, activeTab);
  return successResponse(res, 200, "AI Cashier response compiled", reply);
});

module.exports = {
  getCashierInsights,
  chat
};
