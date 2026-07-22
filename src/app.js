const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const hospitalRoutes = require("./routes/hospitalRoutes");
const globalErrorHandler = require("./middleware/errorMiddleware");
const AppError = require("./utils/appError");

// Load environment variables
dotenv.config();

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check / Root Route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "AI Hospital Management System API is running smoothly",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/super-admin/users", userRoutes);
app.use("/api/super-admin/hospitals", hospitalRoutes);

// Handle Unhandled / 404 Routes
app.use((req, res, next) => {
  next(new AppError(`Cannot find endpoint ${req.originalUrl} on this server`, 404));
});

// Centralized Error Handling Middleware
app.use(globalErrorHandler);

module.exports = app;