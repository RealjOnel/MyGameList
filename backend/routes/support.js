import express from "express";
import multer from "multer";
import { z } from "zod";
import { Counter } from "../models/counter.js";
import { SupportTicket } from "../models/supportTicket.js";
import { sendBugReportMail } from "../services/supportMailer.js";
import { User } from "../models/user.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 3,
    fileSize: 5 * 1024 * 1024
  },
  fileFilter(req, file, cb) {
    const allowed = ["image/png", "image/jpeg"];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only PNG and JPEG screenshots are allowed"));
    }

    cb(null, true);
  }
});

const bugReportSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(5, "Subject is too short")
    .max(120, "Subject is too long"),

  message: z
    .string()
    .trim()
    .min(20, "Message is too short")
    .max(4000, "Message is too long"),

  pageUrl: z
    .string()
    .trim()
    .max(500, "Page URL is too long")
    .optional()
    .or(z.literal("")),

  browserInfo: z
    .string()
    .trim()
    .max(500, "Browser info is too long")
    .optional()
    .or(z.literal(""))
});

function runUpload(req, res) {
  return new Promise((resolve, reject) => {
    upload.array("screenshots", 3)(req, res, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function getNextTicketNumber() {
  const counter = await Counter.findOneAndUpdate(
    { key: "support_bug_report_ticket" },
    { $inc: { value: 1 } },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  return counter.value;
}

// POST /api/support/bug-report
router.post("/bug-report", requireAuth, async (req, res) => {
  try {
    await runUpload(req, res);

    const parsed = bugReportSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0]?.message || "Invalid bug report payload"
      });
    }

    const { subject, message, pageUrl, browserInfo } = parsed.data;
    const files = Array.isArray(req.files) ? req.files : [];

    const user = await User.findById(req.userId).select(
      "_id username displayUsername email"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (!user.email) {
      return res.status(400).json({
        message: "Your account has no email address assigned"
      });
    }

    const safeUserId = user._id;
    const safeUsername = user.displayUsername || user.username || "Unknown User";
    const safeEmail = user.email;

    const ticketNumber = await getNextTicketNumber();

    const ticket = await SupportTicket.create({
      ticketNumber,
      type: "bug_report",
      status: "open",
      reporter: {
        username: safeUsername,
        email: safeEmail,
        userId: safeUserId
      },
      subject,
      message,
      pageUrl: pageUrl || "",
      browserInfo: browserInfo || "",
      attachments: files.map((file) => ({
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size
      }))
    });

    await sendBugReportMail({
      ticket,
      files
    });

    ticket.mailSentAt = new Date();
    await ticket.save();

    return res.status(201).json({
      message: "Bug report submitted successfully",
      ticketNumber: ticket.ticketNumber
    });
  } catch (err) {
    console.error("Bug report submit failed:", err);

    if (err?.message?.includes("Only PNG and JPEG")) {
      return res.status(400).json({
        message: err.message
      });
    }

    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "Each screenshot may be at most 5 MB"
      });
    }

    if (err?.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        message: "You can upload at most 3 screenshots"
      });
    }

    return res.status(500).json({
      message: "Failed to submit bug report"
    });
  }
});

export default router;