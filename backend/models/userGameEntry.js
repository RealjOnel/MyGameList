import mongoose from "mongoose";

const STATUS = ["completed", "playing", "planned", "dropped", "on_hold"];

const userGameEntrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: "Game", required: true, index: true },

    status: { type: String, enum: STATUS, default: "planned", index: true },

    // rating 1..10 (null = not rated yet)
    rating: { type: Number, min: 1, max: 10, default: null },

    // optional, but you’ll want it soon anyway
    playtimeHours: { type: Number, min: 0, default: 0 },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

// One entry per user per game
userGameEntrySchema.index({ userId: 1, gameId: 1 }, { unique: true });

export const UserGameEntry = mongoose.model("UserGameEntry", userGameEntrySchema);