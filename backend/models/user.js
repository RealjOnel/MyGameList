import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, unique: true },
    passwordHash: { type: String, required: true },

    friends: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: []
    }],

    createdAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date, default: null },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const User = mongoose.model("User", userSchema);