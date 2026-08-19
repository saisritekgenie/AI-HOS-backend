const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const path = require("path");
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
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

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

// Seed standard mock report files in uploads directory on startup to prevent 404s
try {
  const fs = require("fs");
  const path = require("path");
  const uploadsDir = path.join(__dirname, "../uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const mockFiles = [
    "cbc_panel_report.html",
    "urine_test_report.html",
    "lipid_profile_report.html",
    "random_blood_sugar_report.html"
  ];

  mockFiles.forEach(fileName => {
    const filePath = path.join(uploadsDir, fileName);
    if (!fs.existsSync(filePath)) {
      const prettyTestName = fileName.replace(/_report\.html$/, "").replace(/_/g, " ").toUpperCase();
      const content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Laboratory Report - ${prettyTestName}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #0f172a; max-width: 650px; margin: 0 auto; line-height: 1.5; background-color: #f8fafc; }
    .report-card { background: white; padding: 40px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); position: relative; overflow: hidden; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; border-bottom: 2px solid #10b981; padding-bottom: 15px; }
    .hospital-title { font-size: 22px; font-weight: 800; color: #10b981; text-transform: uppercase; margin: 0; }
    .doc-title { font-size: 13px; font-weight: 700; color: #475569; letter-spacing: 1px; text-transform: uppercase; margin: 4px 0 0 0; }
    .badge { font-size: 11px; font-weight: 800; color: #ef4444; border: 2px solid #ef4444; padding: 3px 6px; border-radius: 4px; display: inline-block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 8px; margin-bottom: 25px; font-size: 13px; }
    .meta-item { color: #334155; }
    .result-card { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 25px; }
    .result-card h3 { color: #15803d; margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; }
    .result-text { font-size: 13px; color: #1e293b; line-height: 1.6; white-space: pre-line; }
    .footer { border-top: 1px dashed #cbd5e1; margin-top: 40px; padding-top: 15px; text-align: center; font-size: 11px; color: #64748b; }
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 60px; color: rgba(239, 68, 68, 0.05); font-weight: 900; letter-spacing: 4px; pointer-events: none; white-space: nowrap; user-select: none; text-transform: uppercase; z-index: 1; }
  </style>
</head>
<body>
  <div class="report-card">
    <div class="watermark">DUPLICATE REPORT</div>
    <table class="header-table">
      <tr>
        <td>
          <h1 class="hospital-title">KIMS Hospital</h1>
          <h2 class="doc-title">Pathology & Diagnostic Lab Report</h2>
        </td>
        <td style="text-align: right; font-size: 11px; color: #64748b;">
          <div class="badge">DUPLICATE COPY</div>
          <div>Report Date: ${new Date().toLocaleDateString()}</div>
          <div>Status: RELEASED</div>
        </td>
      </tr>
    </table>

    <div class="meta-grid">
      <div class="meta-item"><strong>Patient Name:</strong> Pravalika Pendam</div>
      <div class="meta-item"><strong>UHID (Patient ID):</strong> UHID-2026-9091</div>
      <div class="meta-item"><strong>Test Parameter:</strong> ${prettyTestName}</div>
      <div class="meta-item"><strong>Ordered By:</strong> Dr. Kushi Doctor</div>
    </div>

    <div class="result-card">
      <h3>Diagnostic Findings</h3>
      <div class="result-text">Standard physiological parameters fall within normal reference values.
No clinical pathology detected on diagnostic screen.</div>
    </div>

    <div style="font-size: 12px; color: #64748b; margin-top: 20px;">
      <strong>Lab Assistant Notes:</strong> Test completed and verified by pathology technician.
    </div>

    <div class="footer">
      * Verified Medical Diagnostic Document. *
    </div>
  </div>
</body>
</html>`;
      fs.writeFileSync(filePath, content);
      console.log(`Created mock report file: ${fileName}`);
    }
  });
} catch (err) {
  console.error("Failed to seed mock report files at startup:", err);
}

module.exports = app;