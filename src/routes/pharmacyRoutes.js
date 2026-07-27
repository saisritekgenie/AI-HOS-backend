const express = require("express");
const router = express.Router();
const pharmacyController = require("../controllers/pharmacyController");
const { protect, restrictTo } = require("../middleware/authMiddleware");

// All pharmacy endpoints are restricted to authenticated staff (Pharmacist, Cashier, Admin, Super Admin)
router.use(protect);
router.use(
  restrictTo(
    "SUPER_ADMIN",
    "ADMIN",
    "DOCTOR",
    "NURSE",
    "PHARMACIST"
  )
);

// Statistics Dashboard
router.get("/stats", pharmacyController.getDashboardStats);

// Inventory Management
router.route("/inventory")
  .get(pharmacyController.getInventory)
  .post(pharmacyController.addMedicine);

router.put("/inventory/:id", pharmacyController.updateMedicineStock);

// Dispensing prescriptions
router.put("/prescriptions/:id/dispense", pharmacyController.dispensePrescription);

// Billing
router.route("/bills")
  .get(pharmacyController.getPharmacyBills)
  .post(pharmacyController.generatePharmacyBill);

router.put("/bills/:id/pay", pharmacyController.payPharmacyBill);

module.exports = router;
