const express = require("express");
const router = express.Router();
const receptionController = require("../controllers/receptionController");
const { protect, restrictTo } = require("../middleware/authMiddleware");

// All receptionist endpoints require login
router.use(protect);

// Allow patient role to fetch their own outpatient invoices
router.get("/invoices", receptionController.getInvoices);

router.use(
  restrictTo(
    "SUPER_ADMIN",
    "ADMIN",
    "DOCTOR",
    "RECEPTIONIST"
  )
);

// Stats
router.get("/dashboard-stats", receptionController.getDashboardStats);

// Appointments
router.route("/appointments")
  .get(receptionController.getAppointments)
  .post(receptionController.bookAppointment);

router.put("/appointments/:id", receptionController.updateAppointmentStatus);

// Invoices (Billing)
router.post("/invoices", receptionController.createInvoice);

router.put("/invoices/:id/pay", receptionController.payInvoice);

// Admissions
router.route("/admissions")
  .get(receptionController.getAdmissions)
  .post(receptionController.createAdmission);

router.put("/admissions/:id/discharge", receptionController.dischargePatient);

module.exports = router;
