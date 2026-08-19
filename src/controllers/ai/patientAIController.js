const patientAIService = require("../../services/ai/patientAIService");
const asyncHandler = require("../../utils/asyncHandler");
const { successResponse } = require("../../utils/apiResponse");

const chat = asyncHandler(async (req, res) => {
  const { queryType, content } = req.body;
  const patientId = req.user._id;
  const reply = await patientAIService.processChat(queryType || "general", content, patientId);
  return successResponse(res, 200, "AI Patient response compiled", reply);
});

module.exports = {
  chat
};
