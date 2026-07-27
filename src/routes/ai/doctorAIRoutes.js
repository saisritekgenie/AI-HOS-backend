const express = require("express");
const router = express.Router();
const doctorAIController = require("../../controllers/ai/doctorAIController");
const { protect, restrictTo } = require("../../middleware/authMiddleware");

router.use(protect);
router.use(restrictTo("DOCTOR"));

router.get("/patient-summary/:patientId", doctorAIController.getPatientSummary);
router.post("/medical-scribe", doctorAIController.getMedicalScribe);
router.post("/diagnosis-suggestions", doctorAIController.getDoctorDiagnosis);
router.post("/prescription-check", doctorAIController.getPrescriptionCheck);
router.post("/followup-recommendations", doctorAIController.getFollowUpRecommendations);
router.post("/chat", doctorAIController.chat);

module.exports = router;
