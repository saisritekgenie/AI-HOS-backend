const labTechnicianAIService = require("../../services/ai/labTechnicianAIService");
const asyncHandler = require("../../utils/asyncHandler");
const { successResponse } = require("../../utils/apiResponse");

const getLabAnalysis = asyncHandler(async (req, res) => {
  const { testName, resultsText } = req.body;
  const analysis = await labTechnicianAIService.getLabAnalysis(testName, resultsText);
  return successResponse(res, 200, "AI Lab report analysis complete", analysis);
});

const getReportSummary = asyncHandler(async (req, res) => {
  const { fileName, textContent } = req.body;
  const summary = await labTechnicianAIService.getMedicalReportSummary(fileName, textContent);
  return successResponse(res, 200, "AI document summary completed", summary);
});

const chat = asyncHandler(async (req, res) => {
  const techId = req.user._id;
  const { content, activeTab } = req.body;
  const reply = await labTechnicianAIService.processChat(content, techId, activeTab);
  return successResponse(res, 200, "AI Lab Technician response compiled", reply);
});

module.exports = {
  getLabAnalysis,
  getReportSummary,
  chat
};
