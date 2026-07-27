const aiService = require("../services/aiService");
const asyncHandler = require("../utils/asyncHandler");
const { successResponse } = require("../utils/apiResponse");
const AppError = require("../utils/appError");

/**
 * Get AI insights for general hospital dashboards (Executive Insights)
 */
const getDashboardInsights = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  if (!hospitalId) {
    throw new AppError("No hospital associated with this user session", 400);
  }

  const insights = await aiService.generateDashboardInsights(hospitalId);
  return successResponse(res, 200, "AI Dashboard analytics loaded", insights);
});

/**
 * Get AI assistance for receptionist frontdesk flows
 */
const getReceptionistAssistance = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  const { feature, payload } = req.body;

  if (!feature) {
    throw new AppError("AI Receptionist feature parameter is required", 400);
  }

  const suggestions = await aiService.getReceptionistAssistance(feature, payload || {}, hospitalId);
  return successResponse(res, 200, `AI Receptionist ${feature} analysis complete`, suggestions);
});

/**
 * Get AI summary and critical checks for laboratory tests
 */
const getLabAnalysis = asyncHandler(async (req, res) => {
  const { testName, resultsText } = req.body;
  if (!testName || !resultsText) {
    throw new AppError("Please provide testName and resultsText details for AI analysis", 400);
  }

  const analysis = await aiService.getLabAnalysis(testName, resultsText);
  return successResponse(res, 200, "AI Lab report analysis complete", analysis);
});

/**
 * Get AI interaction screening and generics suggestion for pharmacists
 */
const getPharmacyCompanion = asyncHandler(async (req, res) => {
  const { activeMeds } = req.body;
  if (!activeMeds || !Array.isArray(activeMeds)) {
    throw new AppError("An array of active medications is required for drug interaction checks", 400);
  }

  const companionReport = await aiService.getPharmacistCompanion(activeMeds);
  return successResponse(res, 200, "AI Pharmacy analysis complete", companionReport);
});

/**
 * Get AI billing insights and reminders for the Cashier
 */
const getCashierInsights = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  if (!hospitalId) {
    throw new AppError("No hospital associated with this user session", 400);
  }

  const insights = await aiService.getCashierInsights(hospitalId);
  return successResponse(res, 200, "AI Cashier payment recommendations generated", insights);
});

/**
 * Get AI Patient Buddy details (chatbot symptom/explainer checker)
 */
const getPatientBuddy = asyncHandler(async (req, res) => {
  const { queryType, content } = req.body;
  if (!queryType || !content) {
    throw new AppError("Query type and contextual content text are required", 400);
  }

  const response = await aiService.getPatientBuddyResponse(queryType, content);
  return successResponse(res, 200, "AI Patient Buddy response generated", response);
});

/**
 * AI Medical Scribe (auto-generate consultation notes)
 */
const getMedicalScribe = asyncHandler(async (req, res) => {
  const { shorthandText } = req.body;
  if (!shorthandText) {
    throw new AppError("Shorthand text is required for clinical transcription", 400);
  }

  const scribeDraft = await aiService.getMedicalScribeDraft(shorthandText);
  return successResponse(res, 200, "AI scribe draft compiled", scribeDraft);
});

/**
 * AI Diagnosis Suggestions (assist doctors only)
 */
const getDoctorDiagnosis = asyncHandler(async (req, res) => {
  const { vitals, complaints } = req.body;
  if (req.user.role !== "DOCTOR" && req.user.role !== "SUPER_ADMIN" && req.user.role !== "ADMIN") {
    throw new AppError("Access denied: Differential diagnosis hints are restricted to doctors.", 403);
  }

  const suggestions = await aiService.getDoctorDiagnosisSuggestions(vitals, complaints);
  return successResponse(res, 200, "AI Diagnosis suggestions compiled", suggestions);
});

/**
 * AI Prescription Assistant
 */
const getPrescriptionCheck = asyncHandler(async (req, res) => {
  const { medications, patientAllergies } = req.body;
  const analysis = await aiService.getPrescriptionAssistantCheck(medications, patientAllergies);
  return successResponse(res, 200, "AI prescription check completed", analysis);
});

/**
 * AI Patient Summary (medical history summary)
 */
const getPatientSummaryById = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  if (!patientId) {
    throw new AppError("Patient ID parameter is required", 400);
  }

  const summary = await aiService.getPatientSummary(patientId);
  return successResponse(res, 200, "AI EMR history summary loaded", summary);
});

/**
 * AI Medical Report Summarizer
 */
const getReportSummary = asyncHandler(async (req, res) => {
  const { fileName, textContent } = req.body;
  if (!fileName || !textContent) {
    throw new AppError("File name and text content details are required for summarization", 400);
  }

  const summary = await aiService.getMedicalReportSummary(fileName, textContent);
  return successResponse(res, 200, "AI document summary completed", summary);
});

/**
 * AI Pharmacy Forecast (stock and expiry prediction)
 */
const getPharmacyForecast = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospital;
  if (!hospitalId) {
    throw new AppError("No hospital associated with this user session", 400);
  }

  const forecasts = await aiService.getPharmacyForecast(hospitalId);
  return successResponse(res, 200, "AI Pharmacy forecasting metrics loaded", forecasts);
});

/**
 * AI Queue Waiting Time Prediction
 */
const getQueuePrediction = asyncHandler(async (req, res) => {
  const { doctorId, date } = req.body;
  const prediction = await aiService.getQueueWaitingTimePrediction(doctorId, date);
  return successResponse(res, 200, "AI queue waiting prediction loaded", prediction);
});

/**
 * AI Follow-up Recommendations
 */
const getFollowUpRecommendations = asyncHandler(async (req, res) => {
  const { diagnosis, lastVitals } = req.body;
  const recommendations = await aiService.getFollowUpRecommendations(diagnosis, lastVitals);
  return successResponse(res, 200, "AI follow-up scheduling guidelines loaded", recommendations);
});

/**
 * AI Emergency Vitals Check (Flags red alerts)
 */
const getVitalsEmergencyCheck = asyncHandler(async (req, res) => {
  const { vitals } = req.body;
  const alert = await aiService.getEmergencyVitalsAlert(vitals);
  return successResponse(res, 200, "AI vitals check complete", alert);
});

module.exports = {
  getDashboardInsights,
  getReceptionistAssistance,
  getLabAnalysis,
  getPharmacyCompanion,
  getCashierInsights,
  getPatientBuddy,
  getMedicalScribe,
  getDoctorDiagnosis,
  getPrescriptionCheck,
  getPatientSummaryById,
  getReportSummary,
  getPharmacyForecast,
  getQueuePrediction,
  getFollowUpRecommendations,
  getVitalsEmergencyCheck,
};
