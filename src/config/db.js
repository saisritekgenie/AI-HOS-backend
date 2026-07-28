const mongoose = require("mongoose");

/**
 * Connect to MongoDB database using Mongoose
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ai_hospital_db");
    console.log(`🍃 MongoDB Connected: ${conn.connection.host}`);

    // Auto-seed default Super Admin if none exists
    const User = require("../models/userModel");
    const superAdminExists = await User.findOne({ role: "SUPER_ADMIN" });
    if (!superAdminExists) {
      console.log("🛠️ Seeding default Super Admin user...");
      await User.create({
        firstName: "Super",
        lastName: "Admin",
        mobile: "9999999999",
        email: "superadmin@gmail.com",
        password: "superadmin123",
        gender: "MALE",
        role: "SUPER_ADMIN",
        status: "ACTIVE"
      });
      console.log("✅ Default Super Admin seeded: superadmin@gmail.com / superadmin123");
    }
  } catch (error) {
    console.error(`❌ Database Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
