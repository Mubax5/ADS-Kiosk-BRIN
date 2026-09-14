import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  DATABASE_PATH: z.string().default("./data/kiosk.db"),
  STORAGE_PATH: z.string().default("./storage"),
  COOKIE_SECRET: z.string().min(16).default("development-cookie-secret-change-me"),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  SESSION_TTL_HOURS: z.coerce.number().positive().max(168).default(8),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(524_288_000),
  KIOSK_DEVICE_ID: z.string().min(1).default("kiosk-main"),
  KIOSK_DEVICE_TOKEN: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;
export const env = envSchema.parse(process.env);
