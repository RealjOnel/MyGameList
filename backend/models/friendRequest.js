import mongoose from "mongoose";

const friendRequestSchema = new mongoose.Schema(
  {
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "cancelled"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

// only one friend request between two users at a time
friendRequestSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });

export const FriendRequest = mongoose.model("FriendRequest", friendRequestSchema);