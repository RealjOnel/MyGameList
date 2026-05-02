import nodemailer from "nodemailer";
import { env } from "../config/validateEnv.js";

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  console.log("[mail][email-change] Creating transporter", {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.NOREPLY_SMTP_USER,
    from: env.NOREPLY_EMAIL_FROM
  });

  cachedTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.NOREPLY_SMTP_USER,
      pass: env.NOREPLY_SMTP_PASS
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
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

export async function sendEmailChangeVerificationMail({ to, username, verifyUrl }) {
  const transporter = getTransporter();

  const subject = "Confirm your MyGameList email change";

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <h2>Confirm your email change</h2>

      <p>Hello ${escapeHtml(username || "Player")},</p>

      <p>
        We received a request to change the email address on your MyGameList account.
      </p>

      <p>
        Please confirm the new email address by clicking the button below:
      </p>

      <p style="margin: 24px 0;">
        <a
          href="${escapeHtml(verifyUrl)}"
          style="display: inline-block; padding: 12px 18px; border-radius: 10px; text-decoration: none; background: #2563eb; color: #ffffff; font-weight: 700;"
        >
          Confirm Email Change
        </a>
      </p>

      <p>
        This link will expire in 60 minutes.
      </p>

      <p>
        If you did not request this change, please ignore this email.
      </p>
    </div>
  `;

  const text = [
    `Confirm your email change`,
    ``,
    `Hello ${username || "Player"},`,
    ``,
    `We received a request to change the email address on your MyGameList account.`,
    `Please confirm the new email address by opening the link below:`,
    ``,
    verifyUrl,
    ``,
    `This link will expire in 60 minutes.`,
    `If you did not request this change, please ignore this email.`
  ].join("\n");

  try {
    console.log("[mail][email-change] Verifying transporter...");
    await transporter.verify();
    console.log("[mail][email-change] Transporter verify passed");

    console.log("[mail][email-change] Sending mail", {
      to,
      subject,
      from: env.NOREPLY_EMAIL_FROM
    });

    const info = await transporter.sendMail({
      from: `"MyGameList" <${env.NOREPLY_EMAIL_FROM}>`,
      to,
      subject,
      text,
      html
    });

    console.log("[mail][email-change] Mail sent", {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response
    });

    return info;
  } catch (error) {
    console.error("[mail][email-change] Mail send failed", {
      message: error?.message,
      code: error?.code,
      command: error?.command,
      response: error?.response,
      responseCode: error?.responseCode,
      stack: error?.stack
    });

    throw error;
  }
}