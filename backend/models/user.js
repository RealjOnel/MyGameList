import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    profile: {
      bio: { type: String, default: "", maxlength: 100, trim: true },
      links: {
        discord: { type: String, default: "", trim: true },
        youtube: { type: String, default: "", trim: true },
        twitch: { type: String, default: "", trim: true },
        steam: { type: String, default: "", trim: true },
        website: { type: String, default: "", trim: true },
      },
      optionalFields: {
        location: { type: String, default: "", trim: true },
        favoriteGenre: { type: String, default: "", trim: true },
        favoritePlatform: { type: String, default: "", trim: true },
      },
    },

    social: {
      showFriendsList: { type: Boolean, default: true },
      showReviews: { type: Boolean, default: true },
      showForumActivity: { type: Boolean, default: true },
      showFavoriteGames: { type: Boolean, default: true },
      showActivityHistory: { type: Boolean, default: true },
      allowProfileComments: { type: Boolean, default: true },
      showProfileComments: { type: Boolean, default: true },
    },

    privacy: {
      publicProfile: { type: Boolean, default: true },
      showProfileInSearch: { type: Boolean, default: true },
      allowDirectFriendRequests: { type: Boolean, default: true },
      cookies: {
        preferences: { type: Boolean, default: true },
        analytics: { type: Boolean, default: false },
      },
    },

    customization: {
      defaultExploreView: {
        type: String,
        enum: ["grid", "compact", "table"],
        default: "grid",
      },
      compactInterface: { type: Boolean, default: false },
      reducedMotion: { type: Boolean, default: false },
      liveSearchSuggestions: { type: Boolean, default: true },
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true, minlength: 3, maxlength: 20 },
    displayUsername: { type: String, required: true, trim: true, minlength: 3, maxlength: 20 },
    email: { type: String, unique: true },
    passwordHash: { type: String, required: true },

    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: [],
      },
    ],

    settings: {
      type: settingsSchema,
      default: () => ({}),
    },

    createdAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date, default: null },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const User = mongoose.model("User", userSchema);