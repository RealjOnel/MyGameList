import nodemailer from "nodemailer";
import { env } from "../config/validateEnv.js";

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });

  return cachedTransporter;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

export async function sendBugReportMail({ ticket, files = [] }) {
  const transporter = getTransporter();

  const subject = `[MGL Bug Report #${ticket.ticketNumber}] ${ticket.subject}`;

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <h2>New Bug Report</h2>

      <p><strong>Ticket:</strong> #${escapeHtml(ticket.ticketNumber)}</p>
      <p><strong>Type:</strong> ${escapeHtml(ticket.type)}</p>
      <p><strong>Status:</strong> ${escapeHtml(ticket.status)}</p>

      <hr>

      <p><strong>Reporter Username:</strong> ${escapeHtml(ticket.reporter.username || "Guest")}</p>
      <p><strong>Reporter Email:</strong> ${escapeHtml(ticket.reporter.email)}</p>
      <p><strong>User ID:</strong> ${escapeHtml(ticket.reporter.userId ? String(ticket.reporter.userId) : "Guest / none")}</p>

      <hr>

      <p><strong>Subject:</strong> ${escapeHtml(ticket.subject)}</p>
      <p><strong>Page URL:</strong> ${escapeHtml(ticket.pageUrl || "—")}</p>
      <p><strong>Browser Info:</strong> ${escapeHtml(ticket.browserInfo || "—")}</p>

      <h3>Message</h3>
      <div style="white-space: pre-wrap; border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px;">
        ${escapeHtml(ticket.message)}
      </div>
    </div>
  `;

  const text = [
    `New Bug Report`,
    ``,
    `Ticket: #${ticket.ticketNumber}`,
    `Type: ${ticket.type}`,
    `Status: ${ticket.status}`,
    ``,
    `Reporter Username: ${ticket.reporter.username || "Guest"}`,
    `Reporter Email: ${ticket.reporter.email}`,
    `User ID: ${ticket.reporter.userId ? String(ticket.reporter.userId) : "Guest / none"}`,
    ``,
    `Subject: ${ticket.subject}`,
    `Page URL: ${ticket.pageUrl || "—"}`,
    `Browser Info: ${ticket.browserInfo || "—"}`,
    ``,
    `Message:`,
    ticket.message
  ].join("\n");

  await transporter.sendMail({
    from: `"MyGameList Support" <${env.SUPPORT_EMAIL_FROM}>`,
    to: env.SUPPORT_EMAIL_TO,
    replyTo: ticket.reporter.email,
    subject,
    text,
    html,
    attachments: files.map((file) => ({
      filename: file.originalname,
      content: file.buffer,
      contentType: file.mimetype
    }))
  });
}