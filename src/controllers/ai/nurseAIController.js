const nurseAIService = require("../../services/ai/nurseAIService");
const asyncHandler = require("../../utils/asyncHandler");
const { successResponse } = require("../../utils/apiResponse");

const getVitalsEmergencyCheck = asyncHandler(async (req, res) => {
  const { vitals } = req.body;
  const alert = await nurseAIService.getEmergencyVitalsAlert(vitals);
  return successResponse(res, 200, "AI vitals emergency check complete", alert);
});

const chat = asyncHandler(async (req, res) => {
  const nurseId = req.user._id;
  const { content } = req.body;
  const reply = await nurseAIService.processChat(content, nurseId);
  return successResponse(res, 200, "AI Nurse response compiled", reply);
});

module.exports = {
  getVitalsEmergencyCheck,
  chat
};
