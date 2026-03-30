import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../models/user.js";

await mongoose.connect(process.env.MONGO_URI);

const users = await User.find({}, "username").lean();

const grouped = new Map();

for (const user of users) {
  const lower = String(user.username || "").trim().toLowerCase();
  if (!grouped.has(lower)) grouped.set(lower, []);
  grouped.get(lower).push(user.username);
}

const collisions = [...grouped.entries()].filter(([, values]) => values.length > 1);

if (!collisions.length) {
  console.log("No username collisions found.");
} else {
  console.log("Username collisions found:");
  for (const [lower, values] of collisions) {
    console.log(lower, "=>", values);
  }
}

await mongoose.disconnect();