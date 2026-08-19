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

    const users = await User.find({});
    console.log(`Fetched ${users.length} users. Searching...`);

    const results = [];
    for (const u of users) {
      const matchName = (u.firstName && u.firstName.toLowerCase().includes("saiteja")) ||
        (u.lastName && u.lastName.toLowerCase().includes("saiteja")) ||
        (u.firstName && u.firstName.toLowerCase().includes("kims")) ||
        (u.lastName && u.lastName.toLowerCase().includes("kims")) ||
        (u.email && u.email.toLowerCase().includes("saiteja")) ||
        (u.email && u.email.toLowerCase().includes("kims"));
      if (matchName) {
        results.push({
          id: u._id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          mobile: u.mobile,
          role: u.role,
          status: u.status
        });
      }
    }

    console.log("SEARCH_RESULTS_START");
    console.log(JSON.stringify(results, null, 2));
    console.log("SEARCH_RESULTS_END");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
run();
