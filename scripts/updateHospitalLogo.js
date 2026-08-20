const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const Hospital = require("../src/models/hospitalModel");

const run = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("MONGO_URI is missing from environmental parameters!");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected successfully to database...");

    const hospitals = await Hospital.find({});
    console.log(`Found ${hospitals.length} hospitals. Updating...`);

    for (const h of hospitals) {
      // Update logoUrl to point to the premium real hospital logo in the public assets directory
      h.logoUrl = "/real_hospital_logo.jpg";
      if (h.name.toLowerCase().includes("kims")) {
        h.name = "KIMS Health & Medical";
      }
      if (!h.location) {
        h.location = "Main Campus";
      }
      await h.save();
      console.log(`Updated hospital: ${h.name} (${h.code}) with logoUrl.`);
    }

    console.log("Migration complete!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
};

run();
