import mongoose from "mongoose";

const gameSchema = new mongoose.Schema(
  {
    igdbId: { type: Number, required: true, unique: true, index: true },

    name: { type: String, required: true, trim: true },
    coverImageId: { type: String, default: null },

    summary: { type: String, default: "" },
    storyline: { type: String, default: "" },

    firstReleaseDate: { type: Date, default: null },

    genres: [{ type: String }],
    platforms: [{ type: String }],

    // IGDB ratings (optional cache)
    igdbRating: { type: Number, default: null },
    metacriticRating: { type: Number, default: null }, // IGDB aggregated_rating

    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Game = mongoose.model("Game", gameSchema);