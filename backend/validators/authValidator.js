import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(20),
  email: z.string().trim().email(),
  password: z.string().min(8).max(100)
});

export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1)
});