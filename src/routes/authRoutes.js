const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { validateLogin } = require("../validations/authValidation");
const { protect } = require("../middleware/authMiddleware");

// Public route: Login
router.post("/login", validateLogin, authController.login);
router.post("/patient-login", authController.patientLogin);

// Public route: Get host system local IP address for mobile testing
router.get("/system-ip", authController.getSystemIp);

// Private routes: Profile & Security management
router.get("/me", protect, authController.getMe);
router.put("/profile", protect, authController.updateProfile);
router.put("/change-password", protect, authController.changePassword);

module.exports = router;
