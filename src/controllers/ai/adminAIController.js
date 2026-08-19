const adminAIService = require("../../services/ai/adminAIService");
const asyncHandler = require("../../utils/asyncHandler");
const { successResponse } = require("../../utils/apiResponse");

const getDashboardInsights = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const insights = await adminAIService.getDashboardInsights(hospitalId);
  return successResponse(res, 200, "AI Admin Dashboard insights loaded", insights);
});

const chat = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const { content, activeTab } = req.body;
  const reply = await adminAIService.processChat(content, hospitalId, activeTab);
  return successResponse(res, 200, "AI Admin response compiled", reply);
});

module.exports = {
  getDashboardInsights,
  chat
};
