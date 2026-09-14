import { z } from "zod";
import { adItemSchema, kioskSettingsSchema, menuItemSchema } from "./content";

export const manifestMediaSchema = z.object({
  id: z.string().uuid(),
  url: z.string().startsWith("/media/"),
  mimeType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});

export type ManifestMedia = z.infer<typeof manifestMediaSchema>;

export const publishedManifestSchema = z.object({
  version: z.number().int().positive(),
  publishedAt: z.string().datetime(),
  menuItems: z.array(menuItemSchema),
  ads: z.array(adItemSchema),
  settings: kioskSettingsSchema,
  media: z.array(manifestMediaSchema),
});

export type PublishedManifest = z.infer<typeof publishedManifestSchema>;
