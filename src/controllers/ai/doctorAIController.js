const doctorAIService = require("../../services/ai/doctorAIService");
const asyncHandler = require("../../utils/asyncHandler");
const { successResponse } = require("../../utils/apiResponse");

const getPatientSummary = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const summary = await doctorAIService.getPatientSummary(patientId);
  return successResponse(res, 200, "AI Patient summary loaded", summary);
});

const getMedicalScribe = asyncHandler(async (req, res) => {
  const { shorthandText } = req.body;
  const draft = await doctorAIService.getMedicalScribeDraft(shorthandText);
  return successResponse(res, 200, "AI Scribe draft compiled", draft);
});

const getDoctorDiagnosis = asyncHandler(async (req, res) => {
  const { vitals, complaints } = req.body;
  const suggestions = await doctorAIService.getDoctorDiagnosisSuggestions(vitals, complaints);
  return successResponse(res, 200, "AI Diagnosis suggestions loaded", suggestions);
});

const getPrescriptionCheck = asyncHandler(async (req, res) => {
  const { medications, patientAllergies } = req.body;
  const analysis = await doctorAIService.getPrescriptionAssistantCheck(medications, patientAllergies);
  return successResponse(res, 200, "AI Prescription check loaded", analysis);
});

const getFollowUpRecommendations = asyncHandler(async (req, res) => {
  const { diagnosis, lastVitals } = req.body;
  const recommendations = await doctorAIService.getFollowUpRecommendations(diagnosis, lastVitals);
  return successResponse(res, 200, "AI Follow-up recommendations loaded", recommendations);
});

const chat = asyncHandler(async (req, res) => {
  const doctorId = req.user._id;
  const { content, activeTab } = req.body;
  const reply = await doctorAIService.processChat(content, doctorId, activeTab);
  return successResponse(res, 200, "AI Doctor response compiled", reply);
});

module.exports = {
  getPatientSummary,
  getMedicalScribe,
  getDoctorDiagnosis,
  getPrescriptionCheck,
  getFollowUpRecommendations,
  chat
};
