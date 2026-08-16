import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().email("A valid email address is required.").max(254),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
  fullName: z.string().trim().min(2, "Full name is required.").max(120),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("A valid email address is required.").max(254),
  password: z.string().min(1, "Password is required.").max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
