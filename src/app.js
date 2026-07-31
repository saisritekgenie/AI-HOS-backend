const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const hospitalRoutes = require("./routes/hospitalRoutes");
const clinicalRoutes = require("./routes/clinicalRoutes");
const receptionRoutes = require("./routes/receptionRoutes");
const pharmacyRoutes = require("./routes/pharmacyRoutes");
const billingRoutes = require("./routes/billingRoutes");
const aiRoutes = require("./routes/aiRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");


// Role-based AI Routes
const adminAIRoutes = require("./routes/ai/adminAIRoutes");
const receptionistAIRoutes = require("./routes/ai/receptionistAIRoutes");
const doctorAIRoutes = require("./routes/ai/doctorAIRoutes");
const nurseAIRoutes = require("./routes/ai/nurseAIRoutes");
const labTechnicianAIRoutes = require("./routes/ai/labTechnicianAIRoutes");
const pharmacistAIRoutes = require("./routes/ai/pharmacistAIRoutes");
const cashierAIRoutes = require("./routes/ai/cashierAIRoutes");
const patientAIRoutes = require("./routes/ai/patientAIRoutes");
const globalErrorHandler = require("./middleware/errorMiddleware");
const AppError = require("./utils/appError");

// Load environment variables
dotenv.config();

const app = express();

// Global Middlewares
app.use(helmet());
app.use(cors());

// Configure global rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again after 15 minutes."
  }
});
app.use(limiter);

// Specific rate limit for AI routes (expensive calls)
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 15, // Limit each IP to 15 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many AI requests. Please wait a minute before requesting assistance."
  }
});
app.use("/api/ai", aiLimiter);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.originalUrl} | Query:`, req.query);
  next();
});

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
app.use("/api/clinical", clinicalRoutes);
app.use("/api/reception", receptionRoutes);
app.use("/api/pharmacy", pharmacyRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/audit-logs", auditLogRoutes);


// Mount Role-based AI Routes
app.use("/api/ai/admin", adminAIRoutes);
app.use("/api/ai/receptionist", receptionistAIRoutes);
app.use("/api/ai/doctor", doctorAIRoutes);
app.use("/api/ai/nurse", nurseAIRoutes);
app.use("/api/ai/lab-technician", labTechnicianAIRoutes);
app.use("/api/ai/pharmacist", pharmacistAIRoutes);
app.use("/api/ai/cashier", cashierAIRoutes);
app.use("/api/ai/patient", patientAIRoutes);

// Handle Unhandled / 404 Routes
app.use((req, res, next) => {
  next(new AppError(`Cannot find endpoint ${req.originalUrl} on this server`, 404));
});

// Centralized Error Handling Middleware
app.use(globalErrorHandler);

module.exports = app;