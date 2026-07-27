const pharmacistAIService = require("../../services/ai/pharmacistAIService");
const asyncHandler = require("../../utils/asyncHandler");
const { successResponse } = require("../../utils/apiResponse");

const getPharmacyCompanion = asyncHandler(async (req, res) => {
  const { activeMeds } = req.body;
  const report = await pharmacistAIService.getPharmacistCompanion(activeMeds);
  return successResponse(res, 200, "AI Pharmacy analysis complete", report);
});

const getPharmacyForecast = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const forecast = await pharmacistAIService.getPharmacyForecast(hospitalId);
  return successResponse(res, 200, "AI Pharmacy forecasting metrics loaded", forecast);
});

const chat = asyncHandler(async (req, res) => {
  const pharmacistId = req.user._id;
  const { content } = req.body;
  const reply = await pharmacistAIService.processChat(content, pharmacistId);
  return successResponse(res, 200, "AI Pharmacist response compiled", reply);
});

module.exports = {
  getPharmacyCompanion,
  getPharmacyForecast,
  chat
};
