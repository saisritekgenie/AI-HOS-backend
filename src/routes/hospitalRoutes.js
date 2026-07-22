const express = require("express");
const router = express.Router();
const hospitalController = require("../controllers/hospitalController");
const { protect, restrictTo } = require("../middleware/authMiddleware");

// Public route: Self registration for new hospital
router.post("/register", hospitalController.registerHospital);

// Protected SUPER_ADMIN routes
router.use(protect);
router.use(restrictTo("SUPER_ADMIN"));

router.get("/", hospitalController.getHospitals);
router.put("/:id/approve", hospitalController.approveHospital);
router.put("/:id/reject", hospitalController.rejectHospital);

module.exports = router;
