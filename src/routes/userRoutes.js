const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const {
  validateCreateUser,
  validateUpdateUser,
  validateUserIdParam,
} = require("../validations/userValidation");
const { protect, restrictTo } = require("../middleware/authMiddleware");

// Apply authentication & role restrictions to user management routes
router.use(protect);
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

// Route: /api/super-admin/users
router
  .route("/")
  .post(validateCreateUser, userController.createUser)
  .get(userController.getUsers);

router
  .route("/check-duplicate")
  .post(userController.checkDuplicatePatient);

router
  .route("/merge")
  .post(userController.mergePatients);

// Route: /api/super-admin/users/:id/enable
router
  .route("/:id/enable")
  .put(validateUserIdParam, userController.enableUser);

// Route: /api/super-admin/users/:id/disable
router
  .route("/:id/disable")
  .put(validateUserIdParam, userController.disableUser);

// Route: /api/super-admin/users/:id
router
  .route("/:id")
  .get(validateUserIdParam, userController.getUserById)
  .put(validateUpdateUser, userController.updateUser)
  .delete(validateUserIdParam, userController.deleteUser);

module.exports = router;
