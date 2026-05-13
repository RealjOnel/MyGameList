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

function buildEmailChangeTemplate({ username, verifyUrl }) {
  const safeUsername = escapeHtml(username || "Player");
  const safeVerifyUrl = escapeHtml(verifyUrl);

  const siteUrl = env.FRONTEND_ORIGIN.replace(/\/+$/, "");
  const logoUrl = `${siteUrl}/assets/logo/mgl_logo_clear.png`;

  // links for assets
  const links = {
    tiktok: "https://www.tiktok.com/",
    youtube: "https://www.youtube.com/",
    instagram: "https://www.instagram.com/",
    discord: "https://discord.gg/bEeuWGQJRA",
    tos: `${siteUrl}/OtherPages/terms_of_service.html`,
    privacy: `${siteUrl}/OtherPages/privacy_policy.html`
  };

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirm your MyGameList Email Change</title>
</head>
<body style="margin:0; padding:0; background-color:#f3f6fb; font-family:Arial, Helvetica, sans-serif; color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f6fb; margin:0; padding:0;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px; background-color:#ffffff; border-radius:18px; overflow:hidden; border:1px solid #e5e7eb; box-shadow:0 12px 35px rgba(15,23,42,0.08);">
          
          <!-- Header -->
          <tr>
            <td align="center" style="background:linear-gradient(135deg, #0f172a 0%, #111f3a 100%); padding:32px 24px 24px;">
              <img
                src="${logoUrl}"
                alt="MyGameList Logo"
                width="180"
                style="display:block; width:180px; max-width:100%; height:auto; margin:0 auto 18px auto;"
              />
              <div style="font-size:24px; line-height:1.3; font-weight:700; color:#ffffff; margin-bottom:8px;">
                Confirm your email change
              </div>
              <div style="font-size:14px; line-height:1.6; color:#cbd5e1; max-width:460px; margin:0 auto;">
                Secure your MyGameList account by confirming the new email address linked to it.
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:36px 32px 28px;">
              <p style="margin:0 0 18px; font-size:16px; line-height:1.7; color:#334155;">
                Hello ${safeUsername},
              </p>

              <p style="margin:0 0 18px; font-size:16px; line-height:1.7; color:#475569;">
                We received a request to change the email address on your MyGameList account.
              </p>

              <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#475569;">
                Please confirm your new email address by clicking the button below.
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
                <tr>
                  <td align="center" bgcolor="#2563eb" style="border-radius:10px;">
                    <a
                      href="${safeVerifyUrl}"
                      style="display:inline-block; padding:14px 22px; font-size:15px; line-height:1; font-weight:700; color:#ffffff; text-decoration:none; border-radius:10px;"
                    >
                      Confirm Email Change
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 14px; font-size:15px; line-height:1.7; color:#475569;">
                This link will expire in <strong style="color:#0f172a;">60 minutes</strong>.
              </p>

              <p style="margin:0 0 14px; font-size:15px; line-height:1.7; color:#475569;">
                If the button does not work, copy and paste this link into your browser:
              </p>

              <p style="margin:0 0 22px; font-size:14px; line-height:1.7; word-break:break-word;">
                <a href="${safeVerifyUrl}" style="color:#2563eb; text-decoration:none;">${safeVerifyUrl}</a>
              </p>

              <p style="margin:0; font-size:15px; line-height:1.7; color:#64748b;">
                If you did not request this change, someone may be trying to access your account. In that case, please contact support immediately and consider changing your password.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px; background-color:#e2e8f0;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 30px; background-color:#fafbfd; text-align:center;">
              <div style="font-size:13px; line-height:1.5; color:#64748b; margin-bottom:12px;">
                Find us on:
              </div>

              <div style="margin-bottom:18px;">
                <a href="${links.tiktok}" style="color:#2563eb; text-decoration:none; font-size:14px; margin:0 8px;">TikTok</a>
                <a href="${links.youtube}" style="color:#2563eb; text-decoration:none; font-size:14px; margin:0 8px;">YouTube</a>
                <a href="${links.instagram}" style="color:#2563eb; text-decoration:none; font-size:14px; margin:0 8px;">Instagram</a>
                <a href="${links.discord}" style="color:#2563eb; text-decoration:none; font-size:14px; margin:0 8px;">Discord</a>
              </div>

              <div style="font-size:13px; line-height:1.5; color:#64748b; margin-bottom:10px;">
                Useful links:
              </div>

              <div style="margin-bottom:18px;">
                <a href="${links.tos}" style="color:#2563eb; text-decoration:none; font-size:14px; margin:0 8px;">Terms of Service</a>
                <a href="${links.privacy}" style="color:#2563eb; text-decoration:none; font-size:14px; margin:0 8px;">Privacy Policy</a>
              </div>

              <div style="font-size:12px; line-height:1.7; color:#94a3b8;">
                © MyGameList. All rights reserved.<br />
                This email was sent automatically. Please do not reply directly to this message.
              </div>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const text = [
    "Confirm your MyGameList email change",
    "",
    `Hello ${username || "Player"},`,
    "",
    "We received a request to change the email address on your MyGameList account.",
    "Please confirm your new email address by opening the link below:",
    "",
    verifyUrl,
    "",
    "This link will expire in 60 minutes.",
    "",
    "If you did not request this change, someone may be trying to access your account. Please contact support immediately and consider changing your password.",
    "",
    "Find us on:",
    `TikTok: ${links.tiktok}`,
    `YouTube: ${links.youtube}`,
    `Instagram: ${links.instagram}`,
    `Discord: ${links.discord}`,
    "",
    "Useful links:",
    `Terms of Service: ${links.tos}`,
    `Privacy Policy: ${links.privacy}`
  ].join("\n");

  return { html, text };
}

export async function sendEmailChangeVerificationMail({ to, username, verifyUrl }) {
  const transporter = getTransporter();

  const subject = "Confirm your MyGameList email change";
  const { html, text } = buildEmailChangeTemplate({
    username,
    verifyUrl
  });

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