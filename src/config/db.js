const mongoose = require("mongoose");

/**
 * Connect to MongoDB database using Mongoose
 */
const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ai_hospital_db";
  const localFallbackUri = "mongodb://127.0.0.1:27017/ai_hospital_db";
  
  try {
    console.log("🍃 Attempting to connect to primary MongoDB...");
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`🍃 MongoDB Connected: ${conn.connection.host}`);
    await seedSuperAdmin();
  } catch (error) {
    console.warn(`⚠️ Primary MongoDB connection failed: ${error.message}`);
    if (mongoUri !== localFallbackUri) {
      console.log("🍃 Attempting connection to local MongoDB fallback...");
      try {
        const conn = await mongoose.connect(localFallbackUri, {
          serverSelectionTimeoutMS: 3000
        });
        console.log(`🍃 Local MongoDB Connected: ${conn.connection.host}`);
        await seedSuperAdmin();
      } catch (fallbackError) {
        console.error(`❌ Local fallback also failed: ${fallbackError.message}`);
        throw new Error(`Primary DB: ${error.message} | Local DB: ${fallbackError.message}`);
      }
    } else {
      throw error;
    }
  }
};

const seedSuperAdmin = async () => {
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
};

module.exports = connectDB;
