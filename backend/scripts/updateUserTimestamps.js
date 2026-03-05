import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { User } from "../models/user.js";

async function main(){
  await mongoose.connect(process.env.MONGO_URI);
  console.log("connected");

  // find users missing createdAt
  const users = await User.find({ createdAt: { $exists: false } }).select("_id createdAt updatedAt");
  console.log("found:", users.length);

  if (!users.length){
    await mongoose.disconnect();
    console.log("nothing to do");
    return;
  }

  const ops = users.map(u => {
    const createdAt = u._id.getTimestamp(); // from ObjectId
    const updatedAt = u.updatedAt ?? createdAt;
    return {
      updateOne: {
        filter: { _id: u._id },
        update: { $set: { createdAt, updatedAt } }
      }
    };
  });

  const r = await User.bulkWrite(ops, { ordered: false });
  console.log("modified:", r.modifiedCount);

  await mongoose.disconnect();
  console.log("done");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});