import mongoose from "mongoose";

const REVIEW_RECOMMENDATIONS = ["recommended", "mixed", "not"];

const reviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    gameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Game",
      required: true,
      index: true
    },

    recommendation: {
      type: String,
      enum: REVIEW_RECOMMENDATIONS,
      required: true,
      index: true
    },

    html: {
      type: String,
      required: true,
      maxlength: 12000
    },

    plainText: {
      type: String,
      required: true,
      maxlength: 3000
    }
  },
  { timestamps: true }
);

// exactly one review per user per game
reviewSchema.index({ userId: 1, gameId: 1 }, { unique: true });

// useful for game page sorting/filtering
reviewSchema.index({ gameId: 1, createdAt: -1 });
reviewSchema.index({ gameId: 1, recommendation: 1, createdAt: -1 });

// useful for profile page
reviewSchema.index({ userId: 1, createdAt: -1 });

export const Review = mongoose.model("Review", reviewSchema);