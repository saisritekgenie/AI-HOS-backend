const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../src/models/userModel");

dotenv.config();

const seed = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("MONGO_URI not found in env variables!");
      process.exit(1);
    }
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB Atlas for seeding...");

    // Check if superadmin already exists
    const adminExists = await User.findOne({ email: "superadmin@gmail.com" });
    if (adminExists) {
      console.log("Super Admin user already exists!");
    } else {
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
      console.log("Super Admin user seeded successfully! Email: superadmin@gmail.com / Password: superadmin123");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error seeding users:", error.message);
    process.exit(1);
  }
};

seed();
