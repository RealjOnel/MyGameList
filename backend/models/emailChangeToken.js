import mongoose from "mongoose";

const emailChangeTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    newEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true
    },

    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: false }
);

emailChangeTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailChangeToken = mongoose.model("EmailChangeToken", emailChangeTokenSchema);