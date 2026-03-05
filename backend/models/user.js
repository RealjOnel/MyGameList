import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, unique: true },
    passwordHash: { type: String, required: true },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false } // we handle it ourselves now
);

userSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  if (!this.createdAt) this.createdAt = this.updatedAt;
  next();
});

export const User = mongoose.model("User", userSchema);
