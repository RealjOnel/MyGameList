import mongoose from "mongoose";

const ALLOWED_REVIEW_REACTIONS = ["👍", "❤️", "😂", "😮", "😭", "💀", "🌹"];

const reviewReactionSchema = new mongoose.Schema(
  {
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review",
      required: true,
      index: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    emoji: {
      type: String,
      enum: ALLOWED_REVIEW_REACTIONS,
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

// one user can only use the same emoji once per review
reviewReactionSchema.index(
  { reviewId: 1, userId: 1, emoji: 1 },
  { unique: true }
);

// helpful for aggregation/counting
reviewReactionSchema.index({ reviewId: 1, emoji: 1 });

export const ReviewReaction = mongoose.model("ReviewReaction", reviewReactionSchema);