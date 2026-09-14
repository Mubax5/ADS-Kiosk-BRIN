import { z } from "zod";

export const contentTypes = ["website", "pdf", "qr", "image", "video", "text"] as const;
export type ContentType = (typeof contentTypes)[number];

const httpUrlSchema = z.string().url().refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}, "URL must use http or https");

export const contentConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("website"), url: httpUrlSchema, title: z.string().trim().min(1).max(120) }),
  z.object({ type: z.literal("pdf"), mediaId: z.string().uuid(), title: z.string().trim().min(1).max(120) }),
  z.object({ type: z.literal("qr"), url: httpUrlSchema, title: z.string().trim().min(1).max(120), instructions: z.string().trim().max(300).default("Scan QR dengan ponsel Anda") }),
  z.object({ type: z.literal("image"), mediaId: z.string().uuid(), caption: z.string().trim().max(300).nullable() }),
  z.object({ type: z.literal("video"), mediaId: z.string().uuid(), title: z.string().trim().max(120).nullable() }),
  z.object({ type: z.literal("text"), title: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(20_000) }),
]);

export type ContentConfig = z.infer<typeof contentConfigSchema>;

export const menuItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).nullable(),
  contentType: z.enum(contentTypes),
  content: contentConfigSchema,
  mediaId: z.string().uuid().nullable(),
  active: z.boolean(),
  sortOrder: z.number().int().min(0),
}).superRefine((item, ctx) => {
  if (item.contentType !== item.content.type) {
    ctx.addIssue({ code: "custom", path: ["contentType"], message: "contentType must match content.type" });
  }
});

export type MenuItem = z.infer<typeof menuItemSchema>;

export const adItemSchema = z.object({
  id: z.string().min(1),
  mediaId: z.string().uuid(),
  mediaType: z.enum(["image", "video"]),
  active: z.boolean(),
  sortOrder: z.number().int().min(0),
  displayDurationSeconds: z.number().int().min(3).max(3600).nullable(),
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
}).superRefine((ad, ctx) => {
  if (ad.startsAt && ad.endsAt && Date.parse(ad.startsAt) >= Date.parse(ad.endsAt)) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "endsAt must be after startsAt" });
  }
});

export type AdItem = z.infer<typeof adItemSchema>;

export const kioskSettingsSchema = z.object({
  sessionTimeoutSeconds: z.number().int().min(30).max(900).default(60),
  sessionWarningSeconds: z.literal(10).default(10),
  deviceDisplayName: z.string().trim().min(1).max(80).default("Kiosk Utama"),
});

export type KioskSettings = z.infer<typeof kioskSettingsSchema>;
