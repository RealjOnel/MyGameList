import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    value: {
      type: Number,
      default: 0
    }
  },
  {
    versionKey: false,
    timestamps: false
  }
);

export const Counter = mongoose.model("Counter", counterSchema);