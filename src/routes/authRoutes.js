const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { validateLogin } = require("../validations/authValidation");
const { protect } = require("../middleware/authMiddleware");

// Public route: Login
router.post("/login", validateLogin, authController.login);

// Private route: Get current user profile
router.get("/me", protect, authController.getMe);

module.exports = router;
