import mongoose from "mongoose";

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: Number,
      required: true,
      unique: true,
      index: true
    },

    type: {
      type: String,
      enum: ["bug_report"],
      default: "bug_report",
      required: true
    },

    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
      required: true
    },

    reporter: {
      username: {
        type: String,
        default: ""
      },
      email: {
        type: String,
        required: true
      },
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
      }
    },

    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000
    },

    pageUrl: {
      type: String,
      default: "",
      maxlength: 500
    },

    browserInfo: {
      type: String,
      default: "",
      maxlength: 500
    },

    attachments: [
      {
        originalName: { type: String, required: true },
        mimeType: { type: String, required: true },
        size: { type: Number, required: true }
      }
    ],

    mailSentAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

export const SupportTicket = mongoose.model("SupportTicket", supportTicketSchema);