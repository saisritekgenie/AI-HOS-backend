const express = require("express");
const router = express.Router();
const clinicalController = require("../controllers/clinicalController");
const { protect, restrictTo } = require("../middleware/authMiddleware");

// All clinical endpoints are protected
router.use(protect);

// Allow patient role to fetch their own clinical records summary
router.get("/patient/:patientId", clinicalController.getPatientClinicalSummary);

// Staff restricted clinical endpoints
router.use(
  restrictTo(
    "SUPER_ADMIN",
    "ADMIN",
    "DOCTOR",
    "RECEPTIONIST",
    "NURSE",
    "LAB_TECHNICIAN",
    "PHARMACIST",
    "CASHIER"
  )
);

// Dashboard statistics
router.get("/dashboard-stats", clinicalController.getDashboardStats);

// Hospital-wide pending tasks, medications and critical vital alerts
router.get("/all-pending-tasks", clinicalController.getAllPendingTasks);
router.get("/all-pending-medications", clinicalController.getAllPendingMedications);
router.get("/all-critical-alerts", clinicalController.getAllCriticalAlerts);

// Patient allocation and charting summary
router.put("/patient/:patientId", clinicalController.updatePatientAssignment);

// Record vitals & nursing notes
router.post("/patient/:patientId/vitals", clinicalController.addPatientVitals);
router.post("/patient/:patientId/notes", clinicalController.addNursingNote);

// Doctor EMR (Consultations, Prescriptions, Nurse Tasks, Lab Orders)
router.post("/patient/:patientId/consultation", clinicalController.addConsultation);
router.post("/patient/:patientId/prescription", clinicalController.addPrescription);
router.post("/patient/:patientId/instruction", clinicalController.addDoctorInstruction);
router.post("/patient/:patientId/lab-order", clinicalController.orderLabTest);
router.put("/patient/:patientId/clinical-tags", clinicalController.updatePatientClinicalTags);
router.post("/patient/:patientId/documents", clinicalController.addPatientDocument);

// Action records updates
router.put("/medications/:id/administer", clinicalController.administerMedication);
router.put("/instructions/:id/complete", clinicalController.completeInstruction);
router.put("/labs/:id/collect", clinicalController.collectLabSample);

// Lab Technician diagnostic workflows
router.get("/labs", clinicalController.getLabRequests);
router.put("/labs/:id/status", clinicalController.updateLabStatus);
router.put("/labs/:id/complete", clinicalController.completeLabTest);

module.exports = router;
