const dns = require("node:dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../src/models/userModel");

dotenv.config();

const run = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("MONGO_URI not found in env variables!");
      process.exit(1);
    }
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB...");
    
    // Fetch all users to leverage Mongoose's field-level decryption on instantiation
    const users = await User.find({});
    const user = users.find(u => u.email && u.email.toLowerCase() === "saiteja@gmail.com");
    
    if (!user) {
      console.error("User saiteja@gmail.com not found!");
      process.exit(1);
    }
    
    console.log("Found User:", {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      status: user.status
    });

    // Reset password to "saiteja123"
    user.password = "saiteja123";
    await user.save();
    
    console.log("✅ Success: Password for saiteja@gmail.com has been reset to: saiteja123");
    process.exit(0);
  } catch (err) {
    console.error("Error resetting password:", err);
    process.exit(1);
  }
};
run();
