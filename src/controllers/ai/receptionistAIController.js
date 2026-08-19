const receptionistAIService = require("../../services/ai/receptionistAIService");
const asyncHandler = require("../../utils/asyncHandler");
const { successResponse } = require("../../utils/apiResponse");

const getSchedulingSuggestions = asyncHandler(async (req, res) => {
  const { doctorId, date } = req.body;
  const suggestions = await receptionistAIService.getSchedulingSuggestions(doctorId, date);
  return successResponse(res, 200, "AI Scheduling suggestions loaded", suggestions);
});

const getQueueWaitingTimePrediction = asyncHandler(async (req, res) => {
  const { doctorId, date } = req.body;
  const prediction = await receptionistAIService.getQueueWaitingTimePrediction(doctorId, date);
  return successResponse(res, 200, "AI Queue prediction loaded", prediction);
});

const getQueueOptimization = asyncHandler(async (req, res) => {
  const tip = await receptionistAIService.getQueueOptimization();
  return successResponse(res, 200, "AI Queue optimization recommendations loaded", tip);
});

const chat = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const { content, activeTab } = req.body;
  const reply = await receptionistAIService.processChat(content, hospitalId, activeTab);
  return successResponse(res, 200, "AI Receptionist response compiled", reply);
});

module.exports = {
  getSchedulingSuggestions,
  getQueueWaitingTimePrediction,
  getQueueOptimization,
  chat
};
