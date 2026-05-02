import { z } from "zod";

const weakPasswords = new Set([
  "123456",
  "password",
  "qwerty",
  "abc123"
]);

export const strongPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(100, "Password must be 100 characters or less")
  .refine((value) => /[A-Z]/.test(value), {
    message: "Password must include at least one uppercase letter"
  })
  .refine((value) => /[a-z]/.test(value), {
    message: "Password must include at least one lowercase letter"
  })
  .refine((value) => /\d/.test(value), {
    message: "Password must include at least one number"
  })
  .refine((value) => !weakPasswords.has(value.toLowerCase()), {
    message: "This password is too common. Please choose a stronger one."
  });

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(20),
  email: z.string().trim().email(),
  password: strongPasswordSchema
});

export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1)
});