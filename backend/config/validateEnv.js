import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(3000),

  MONGO_URI: z
    .string()
    .min(1, "MONGO_URI is required"),

  JWT_SECRET: z
    .string()
    .min(16, "JWT_SECRET must be at least 16 characters long"),

  FRONTEND_ORIGIN: z
    .string()
    .url("FRONTEND_ORIGIN must be a valid URL"),

  COOKIE_CROSS_SITE: z
    .enum(["true", "false"])
    .default("false"),

  TWITCH_CLIENT_ID: z
    .string()
    .min(1, "TWITCH_CLIENT_ID is required"),

  TWITCH_CLIENT_SECRET: z
    .string()
    .min(1, "TWITCH_CLIENT_SECRET is required"),

  SMTP_HOST: z
    .string()
    .min(1, "SMTP_HOST is required"),

  SMTP_PORT: z.coerce
    .number()
    .int()
    .positive("SMTP_PORT must be a positive number"),

  SMTP_SECURE: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),

  SMTP_USER: z
    .string()
    .min(1, "SMTP_USER is required"),

  SMTP_PASS: z
    .string()
    .min(1, "SMTP_PASS is required"),

  SUPPORT_EMAIL_FROM: z
    .string()
    .email("SUPPORT_EMAIL_FROM must be a valid email address"),

  SUPPORT_EMAIL_TO: z
    .string()
    .email("SUPPORT_EMAIL_TO must be a valid email address"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`- ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;