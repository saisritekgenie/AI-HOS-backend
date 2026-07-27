const express = require("express");
const router = express.Router();
const billingController = require("../controllers/billingController");
const { protect, restrictTo } = require("../middleware/authMiddleware");

// All cashier/billing endpoints require login
router.use(protect);

// Allow patient role to fetch their own inpatient billing invoices
router.get("/invoices", billingController.getInvoices);

router.use(
  restrictTo(
    "SUPER_ADMIN",
    "ADMIN",
    "RECEPTIONIST",
    "CASHIER"
  )
);

// Statistics Dashboard
router.get("/stats", billingController.getDashboardStats);

// Invoice routes
router.post("/invoices", billingController.createInvoice);
router.put("/invoices/:id/pay", billingController.payInvoice);
router.put("/invoices/:id/refund", billingController.refundInvoice);

// Integrations
router.get("/integrations/patient/:patientId", billingController.getPatientUnpaidCharges);

// Advances
router.post("/advances", billingController.createAdvancePayment);
router.get("/advances/patient/:patientId", billingController.getPatientAdvanceBalance);

// Inpatient Discharge billing
router.get("/discharge/summary/:patientId", billingController.getDischargeSummary);
router.post("/discharge/bill", billingController.generateDischargeBill);

// Reports
router.get("/reports/daily-cash", billingController.getDailyCashReport);

module.exports = router;
