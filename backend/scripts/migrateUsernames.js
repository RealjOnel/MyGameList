import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../models/user.js";

await mongoose.connect(process.env.MONGO_URI);

const users = await User.find({});
let updated = 0;

for (const user of users) {
  const currentUsername = String(user.username || "").trim();
  if (!currentUsername) continue;

  user.displayUsername = user.displayUsername || currentUsername;
  user.username = currentUsername.toLowerCase();
  await user.save();
  updated++;
}

console.log(`Migrated ${updated} users.`);
await mongoose.disconnect();