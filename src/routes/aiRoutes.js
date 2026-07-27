const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const { protect } = require("../middleware/authMiddleware");

// All AI service endpoints require secure authentication sessions
router.use(protect);

router.get("/dashboard-insights", aiController.getDashboardInsights);
router.post("/receptionist-assistance", aiController.getReceptionistAssistance);
router.post("/lab-analysis", aiController.getLabAnalysis);
router.post("/pharmacy-companion", aiController.getPharmacyCompanion);
router.get("/cashier-insights", aiController.getCashierInsights);
router.post("/patient-buddy", aiController.getPatientBuddy);

// Enterprise additions
router.post("/medical-scribe", aiController.getMedicalScribe);
router.post("/diagnosis-suggestions", aiController.getDoctorDiagnosis);
router.post("/prescription-check", aiController.getPrescriptionCheck);
router.get("/patient-summary/:patientId", aiController.getPatientSummaryById);
router.post("/summarize-report", aiController.getReportSummary);
router.get("/pharmacy-forecast", aiController.getPharmacyForecast);
router.post("/queue-prediction", aiController.getQueuePrediction);
router.post("/followup-recommendations", aiController.getFollowUpRecommendations);
router.post("/vitals-emergency-check", aiController.getVitalsEmergencyCheck);

module.exports = router;
