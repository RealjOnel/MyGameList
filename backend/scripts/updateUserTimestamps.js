import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { User } from "../models/user.js";

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in env");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected");

  // Find users missing createdAt or updatedAt
  const users = await User.find({
    $or: [
      { createdAt: { $exists: false } },
      { updatedAt: { $exists: false } }
    ]
  }).select("_id createdAt updatedAt").lean();

  if (users.length === 0) {
    console.log("No users to backfill.");
    await mongoose.disconnect();
    return;
  }

  // Use ObjectId timestamp as a decent approximation for createdAt
  const ops = users.map(u => {
    const ts = u._id instanceof mongoose.Types.ObjectId ? u._id.getTimestamp() : new Date();
    const createdAt = u.createdAt ?? ts;
    const updatedAt = u.updatedAt ?? createdAt;

    return {
      updateOne: {
        filter: { _id: u._id },
        update: { $set: { createdAt, updatedAt } }
      }
    };
  });

  const result = await User.bulkWrite(ops, { ordered: false });
  console.log("Backfilled users:", result.modifiedCount);

  await mongoose.disconnect();
  console.log("Done");
}

main().catch(err => {
  console.error("❌ Backfill failed:", err);
  process.exit(1);
});