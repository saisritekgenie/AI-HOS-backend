const dotenv = require("dotenv");
dotenv.config();

const app = require("./src/app");
const connectDB = require("./src/config/db.js");

const PORT = process.env.PORT || 8086;

// Connect to Database and start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 AI Hospital Server running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error("Failed to connect to DB, starting server without DB connection for debugging:", err.message);
  app.listen(PORT, () => {
    console.log(`🚀 AI Hospital Server running on http://localhost:${PORT}`);
  });
});